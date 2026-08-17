/**
 * Server-Side Room Manager
 * Manages active multiplayer pitch duel rooms, synchronized round timers, hidden target frequencies,
 * and authoritative scoring.
 */

import { randomBytes } from 'crypto';
import { DeviationCalculator } from '../src/core/services/DeviationCalculator';
import { MusicalNoteCalculator, NoteApproximationAnalysis, TuningSystem, NoteScaleType } from '../src/core/entities/MusicalNote';
import { encodeTargetHz } from '../src/shared/utils/frequencyObfuscation';

// Round phase timing (server-authoritative — see ServerRoom.currentRound).
const SYNC_LEAD_MS = 1500;       // "sincronizando dispositivos" window before the tone fires
const SAMPLE_AUDIO_MS = 2500;    // how long the target tone sounds
const RETENTION_WAIT_MS = 3000;  // silent memory-retention gap before tuning unlocks
const DISCONNECT_GRACE_MS = 15000;

function clampA4Reference(value: unknown, fallback: number = 440): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(500, Math.max(380, num));
}

function clampTotalRounds(value: unknown, fallback: number = 5): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(20, Math.max(3, Math.round(num)));
}

export interface ServerPlayer {
  id: string;
  ws: any;
  name: string;
  avatar: string;
  isHost: boolean;
  // Server-issued secret, opaque to clients other than its owner. Required on JOIN_ROOM
  // for a playerId that already occupies a seat, so a guessed/observed playerId alone
  // can't be used to hijack another player's connection.
  sessionToken: string;
  score: number;
  totalAccuracy: number;
  totalDeviationHz: number;
  roundsPlayed: number;
  roundsWon: number;
  currentRoundSubmission?: {
    userHz?: number;
    deviationHz?: number;
    deviationCents?: number;
    accuracyPercentage: number;
    responseTimeMs: number;
    pointsEarned: number;
    isRoundWinner?: boolean;
    // Note mode details
    guessedNoteIndex?: number;
    guessedOctave?: number;
    guessedFullName?: string;
    isExactNoteMatch?: boolean;
    isCorrectPitchClass?: boolean;
    feedbackMessage?: string;
  };
  isReady: boolean;
  connected: boolean;
  disconnectTimer?: NodeJS.Timeout;
}

export interface ServerRoom {
  id: string;
  name: string;
  hostId: string;
  gameMode: 'frequency' | 'notes';
  scaleType: NoteScaleType;
  tuningSystem: TuningSystem;
  a4Reference: number;
  players: Map<string, ServerPlayer>;
  totalRounds: number;
  currentRoundNumber: number;
  // Absolute server timestamps drive the round's phase machine. Every client derives its
  // own phase from these plus its measured clock offset, so all devices move through
  // SYNCING -> SAMPLE_PLAYING -> RETENTION_WAIT -> TUNING_READY at the same wall-clock moment.
  currentRound?: {
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
  };
  status: 'lobby' | 'countdown' | 'playing' | 'round_result' | 'game_over';
  // Set when a player walks out mid-duel: the remaining player wins by walkover but the
  // accumulated duel metrics are still shown.
  abandonedByName?: string;
  winnerByAbandonmentId?: string;
  roundTimer?: NodeJS.Timeout;
  roundHistory: Array<{
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
  }>;
}

export class RoomManager {
  private rooms: Map<string, ServerRoom> = new Map();
  private roomStateListener?: (room: ServerRoom) => void;

  setRoomStateListener(listener: (room: ServerRoom) => void): void {
    this.roomStateListener = listener;
  }

  private generateRoomId(): string {
    // crypto.randomBytes over Math.random for a less guessable code, plus a
    // collision retry so an unlucky repeat can't silently clobber an existing room.
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomBytes(4).toString('hex').substring(0, 5).toUpperCase();
      if (!this.rooms.has(candidate)) return candidate;
    }
    // Astronomically unlikely fallback: widen the code instead of looping forever.
    return randomBytes(6).toString('hex').toUpperCase();
  }

  private generateSessionToken(): string {
    return randomBytes(24).toString('hex');
  }

  createRoom(
    name: string,
    hostPlayer: { id: string; name: string; avatar?: string; ws: any },
    totalRounds: number = 5,
    options: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      a4Reference?: number;
    } = {}
  ): ServerRoom {
    const roomId = this.generateRoomId();

    const player: ServerPlayer = {
      id: hostPlayer.id,
      ws: hostPlayer.ws,
      name: hostPlayer.name || 'Anfitrión',
      avatar: hostPlayer.avatar || '🎧',
      isHost: true,
      sessionToken: this.generateSessionToken(),
      score: 0,
      totalAccuracy: 0,
      totalDeviationHz: 0,
      roundsPlayed: 0,
      roundsWon: 0,
      isReady: true,
      connected: true
    };

    const room: ServerRoom = {
      id: roomId,
      name: name || `Duelo #${roomId}`,
      hostId: hostPlayer.id,
      gameMode: options.gameMode || 'frequency',
      scaleType: options.scaleType || 'chromatic',
      tuningSystem: options.tuningSystem || '12tet',
      a4Reference: clampA4Reference(options.a4Reference),
      players: new Map([[player.id, player]]),
      totalRounds: clampTotalRounds(totalRounds),
      currentRoundNumber: 0,
      status: 'lobby',
      roundHistory: []
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): ServerRoom | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  joinRoom(roomId: string, playerInfo: { id: string; name: string; avatar?: string; ws: any; sessionToken?: string }): ServerRoom | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    if (room.status !== 'lobby' && !room.players.has(playerInfo.id)) {
      // Room in progress
      return null;
    }

    const existing = room.players.get(playerInfo.id);
    if (existing) {
      // Reconnecting to a seat we already hold requires proving it with the token issued
      // at create/join time — otherwise anyone who observes/guesses a playerId could take
      // over that player's connection and score mid-game.
      if (existing.sessionToken && existing.sessionToken !== playerInfo.sessionToken) {
        return null;
      }
      existing.ws = playerInfo.ws;
      existing.connected = true;
      existing.name = playerInfo.name || existing.name;
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = undefined;
      }
    } else {
      const isHost = room.players.size === 0;
      room.players.set(playerInfo.id, {
        id: playerInfo.id,
        ws: playerInfo.ws,
        name: playerInfo.name || `Jugador ${room.players.size + 1}`,
        avatar: playerInfo.avatar || '🎵',
        isHost,
        sessionToken: this.generateSessionToken(),
        score: 0,
        totalAccuracy: 0,
        totalDeviationHz: 0,
        roundsPlayed: 0,
        roundsWon: 0,
        isReady: isHost,
        connected: true
      });
    }

    return room;
  }

  updateRoomSettings(
    roomId: string,
    hostId: string,
    settings: {
      gameMode?: 'frequency' | 'notes';
      scaleType?: NoteScaleType;
      tuningSystem?: TuningSystem;
      totalRounds?: number;
      a4Reference?: number;
    }
  ): boolean {
    const room = this.getRoom(roomId);
    if (!room || room.hostId !== hostId || room.status !== 'lobby') return false;

    if (settings.gameMode) room.gameMode = settings.gameMode;
    if (settings.scaleType) room.scaleType = settings.scaleType;
    if (settings.tuningSystem) room.tuningSystem = settings.tuningSystem;
    if (settings.totalRounds !== undefined) room.totalRounds = clampTotalRounds(settings.totalRounds, room.totalRounds);
    if (settings.a4Reference !== undefined) room.a4Reference = clampA4Reference(settings.a4Reference, room.a4Reference);

    return true;
  }

  // Shared cleanup for a player leaving a room, whether triggered by a dropped socket
  // (removePlayer) or an explicit LEAVE_ROOM while the socket stays open (leaveRoom).
  // Returns the room unless it was deleted (emptied out) as a result.
  private detachPlayerFromRoom(room: ServerRoom, playerId: string, reason: 'disconnect' | 'leave'): ServerRoom | null {
    const player = room.players.get(playerId);
    if (!player) return room;

    player.connected = false;
    // Null the socket reference so broadcastRoom's `player.ws && OPEN` filter naturally
    // skips this player from here on. Without this, an explicit LEAVE_ROOM (whose socket
    // is still open) keeps receiving this room's state and overwrites the client's own
    // "I left" reset the moment the next broadcast arrives.
    player.ws = null;
    if (reason === 'disconnect' && room.status !== 'lobby') {
      // A dropped network connection is not an explicit surrender. Keep the seat briefly so
      // mobile devices waking from sleep or changing Wi-Fi can reclaim it with their token.
      player.disconnectTimer = setTimeout(() => {
        if (player.connected || this.getRoom(room.id) !== room) return;
        const updatedRoom = this.finalizeDeparture(room, player);
        if (updatedRoom) this.roomStateListener?.(updatedRoom);
      }, DISCONNECT_GRACE_MS);
      return room;
    }

    return this.finalizeDeparture(room, player);
  }

  private finalizeDeparture(room: ServerRoom, player: ServerPlayer): ServerRoom | null {
    const playerId = player.id;
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = undefined;
    }
    if (room.status === 'lobby') {
      room.players.delete(playerId);
      if (room.players.size === 0) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        this.rooms.delete(room.id);
        return null;
      }
      if (room.hostId === playerId) {
        const nextHost = room.players.keys().next().value;
        if (nextHost) {
          room.hostId = nextHost;
          const p = room.players.get(nextHost);
          if (p) p.isHost = true;
        }
      }
    } else {
      // In-game: if all players have disconnected, cleanup room to prevent memory leaks
      const stillConnected = Array.from(room.players.values()).filter(p => p.connected);
      if (stillConnected.length === 0) {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        this.rooms.delete(room.id);
        return null;
      }

      // Someone walked out of a live duel and exactly one player is left standing:
      // end the duel as a walkover, but keep every accumulated metric so the remaining
      // player still sees the full scoreboard rather than an empty screen.
      if (stillConnected.length === 1 && room.status !== 'game_over') {
        if (room.roundTimer) clearTimeout(room.roundTimer);
        room.abandonedByName = player.name;
        room.winnerByAbandonmentId = stillConnected[0].id;
        room.status = 'game_over';
      }
    }
    return room;
  }

  removePlayer(ws: any): { room: ServerRoom; playerId: string } | null {
    for (const room of this.rooms.values()) {
      for (const playerId of room.players.keys()) {
        if (room.players.get(playerId)?.ws === ws) {
          const result = this.detachPlayerFromRoom(room, playerId, 'disconnect');
          return result ? { room: result, playerId } : null;
        }
      }
    }
    return null;
  }

  // Explicit "Salir" — the socket stays open (the player may create/join another room),
  // only their seat in this specific room is released.
  leaveRoom(roomId: string, playerId: string): ServerRoom | null {
    const room = this.getRoom(roomId);
    if (!room || !room.players.has(playerId)) return null;
    return this.detachPlayerFromRoom(room, playerId, 'leave');
  }

  canStartMatch(room: ServerRoom, hostId: string): boolean {
    const connectedPlayers = Array.from(room.players.values()).filter(player => player.connected);
    return room.status === 'lobby'
      && room.hostId === hostId
      && connectedPlayers.length >= 2
      && connectedPlayers.every(player => player.isReady);
  }

  startRound(room: ServerRoom, onRoundEnd: (room: ServerRoom) => void): void {
    room.currentRoundNumber += 1;
    
    let targetHz: number;
    let theoreticalHz: number | undefined = undefined;
    let noteAnalysis: NoteApproximationAnalysis | undefined = undefined;

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
      // Frequency mode: safe audible baseline for mobile and desktop devices
      targetHz = DeviationCalculator.generateTargetFrequency(130, 5500, 'continuous');

    }

    // Reset round submissions
    for (const player of room.players.values()) {
      player.currentRoundSubmission = undefined;
    }

    const now = Date.now();
    // Lead time so every device receives the round packet and schedules the tone before
    // it actually fires — this is what makes playback simultaneous across devices.
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

    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = undefined;
    }
  }

  submitGuess(
    room: ServerRoom,
    playerId: string,
    submission: {
      userHz?: number;
      guessedNoteIndex?: number;
      guessedOctave?: number;
      responseTimeMs: number;
    }
  ): boolean {
    if (room.status !== 'playing' || !room.currentRound) return false;
    const player = room.players.get(playerId);
    if (!player || player.currentRoundSubmission) return false;

    // Reject anything sent before the tuning phase opens. The client already gates its UI,
    // but the server is the authority: without this a modified client could answer during
    // the sample/retention phases and post an unbeatable response time.
    const nowMs = Date.now();
    if (nowMs < room.currentRound.tuningStartTime) return false;

    const targetHz = room.currentRound.targetHz;
    // Response time is measured from when tuning unlocked, not from round start, so the
    // fixed sample+retention preamble doesn't inflate everyone's clock equally.
    const serverElapsed = Math.max(50, nowMs - room.currentRound.tuningStartTime);
    const responseTimeMs = serverElapsed;


    if (room.gameMode === 'notes' && submission.guessedNoteIndex !== undefined && submission.guessedOctave !== undefined) {
      // Evaluate note identification
      const evalResult = MusicalNoteCalculator.evaluateGuess(
        targetHz,
        submission.guessedNoteIndex,
        submission.guessedOctave,
        responseTimeMs,
        room.tuningSystem,
        room.a4Reference
      );

      const noteInfo = MusicalNoteCalculator.analyzeSamplePitch(targetHz, room.tuningSystem, room.a4Reference);

      player.currentRoundSubmission = {
        accuracyPercentage: evalResult.accuracyPercentage,
        pointsEarned: evalResult.scorePoints,
        responseTimeMs,
        guessedNoteIndex: submission.guessedNoteIndex,
        guessedOctave: submission.guessedOctave,
        guessedFullName: `${evalResult.analysis.closestNote.fullName}`,
        isExactNoteMatch: evalResult.isExactNoteMatch,
        isCorrectPitchClass: evalResult.isCorrectPitchClass,
        deviationHz: evalResult.analysis.deviationHz,
        deviationCents: evalResult.analysis.deviationCents,
        feedbackMessage: evalResult.feedbackMessage
      };

      player.score += evalResult.scorePoints;
      player.totalAccuracy += evalResult.accuracyPercentage;
      player.totalDeviationHz += Math.abs(evalResult.analysis.deviationHz);
      player.roundsPlayed += 1;
    } else {
      // Evaluate frequency slider guess
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
      player.roundsPlayed += 1;
    }

    return true;
  }

  allPlayersSubmitted(room: ServerRoom): boolean {
    const active = Array.from(room.players.values()).filter(p => p.connected);
    if (active.length === 0) return false;
    return active.every(p => !!p.currentRoundSubmission);
  }

  evaluateRoundResults(room: ServerRoom): void {
    if (room.roundTimer) {
      clearTimeout(room.roundTimer);
      room.roundTimer = undefined;
    }
    if (!room.currentRound) return;

    const activePlayers = Array.from(room.players.values()).filter(p => p.connected && p.currentRoundSubmission);
    if (activePlayers.length === 0) return;

    
    let winnerId: string | undefined = undefined;
    let winnerName: string | undefined = undefined;

    if (room.gameMode === 'notes') {
      // Winner: highest score points, then lowest response time
      let highestPoints = -1;
      let fastestTime = Infinity;

      activePlayers.forEach(p => {
        const sub = p.currentRoundSubmission!;
        if (sub.pointsEarned > highestPoints) {
          highestPoints = sub.pointsEarned;
          fastestTime = sub.responseTimeMs;
          winnerId = p.id;
          winnerName = p.name;
        } else if (sub.pointsEarned === highestPoints && sub.responseTimeMs < fastestTime) {
          fastestTime = sub.responseTimeMs;
          winnerId = p.id;
          winnerName = p.name;
        }
      });
    } else {
      // Frequency mode: lowest absolute deviationHz
      let bestDeviation = Infinity;
      activePlayers.forEach(p => {
        const dev = Math.abs(p.currentRoundSubmission!.deviationHz ?? Infinity);
        if (dev < bestDeviation) {
          bestDeviation = dev;
          winnerId = p.id;
          winnerName = p.name;
        }
      });
    }

    // Mark winner in players submission
    activePlayers.forEach(p => {
      if (p.id === winnerId) {
        p.currentRoundSubmission!.isRoundWinner = true;
        p.roundsWon += 1;
      } else {
        p.currentRoundSubmission!.isRoundWinner = false;
      }
    });

    const roundData = {
      roundNumber: room.currentRound.roundNumber,
      targetHz: room.currentRound.targetHz,
      noteAnalysis: room.currentRound.noteAnalysis,
      winnerPlayerId: winnerId,
      winnerPlayerName: winnerName,
      submissions: Array.from(room.players.values()).map(p => ({
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
    };

    room.roundHistory.push(roundData);
    
    // Even the last round must show its detailed comparison before the final leaderboard.
    room.status = 'round_result';
  }

  getPublicRoomState(room: ServerRoom, revealTarget: boolean = false) {
    const playersList = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isHost: p.isHost,
      score: p.score,
      totalAccuracy: p.roundsPlayed > 0 ? Math.round((p.totalAccuracy / p.roundsPlayed) * 10) / 10 : 0,
      averageDeviationHz: p.roundsPlayed > 0 ? Math.round((p.totalDeviationHz / p.roundsPlayed) * 10) / 10 : 0,
      roundsPlayed: p.roundsPlayed,
      roundsWon: p.roundsWon,
      hasSubmitted: !!p.currentRoundSubmission,
      currentRoundSubmission: (revealTarget || room.status === 'round_result' || room.status === 'game_over') ? p.currentRoundSubmission : undefined,
      isReady: p.isReady,
      connected: p.connected
    })).sort((a, b) => b.score - a.score || b.roundsWon - a.roundsWon || a.name.localeCompare(b.name));

    const topPlayers = playersList.filter(player =>
      player.score === playersList[0]?.score && player.roundsWon === playersList[0]?.roundsWon
    );
    const finalResult = room.status === 'game_over'
      ? room.winnerByAbandonmentId
        ? { winnerPlayerId: room.winnerByAbandonmentId, isDraw: false }
        : { winnerPlayerId: topPlayers.length === 1 ? topPlayers[0].id : undefined, isDraw: topPlayers.length > 1 }
      : undefined;

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
      serverTime: Date.now(),
      abandonedByName: room.abandonedByName,
      winnerByAbandonmentId: room.winnerByAbandonmentId,
      finalResult,
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
        // Plain Hz is only sent once the round is scored — never while a guess is still possible.
        targetHz: (revealTarget || room.status === 'round_result' || room.status === 'game_over') ? room.currentRound.targetHz : undefined,
        // While playing, the client needs the exact Hz to synthesize the tone locally. It's sent
        // obfuscated (see src/shared/utils/frequencyObfuscation.ts) instead of as a plain,
        // copy-pasteable number in the WS frame.
        encodedTargetHz: room.status === 'playing'
          ? encodeTargetHz(room.currentRound.targetHz, room.id, room.currentRound.roundNumber)
          : undefined
      } : null,
      roundHistory: room.roundHistory
    };
  }

  getActiveRoomsList() {
    return Array.from(this.rooms.values())
      .filter(r => r.status === 'lobby' || r.status === 'playing')
      .map(r => ({
        id: r.id,
        name: r.name,
        gameMode: r.gameMode,
        playerCount: r.players.size,
        status: r.status,
        totalRounds: r.totalRounds
      }));
  }
}

export const roomManager = new RoomManager();
