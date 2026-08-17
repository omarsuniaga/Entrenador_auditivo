/**
 * Pure Duel Room state machine — no Durable Object, WebSocket, or storage APIs here.
 * Mirrors server/roomManager.ts (the Node dev-server implementation) closely so the two
 * stay behaviorally in sync; ported to plain JSON-serializable objects (no Map, no `ws`
 * references, no NodeJS.Timeout) so this module can be persisted verbatim to Durable
 * Object storage and unit-tested without a live Workers runtime. DuelRoom.ts (the actual
 * Durable Object) owns storage/alarms/WebSocket I/O and calls into these functions for
 * every game-logic decision.
 */

import { DeviationCalculator } from '../../src/core/services/DeviationCalculator';
import { MusicalNoteCalculator, NoteApproximationAnalysis, TuningSystem, NoteScaleType } from '../../src/core/entities/MusicalNote';

export const SYNC_LEAD_MS = 1500;
export const SAMPLE_AUDIO_MS = 2500;
export const RETENTION_WAIT_MS = 3000;
export const DISCONNECT_GRACE_MS = 15000;
export const COUNTDOWN_MS = 3000;
export const RULESET_VERSION = 'duel-v2';

export type GameMode = 'frequency' | 'notes';
export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'round_result' | 'game_over';

export interface RoundSubmission {
  userHz?: number;
  deviationHz?: number;
  deviationCents?: number;
  accuracyPercentage: number;
  responseTimeMs: number;
  pointsEarned: number;
  isRoundWinner?: boolean;
  guessedNoteIndex?: number;
  guessedOctave?: number;
  guessedFullName?: string;
  isExactNoteMatch?: boolean;
  isCorrectPitchClass?: boolean;
  feedbackMessage?: string;
}

export interface DuelPlayer {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  sessionToken: string;
  // True only when this seat is backed by a real `players.id` row (the same anonymous
  // ranking identity used for solo sessions, via Authorization: Bearer <player token>).
  // Only authenticated players can be persisted into duel_participants — the column has a
  // foreign key into `players`, so a guest's rows would violate it.
  authenticated: boolean;
  score: number;
  totalAccuracy: number;
  totalDeviationHz: number;
  totalResponseTimeMs: number;
  roundsPlayed: number;
  roundsWon: number;
  currentRoundSubmission?: RoundSubmission;
  isReady: boolean;
  connected: boolean;
  // Set while a dropped connection is within its reconnection grace window.
  disconnectGraceExpiresAt?: number;
}

export interface DuelRound {
  roundNumber: number;
  targetHz: number;
  theoreticalHz?: number;
  noteAnalysis?: NoteApproximationAnalysis;
  durationMs: number;
  audioDurationMs: number;
  retentionWaitMs: number;
  scheduledPlayTime: number;
  tuningStartTime: number;
  tuningDurationMs: number;
  tuningDeadline: number;
  startedAt: number;
}

export interface RoundHistoryEntry {
  roundNumber: number;
  targetHz: number;
  noteAnalysis?: NoteApproximationAnalysis;
  winnerPlayerId?: string;
  winnerPlayerName?: string;
  submissions: Array<{
    playerId: string;
    playerName: string;
    userHz?: number;
    guessedFullName?: string;
    deviationHz?: number;
    deviationCents?: number;
    accuracyPercentage: number;
    pointsEarned: number;
    isRoundWinner: boolean;
    isExactNoteMatch?: boolean;
  }>;
}

export interface DuelRoomState {
  id: string;
  name: string;
  hostId: string;
  gameMode: GameMode;
  scaleType: NoteScaleType;
  tuningSystem: TuningSystem;
  a4Reference: number;
  players: Record<string, DuelPlayer>;
  totalRounds: number;
  currentRoundNumber: number;
  currentRound?: DuelRound;
  status: RoomStatus;
  // Set while status === 'countdown'; the alarm starts the first round once this passes.
  // Timer-based (not a bare setTimeout) because a Durable Object can hibernate mid-wait.
  countdownEndsAt?: number;
  abandonedByName?: string;
  winnerByAbandonmentId?: string;
  roundHistory: RoundHistoryEntry[];
  // Guards against double-writing duel_matches/duel_participants if the alarm and a
  // client message race, or the DO wakes from hibernation and re-checks a stale deadline.
  resultsPersisted: boolean;
  createdAt: number;
}

function clampA4Reference(value: unknown, fallback: number = 440): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(500, Math.max(380, num));
}

export function clampTotalRounds(value: unknown, fallback: number = 5): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(20, Math.max(3, Math.round(num)));
}

export interface CreateRoomInput {
  roomId: string;
  name: string;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  hostAuthenticated: boolean;
  totalRounds?: number;
  gameMode?: GameMode;
  scaleType?: NoteScaleType;
  tuningSystem?: TuningSystem;
  a4Reference?: number;
  now: number;
}

export function createInitialRoom(input: CreateRoomInput, sessionToken: string): DuelRoomState {
  const host: DuelPlayer = {
    id: input.hostId,
    name: input.hostName || 'Anfitrión',
    avatar: input.hostAvatar || '🎧',
    isHost: true,
    sessionToken,
    authenticated: input.hostAuthenticated,
    score: 0,
    totalAccuracy: 0,
    totalDeviationHz: 0,
    totalResponseTimeMs: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    isReady: true,
    connected: true
  };

  return {
    id: input.roomId,
    name: input.name || `Duelo #${input.roomId}`,
    hostId: input.hostId,
    gameMode: input.gameMode || 'frequency',
    scaleType: input.scaleType || 'chromatic',
    tuningSystem: input.tuningSystem || '12tet',
    a4Reference: clampA4Reference(input.a4Reference),
    players: { [host.id]: host },
    totalRounds: clampTotalRounds(input.totalRounds),
    currentRoundNumber: 0,
    status: 'lobby',
    roundHistory: [],
    resultsPersisted: false,
    createdAt: input.now
  };
}

export type JoinFailureReason = 'room-in-progress' | 'seat-taken' | 'room-full';

// Deliberately not a discriminated union `{ok:true,...} | {ok:false,...}` — callers found
// `if (!result.ok)` didn't narrow `result.reason` reliably. `player` is only set on
// success and `reason` only on failure; `ok` says which to trust.
export interface JoinResult {
  ok: boolean;
  player?: DuelPlayer;
  reason?: JoinFailureReason;
}

const MAX_PLAYERS = 2;

/** Registers a new player, or reactivates an existing seat when the session token matches. */
export function joinRoom(
  room: DuelRoomState,
  input: { playerId: string; name: string; avatar?: string; sessionToken?: string; authenticated: boolean },
  sessionToken: string
): JoinResult {
  const existing = room.players[input.playerId];
  if (existing) {
    if (existing.sessionToken && existing.sessionToken !== input.sessionToken) {
      return { ok: false, reason: 'seat-taken' };
    }
    existing.connected = true;
    existing.name = input.name || existing.name;
    existing.disconnectGraceExpiresAt = undefined;
    return { ok: true, player: existing };
  }

  if (room.status !== 'lobby') return { ok: false, reason: 'room-in-progress' };
  if (Object.keys(room.players).length >= MAX_PLAYERS) return { ok: false, reason: 'room-full' };

  const player: DuelPlayer = {
    id: input.playerId,
    name: input.name || `Jugador ${Object.keys(room.players).length + 1}`,
    avatar: input.avatar || '🎵',
    isHost: false,
    sessionToken,
    authenticated: input.authenticated,
    score: 0,
    totalAccuracy: 0,
    totalDeviationHz: 0,
    totalResponseTimeMs: 0,
    roundsPlayed: 0,
    roundsWon: 0,
    isReady: false,
    connected: true
  };
  room.players[player.id] = player;
  return { ok: true, player };
}

export function updateRoomSettings(
  room: DuelRoomState,
  hostId: string,
  settings: {
    gameMode?: GameMode;
    scaleType?: NoteScaleType;
    tuningSystem?: TuningSystem;
    totalRounds?: number;
    a4Reference?: number;
  }
): boolean {
  if (room.hostId !== hostId || room.status !== 'lobby') return false;
  if (settings.gameMode) room.gameMode = settings.gameMode;
  if (settings.scaleType) room.scaleType = settings.scaleType;
  if (settings.tuningSystem) room.tuningSystem = settings.tuningSystem;
  if (settings.totalRounds !== undefined) room.totalRounds = clampTotalRounds(settings.totalRounds, room.totalRounds);
  if (settings.a4Reference !== undefined) room.a4Reference = clampA4Reference(settings.a4Reference, room.a4Reference);
  return true;
}

export function canStartMatch(room: DuelRoomState, hostId: string): boolean {
  const connected = Object.values(room.players).filter((p) => p.connected);
  return room.status === 'lobby'
    && room.hostId === hostId
    && connected.length >= 2
    && connected.every((p) => p.isReady);
}

export function beginCountdown(room: DuelRoomState, now: number): void {
  room.status = 'countdown';
  room.countdownEndsAt = now + COUNTDOWN_MS;
}

export function startRound(room: DuelRoomState, now: number): void {
  room.countdownEndsAt = undefined;
  room.currentRoundNumber += 1;

  let targetHz: number;
  let theoreticalHz: number | undefined;
  let noteAnalysis: NoteApproximationAnalysis | undefined;

  if (room.gameMode === 'notes') {
    const generated = MusicalNoteCalculator.generateTrainingPitch({
      scaleType: room.scaleType,
      minOctave: 3,
      maxOctave: 5,
      tuningSystem: room.tuningSystem,
      allowMicrotonalDetuning: true,
      a4Reference: room.a4Reference
    });
    targetHz = generated.targetHz;
    theoreticalHz = generated.theoreticalHz;
    noteAnalysis = generated.analysis;
  } else {
    targetHz = DeviationCalculator.generateTargetFrequency(130, 5500, 'continuous');
  }

  for (const player of Object.values(room.players)) {
    player.currentRoundSubmission = undefined;
  }

  const scheduledPlayTime = now + SYNC_LEAD_MS;
  const tuningStartTime = scheduledPlayTime + SAMPLE_AUDIO_MS + RETENTION_WAIT_MS;
  const tuningDurationMs = room.gameMode === 'notes' ? 12000 : 15000;
  const tuningDeadline = tuningStartTime + tuningDurationMs;

  room.currentRound = {
    roundNumber: room.currentRoundNumber,
    targetHz,
    theoreticalHz,
    noteAnalysis,
    durationMs: tuningDurationMs,
    audioDurationMs: SAMPLE_AUDIO_MS,
    retentionWaitMs: RETENTION_WAIT_MS,
    scheduledPlayTime,
    tuningStartTime,
    tuningDurationMs,
    tuningDeadline,
    startedAt: now
  };
  room.status = 'playing';
}

export function submitGuess(
  room: DuelRoomState,
  playerId: string,
  submission: { userHz?: number; guessedNoteIndex?: number; guessedOctave?: number },
  now: number
): boolean {
  if (room.status !== 'playing' || !room.currentRound) return false;
  const player = room.players[playerId];
  if (!player || !player.connected || player.currentRoundSubmission) return false;
  if (now < room.currentRound.tuningStartTime) return false;

  const targetHz = room.currentRound.targetHz;
  const responseTimeMs = Math.max(50, now - room.currentRound.tuningStartTime);

  if (room.gameMode === 'notes' && submission.guessedNoteIndex !== undefined && submission.guessedOctave !== undefined) {
    const evalResult = MusicalNoteCalculator.evaluateGuess(
      targetHz,
      submission.guessedNoteIndex,
      submission.guessedOctave,
      responseTimeMs,
      room.tuningSystem,
      room.a4Reference
    );

    player.currentRoundSubmission = {
      accuracyPercentage: evalResult.accuracyPercentage,
      pointsEarned: evalResult.scorePoints,
      responseTimeMs,
      guessedNoteIndex: submission.guessedNoteIndex,
      guessedOctave: submission.guessedOctave,
      guessedFullName: evalResult.analysis.closestNote.fullName,
      isExactNoteMatch: evalResult.isExactNoteMatch,
      isCorrectPitchClass: evalResult.isCorrectPitchClass,
      deviationHz: evalResult.analysis.deviationHz,
      deviationCents: evalResult.analysis.deviationCents,
      feedbackMessage: evalResult.feedbackMessage
    };

    player.score += evalResult.scorePoints;
    player.totalAccuracy += evalResult.accuracyPercentage;
    player.totalDeviationHz += Math.abs(evalResult.analysis.deviationHz);
  } else {
    const userHz = submission.userHz || 440;
    const analysis = DeviationCalculator.analyze(targetHz, userHz);
    const accuracyPoints = Math.round((analysis.accuracyPercentage / 100) * 1000);
    const speedBonus = Math.max(0, Math.round(300 * Math.max(0, 1 - responseTimeMs / 30000)));
    const pointsEarned = accuracyPoints + speedBonus;

    player.currentRoundSubmission = {
      userHz,
      deviationHz: analysis.deviationHz,
      deviationCents: analysis.deviationCents,
      accuracyPercentage: analysis.accuracyPercentage,
      responseTimeMs,
      pointsEarned
    };

    player.score += pointsEarned;
    player.totalAccuracy += analysis.accuracyPercentage;
    player.totalDeviationHz += Math.abs(analysis.deviationHz);
  }

  player.totalResponseTimeMs += responseTimeMs;
  player.roundsPlayed += 1;
  return true;
}

export function allPlayersSubmitted(room: DuelRoomState): boolean {
  const active = Object.values(room.players).filter((p) => p.connected);
  if (active.length === 0) return false;
  return active.every((p) => !!p.currentRoundSubmission);
}

/** Scores the round from whatever submissions exist — called either because everyone
 * answered, or because the alarm fired at the tuning deadline with some players silent. */
export function evaluateRoundResults(room: DuelRoomState): void {
  if (!room.currentRound) return;
  const activePlayers = Object.values(room.players).filter((p) => p.connected && p.currentRoundSubmission);
  if (activePlayers.length === 0) return;

  let winnerId: string | undefined;
  let winnerName: string | undefined;

  if (room.gameMode === 'notes') {
    let highestPoints = -1;
    let fastestTime = Infinity;
    for (const p of activePlayers) {
      const sub = p.currentRoundSubmission!;
      if (sub.pointsEarned > highestPoints || (sub.pointsEarned === highestPoints && sub.responseTimeMs < fastestTime)) {
        highestPoints = sub.pointsEarned;
        fastestTime = sub.responseTimeMs;
        winnerId = p.id;
        winnerName = p.name;
      }
    }
  } else {
    let bestDeviation = Infinity;
    for (const p of activePlayers) {
      const dev = Math.abs(p.currentRoundSubmission!.deviationHz ?? Infinity);
      if (dev < bestDeviation) {
        bestDeviation = dev;
        winnerId = p.id;
        winnerName = p.name;
      }
    }
  }

  for (const p of activePlayers) {
    p.currentRoundSubmission!.isRoundWinner = p.id === winnerId;
    if (p.id === winnerId) p.roundsWon += 1;
  }

  room.roundHistory.push({
    roundNumber: room.currentRound.roundNumber,
    targetHz: room.currentRound.targetHz,
    noteAnalysis: room.currentRound.noteAnalysis,
    winnerPlayerId: winnerId,
    winnerPlayerName: winnerName,
    submissions: Object.values(room.players).map((p) => ({
      playerId: p.id,
      playerName: p.name,
      userHz: p.currentRoundSubmission?.userHz,
      guessedFullName: p.currentRoundSubmission?.guessedFullName,
      deviationHz: p.currentRoundSubmission?.deviationHz,
      deviationCents: p.currentRoundSubmission?.deviationCents,
      accuracyPercentage: p.currentRoundSubmission?.accuracyPercentage || 0,
      pointsEarned: p.currentRoundSubmission?.pointsEarned || 0,
      isRoundWinner: p.id === winnerId,
      isExactNoteMatch: p.currentRoundSubmission?.isExactNoteMatch
    }))
  });

  room.status = 'round_result';
}

export function advanceOrFinish(room: DuelRoomState, now: number): void {
  if (room.currentRoundNumber >= room.totalRounds) {
    room.status = 'game_over';
  } else {
    startRound(room, now);
  }
}

export function restartGame(room: DuelRoomState): void {
  room.status = 'lobby';
  room.currentRoundNumber = 0;
  room.countdownEndsAt = undefined;
  room.roundHistory = [];
  room.currentRound = undefined;
  room.abandonedByName = undefined;
  room.winnerByAbandonmentId = undefined;
  room.resultsPersisted = false;
  for (const p of Object.values(room.players)) {
    p.score = 0;
    p.totalAccuracy = 0;
    p.totalDeviationHz = 0;
    p.totalResponseTimeMs = 0;
    p.roundsPlayed = 0;
    p.roundsWon = 0;
    p.currentRoundSubmission = undefined;
  }
}

export type DisconnectOutcome = 'grace-started' | 'removed-lobby' | 'room-empty' | 'no-op';

/** A socket dropped. In the lobby this frees the seat immediately; mid-duel it starts a
 * reconnection grace window instead of declaring an instant walkover (mobile devices
 * losing wifi briefly is common and shouldn't end the match). */
export function markPlayerDisconnected(room: DuelRoomState, playerId: string, now: number): DisconnectOutcome {
  const player = room.players[playerId];
  if (!player) return 'no-op';

  player.connected = false;

  if (room.status === 'lobby') {
    delete room.players[playerId];
    if (Object.keys(room.players).length === 0) return 'room-empty';
    if (room.hostId === playerId) {
      const nextHostId = Object.keys(room.players)[0];
      room.hostId = nextHostId;
      room.players[nextHostId].isHost = true;
    }
    return 'removed-lobby';
  }

  player.disconnectGraceExpiresAt = now + DISCONNECT_GRACE_MS;
  return 'grace-started';
}

/** Explicit "Salir" — no grace window, the player chose to leave. */
export function leaveRoom(room: DuelRoomState, playerId: string): void {
  const player = room.players[playerId];
  if (!player) return;
  player.connected = false;
  player.disconnectGraceExpiresAt = undefined;
  finalizeAbandonmentIfNeeded(room, player);
}

function finalizeAbandonmentIfNeeded(room: DuelRoomState, departingPlayer: DuelPlayer): void {
  if (room.status === 'lobby') return;
  const stillConnected = Object.values(room.players).filter((p) => p.connected);
  if (stillConnected.length === 1 && room.status !== 'game_over') {
    room.abandonedByName = departingPlayer.name;
    room.winnerByAbandonmentId = stillConnected[0].id;
    room.status = 'game_over';
  }
}

/** Called from the DO's alarm handler. Finalizes any player whose grace window has
 * expired without reconnecting. Returns true if room state changed (caller should
 * broadcast + persist). */
export function finalizeExpiredDisconnects(room: DuelRoomState, now: number): boolean {
  let changed = false;
  for (const player of Object.values(room.players)) {
    if (player.connected || !player.disconnectGraceExpiresAt) continue;
    if (now < player.disconnectGraceExpiresAt) continue;
    player.disconnectGraceExpiresAt = undefined;
    finalizeAbandonmentIfNeeded(room, player);
    changed = true;
  }
  return changed;
}

/** Earliest moment the DO needs to wake up on its own (round deadline, or a pending
 * reconnection grace expiry) — Durable Objects only support one alarm at a time. */
export function nextAlarmTime(room: DuelRoomState): number | null {
  const candidates: number[] = [];
  if (room.status === 'countdown' && room.countdownEndsAt) candidates.push(room.countdownEndsAt);
  if (room.status === 'playing' && room.currentRound) candidates.push(room.currentRound.tuningDeadline);
  for (const player of Object.values(room.players)) {
    if (player.disconnectGraceExpiresAt) candidates.push(player.disconnectGraceExpiresAt);
  }
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export interface PublicPlayerView {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  totalAccuracy: number;
  averageDeviationHz: number;
  averageResponseTimeMs: number;
  roundsPlayed: number;
  roundsWon: number;
  hasSubmitted: boolean;
  currentRoundSubmission?: RoundSubmission;
  isReady: boolean;
  connected: boolean;
}

export interface DuelFinalResult {
  winnerPlayerId?: string;
  isDraw: boolean;
}

function computeFinalResult(room: DuelRoomState, playersList: PublicPlayerView[]): DuelFinalResult | undefined {
  if (room.status !== 'game_over') return undefined;
  if (room.winnerByAbandonmentId) return { winnerPlayerId: room.winnerByAbandonmentId, isDraw: false };
  const best = playersList[0];
  if (!best) return { isDraw: true };
  const topPlayers = playersList.filter((p) => p.score === best.score && p.roundsWon === best.roundsWon);
  return topPlayers.length === 1 ? { winnerPlayerId: topPlayers[0].id, isDraw: false } : { isDraw: true };
}

/** Server -> client snapshot. `revealTarget` unlocks the plain (non-obfuscated) target Hz
 * for the round-result / game-over broadcasts; encoding of the live value happens in
 * DuelRoom.ts (it needs the room id + round number, which this pure module already has,
 * but keeping the XOR obfuscation helper import out of this file keeps it free of the
 * `src/shared` boundary — DuelRoom.ts composes both). */
export function getPublicRoomState(room: DuelRoomState, revealTarget: boolean) {
  const playersList: PublicPlayerView[] = Object.values(room.players)
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      score: p.score,
      totalAccuracy: p.roundsPlayed > 0 ? Math.round((p.totalAccuracy / p.roundsPlayed) * 10) / 10 : 0,
      averageDeviationHz: p.roundsPlayed > 0 ? Math.round((p.totalDeviationHz / p.roundsPlayed) * 10) / 10 : 0,
      averageResponseTimeMs: p.roundsPlayed > 0 ? Math.round(p.totalResponseTimeMs / p.roundsPlayed) : 0,
      roundsPlayed: p.roundsPlayed,
      roundsWon: p.roundsWon,
      hasSubmitted: !!p.currentRoundSubmission,
      currentRoundSubmission: (revealTarget || room.status === 'round_result' || room.status === 'game_over') ? p.currentRoundSubmission : undefined,
      isReady: p.isReady,
      connected: p.connected
    }))
    .sort((a, b) => b.score - a.score || b.roundsWon - a.roundsWon || a.name.localeCompare(b.name));

  return {
    id: room.id,
    name: room.name,
    hostId: room.hostId,
    gameMode: room.gameMode,
    scaleType: room.scaleType,
    tuningSystem: room.tuningSystem,
    a4Reference: room.a4Reference,
    players: playersList,
    totalRounds: room.totalRounds,
    currentRoundNumber: room.currentRoundNumber,
    status: room.status,
    abandonedByName: room.abandonedByName,
    winnerByAbandonmentId: room.winnerByAbandonmentId,
    finalResult: computeFinalResult(room, playersList),
    currentRound: room.currentRound ? {
      roundNumber: room.currentRound.roundNumber,
      durationMs: room.currentRound.durationMs,
      audioDurationMs: room.currentRound.audioDurationMs,
      retentionWaitMs: room.currentRound.retentionWaitMs,
      scheduledPlayTime: room.currentRound.scheduledPlayTime,
      tuningStartTime: room.currentRound.tuningStartTime,
      tuningDurationMs: room.currentRound.tuningDurationMs,
      tuningDeadline: room.currentRound.tuningDeadline,
      startedAt: room.currentRound.startedAt,
      noteAnalysis: (revealTarget || room.status === 'round_result' || room.status === 'game_over') ? room.currentRound.noteAnalysis : undefined,
      targetHz: (revealTarget || room.status === 'round_result' || room.status === 'game_over') ? room.currentRound.targetHz : undefined
      // encodedTargetHz is attached by DuelRoom.ts, which owns the obfuscation helper.
    } : null,
    roundHistory: room.roundHistory
  };
}

export interface DuelMatchRow {
  id: string;
  mode: GameMode;
  status: 'completed' | 'abandoned' | 'draw';
  winnerPlayerId: string | null;
  rulesetVersion: string;
  completedAt: number;
  roomId: string;
  endedReason: 'completed' | 'abandoned' | 'cancelled' | 'draw';
}

export interface DuelParticipantRow {
  matchId: string;
  playerId: string;
  score: number;
  roundsWon: number;
  accuracy: number;
  result: 'win' | 'loss' | 'draw' | 'abandoned';
  responseTimeMs: number | null;
}

/** Builds the D1 rows for a finished duel, or null if there's nothing worth persisting
 * (no authenticated participant — guests don't have a `players` row to satisfy the FK). */
export function buildDuelPersistenceRows(room: DuelRoomState, matchId: string, now: number): { match: DuelMatchRow; participants: DuelParticipantRow[] } | null {
  if (room.status !== 'game_over' || room.resultsPersisted) return null;

  const authenticated = Object.values(room.players).filter((p) => p.authenticated);
  if (authenticated.length === 0) return null;

  const isAbandonment = !!room.abandonedByName;
  const winnerId = room.winnerByAbandonmentId ?? computeFinalResult(room, Object.values(room.players).map((p) => ({
    id: p.id, score: p.score, roundsWon: p.roundsWon
  } as PublicPlayerView)))?.winnerPlayerId;
  const isDraw = !isAbandonment && !winnerId;

  const match: DuelMatchRow = {
    id: matchId,
    mode: room.gameMode,
    status: isAbandonment ? 'abandoned' : isDraw ? 'draw' : 'completed',
    winnerPlayerId: winnerId && room.players[winnerId]?.authenticated ? winnerId : null,
    rulesetVersion: RULESET_VERSION,
    completedAt: now,
    roomId: room.id,
    endedReason: isAbandonment ? 'abandoned' : isDraw ? 'draw' : 'completed'
  };

  const participants: DuelParticipantRow[] = authenticated.map((p) => ({
    matchId,
    playerId: p.id,
    score: p.score,
    roundsWon: p.roundsWon,
    accuracy: p.roundsPlayed > 0 ? Math.round((p.totalAccuracy / p.roundsPlayed) * 10) / 10 : 0,
    result: isAbandonment
      ? (p.id === winnerId ? 'win' : 'abandoned')
      : isDraw ? 'draw' : (p.id === winnerId ? 'win' : 'loss'),
    responseTimeMs: p.roundsPlayed > 0 ? Math.round(p.totalResponseTimeMs / p.roundsPlayed) : null
  }));

  return { match, participants };
}
