/**
 * Durable Object: DuelRoom
 * One instance per active duel room (addressed via env.DUEL_ROOMS.idFromName(roomCode)).
 * Owns the room's WebSocket connections (via the Hibernation API — the DO can be evicted
 * from memory while sockets stay open, waking on message/close/alarm), its persisted
 * state, and the single alarm that drives round deadlines, the pre-round countdown, and
 * reconnection grace windows. All actual game-rule decisions live in ./roomState.ts (pure
 * functions, unit-tested without a Workers runtime) — this class is the I/O adapter.
 */

import { verifyPlayerToken } from '../lib/auth';
import { encodeTargetHz } from '../../src/shared/utils/frequencyObfuscation';
import type { DurableObjectState } from '../lib/workersTypes';
import {
  DuelRoomState,
  DisconnectOutcome,
  createInitialRoom,
  joinRoom,
  updateRoomSettings,
  canStartMatch,
  beginCountdown,
  startRound,
  submitGuess,
  allPlayersSubmitted,
  evaluateRoundResults,
  advanceOrFinish,
  restartGame,
  markPlayerDisconnected,
  leaveRoom,
  finalizeExpiredDisconnects,
  nextAlarmTime,
  getPublicRoomState,
  buildDuelPersistenceRows
} from './roomState';

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
}

interface D1Database {
  batch(statements: D1Statement[]): Promise<unknown>;
  prepare(query: string): D1Statement;
}

interface Env {
  DB: D1Database;
  PLAYER_TOKEN_SECRET: string;
}

const MAX_MESSAGE_BYTES = 8 * 1024;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 30;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
}

export class DuelRoom {
  private state: DurableObjectState;
  private env: Env;
  private cachedRoom: DuelRoomState | null | undefined;
  private socketWindows = new WeakMap<WebSocket, { windowStart: number; count: number }>();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/exists') return this.handleExists();
    if (request.method === 'POST' && url.pathname === '/init') return this.handleInit(request);
    if (request.method === 'POST' && url.pathname === '/join') return this.handleJoin(request);
    if (url.pathname === '/ws') return this.handleWebSocketUpgrade(request);
    return json({ error: 'Ruta no encontrada.' }, 404);
  }

  // ---- Identity -----------------------------------------------------------

  /** A Bearer token proves the caller owns a real `players` row (the same anonymous
   * ranking identity solo sessions use) — only then can duel results reference them in
   * D1. Guests always get a server-generated id; the client never gets to claim one. */
  private async resolveIdentity(request: Request, guestId: string): Promise<{ playerId: string; authenticated: boolean }> {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const payload = await verifyPlayerToken(authHeader.slice(7), this.env.PLAYER_TOKEN_SECRET);
      if (payload) return { playerId: payload.playerId, authenticated: true };
    }
    return { playerId: guestId, authenticated: false };
  }

  // ---- Storage --------------------------------------------------------------

  private async loadRoom(): Promise<DuelRoomState | null> {
    if (this.cachedRoom !== undefined) return this.cachedRoom;
    const stored = (await this.state.storage.get<DuelRoomState>('room')) ?? null;
    this.cachedRoom = stored;
    return stored;
  }

  private async saveRoom(room: DuelRoomState): Promise<void> {
    this.cachedRoom = room;
    await this.state.storage.put('room', room);
  }

  private async clearRoom(): Promise<void> {
    this.cachedRoom = null;
    await this.state.storage.delete('room');
    await this.state.storage.deleteAlarm();
  }

  private async rescheduleAlarm(room: DuelRoomState): Promise<void> {
    const next = nextAlarmTime(room);
    if (next) await this.state.storage.setAlarm(next);
    else await this.state.storage.deleteAlarm();
  }

  // ---- REST-ish setup endpoints (called by worker/index.ts) -----------------

  private async handleExists(): Promise<Response> {
    const room = await this.loadRoom();
    return json({ exists: !!room });
  }

  private async handleInit(request: Request): Promise<Response> {
    if (await this.loadRoom()) return json({ error: 'La sala ya existe.' }, 409);

    // worker/index.ts picks the room code (it owns collision checking across DO
    // instances) and passes it via the URL, keeping the body free for player/settings.
    const roomId = sanitizeString(new URL(request.url).searchParams.get('roomId'), 12);
    if (!roomId) return json({ error: 'Falta el código de sala.' }, 400);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const identity = await this.resolveIdentity(request, crypto.randomUUID());
    const sessionToken = generateSessionToken();
    const room = createInitialRoom(
      {
        roomId,
        name: sanitizeString(body?.name, 40),
        hostId: identity.playerId,
        hostName: sanitizeString(body?.hostName, 30, 'Anfitrión'),
        hostAvatar: sanitizeString(body?.hostAvatar, 8) || undefined,
        hostAuthenticated: identity.authenticated,
        totalRounds: typeof body?.totalRounds === 'number' ? body.totalRounds : undefined,
        gameMode: body?.gameMode === 'notes' ? 'notes' : 'frequency',
        scaleType: body?.scaleType === 'diatonic' ? 'diatonic' : 'chromatic',
        tuningSystem: body?.tuningSystem === 'pythagorean' || body?.tuningSystem === 'just' ? body.tuningSystem : '12tet',
        a4Reference: typeof body?.a4Reference === 'number' ? body.a4Reference : undefined,
        now: Date.now()
      },
      sessionToken
    );

    await this.saveRoom(room);
    return json({ roomId: room.id, playerId: room.hostId, sessionToken, isHost: true });
  }

  private async handleJoin(request: Request): Promise<Response> {
    const room = await this.loadRoom();
    if (!room) return json({ error: 'La sala no existe.' }, 404);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const providedSessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken : undefined;
    const guestFallbackId = sanitizeString(body?.playerId, 64) || crypto.randomUUID();
    const identity = await this.resolveIdentity(request, guestFallbackId);

    const result = joinRoom(
      room,
      {
        playerId: identity.playerId,
        name: sanitizeString(body?.name, 30, 'Jugador'),
        avatar: sanitizeString(body?.avatar, 8) || undefined,
        sessionToken: providedSessionToken,
        authenticated: identity.authenticated
      },
      generateSessionToken()
    );

    if (!result.ok || !result.player) {
      const messages: Record<'room-in-progress' | 'seat-taken' | 'room-full', string> = {
        'room-in-progress': 'El duelo ya comenzó y no acepta más jugadores.',
        'seat-taken': 'Esa sesión pertenece a otro dispositivo.',
        'room-full': 'La sala ya tiene dos jugadores.'
      };
      return json({ error: messages[result.reason ?? 'room-in-progress'] }, 409);
    }

    await this.saveRoom(room);
    return json({ roomId: room.id, playerId: result.player.id, sessionToken: result.player.sessionToken, isHost: result.player.isHost });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Se esperaba una conexión WebSocket.' }, 426);

    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') ?? '';
    const sessionToken = url.searchParams.get('sessionToken') ?? '';
    const room = await this.loadRoom();
    if (!room) return json({ error: 'La sala no existe.' }, 404);
    const player = room.players[playerId];
    if (!player || player.sessionToken !== sessionToken) return json({ error: 'Sesión inválida para esta sala.' }, 403);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, [playerId]);

    player.connected = true;
    player.disconnectGraceExpiresAt = undefined;
    await this.saveRoom(room);
    await this.rescheduleAlarm(room);

    server.send(JSON.stringify({ type: 'ROOM_STATE', data: this.buildStatePayload(room, false) }));
    this.broadcast(room, playerId);

    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  // ---- WebSocket Hibernation API handlers ------------------------------------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return;
    if (!this.consumeRateLimit(ws)) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    const playerId = this.state.getTags(ws)[0];
    if (!playerId) return;

    let parsed: { type?: string; data?: Record<string, unknown> } | null;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    if (!parsed?.type) return;

    const room = await this.loadRoom();
    if (!room) return;
    const data = parsed.data ?? {};

    switch (parsed.type) {
      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG', data: { clientTimestamp: data.clientTimestamp, serverTimestamp: Date.now() } }));
        return;
      }

      case 'SET_READY': {
        const player = room.players[playerId];
        if (!player) return;
        player.isReady = !!data.isReady;
        await this.commitRoomChange(room);
        return;
      }

      case 'UPDATE_ROOM_SETTINGS': {
        if (!updateRoomSettings(room, playerId, data as any)) return;
        await this.commitRoomChange(room);
        return;
      }

      case 'START_MATCH': {
        if (!canStartMatch(room, playerId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Se requieren al menos dos jugadores conectados y listos para iniciar el duelo.' }));
          return;
        }
        beginCountdown(room, Date.now());
        await this.commitRoomChange(room);
        return;
      }

      case 'SUBMIT_GUESS': {
        const ok = submitGuess(
          room,
          playerId,
          { userHz: data.userHz as number | undefined, guessedNoteIndex: data.guessedNoteIndex as number | undefined, guessedOctave: data.guessedOctave as number | undefined },
          Date.now()
        );
        if (!ok) return;
        if (allPlayersSubmitted(room)) evaluateRoundResults(room);
        await this.commitRoomChange(room);
        return;
      }

      case 'NEXT_ROUND': {
        if (room.hostId !== playerId || room.status !== 'round_result') return;
        advanceOrFinish(room, Date.now());
        await this.commitRoomChange(room);
        return;
      }

      case 'RESTART_GAME': {
        if (room.hostId !== playerId) return;
        restartGame(room);
        await this.commitRoomChange(room);
        return;
      }

      case 'PLAY_SYNC_TARGET': {
        if (!room.currentRound || room.status !== 'playing') return;
        const payload = JSON.stringify({
          type: 'SYNC_PLAY_AUDIO',
          data: {
            roomId: room.id,
            roundNumber: room.currentRound.roundNumber,
            encodedTargetHz: encodeTargetHz(room.currentRound.targetHz, room.id, room.currentRound.roundNumber),
            durationMs: room.currentRound.audioDurationMs,
            scheduledPlayTime: Date.now() + 500
          }
        });
        for (const socket of this.state.getWebSockets()) {
          const tag = this.state.getTags(socket)[0];
          if (tag && room.players[tag]?.connected) this.safeSend(socket, payload);
        }
        return;
      }

      case 'LEAVE_ROOM': {
        leaveRoom(room, playerId);
        await this.commitRoomChange(room);
        ws.close(1000, 'left');
        return;
      }

      default:
        return;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.handleSocketGone(ws);
  }

  private async handleSocketGone(ws: WebSocket): Promise<void> {
    const playerId = this.state.getTags(ws)[0];
    if (!playerId) return;
    const room = await this.loadRoom();
    if (!room) return;
    const player = room.players[playerId];
    if (!player || !player.connected) return; // already handled — keeps this idempotent

    const outcome: DisconnectOutcome = markPlayerDisconnected(room, playerId, Date.now());
    if (outcome === 'room-empty') {
      await this.clearRoom();
      return;
    }
    if (outcome === 'no-op') return;
    await this.commitRoomChange(room);
  }

  // ---- Alarm: round deadlines, countdown, reconnection grace -----------------

  async alarm(): Promise<void> {
    const room = await this.loadRoom();
    if (!room) return;
    const now = Date.now();
    let changed = false;

    if (room.status === 'countdown' && room.countdownEndsAt && now >= room.countdownEndsAt) {
      startRound(room, now);
      changed = true;
    }
    if (room.status === 'playing' && room.currentRound && now >= room.currentRound.tuningDeadline) {
      evaluateRoundResults(room);
      changed = true;
    }
    if (finalizeExpiredDisconnects(room, now)) changed = true;

    if (!changed) return;
    await this.commitRoomChange(room);
  }

  // ---- Shared mutation epilogue ----------------------------------------------

  private async commitRoomChange(room: DuelRoomState): Promise<void> {
    if (room.status === 'game_over') await this.persistResultsIfNeeded(room);
    await this.saveRoom(room);
    await this.rescheduleAlarm(room);
    this.broadcast(room);
  }

  private async persistResultsIfNeeded(room: DuelRoomState): Promise<void> {
    if (room.resultsPersisted) return;
    const matchId = crypto.randomUUID();
    const rows = buildDuelPersistenceRows(room, matchId, Date.now());
    if (!rows) {
      // No authenticated participant — nothing we can legally write against the
      // `players` foreign key. Mark persisted so we don't retry every alarm tick.
      room.resultsPersisted = true;
      return;
    }
    try {
      await this.env.DB.batch([
        this.env.DB
          .prepare('INSERT INTO duel_matches (id, mode, status, winner_player_id, ruleset_version, completed_at, room_id, ended_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(rows.match.id, rows.match.mode, rows.match.status, rows.match.winnerPlayerId, rows.match.rulesetVersion, rows.match.completedAt, rows.match.roomId, rows.match.endedReason),
        ...rows.participants.map((p) =>
          this.env.DB
            .prepare('INSERT INTO duel_participants (match_id, player_id, score, rounds_won, accuracy, result, response_time_ms) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .bind(p.matchId, p.playerId, p.score, p.roundsWon, p.accuracy, p.result, p.responseTimeMs)
        )
      ]);
      room.resultsPersisted = true;
    } catch (error) {
      // Leave resultsPersisted=false: the next commitRoomChange (e.g. RESTART_GAME won't
      // happen from game_over, but a stray alarm tick before eviction will) retries.
      console.error('DuelRoom: failed to persist match results', error);
    }
  }

  // ---- Broadcast --------------------------------------------------------------

  private buildStatePayload(room: DuelRoomState, revealTarget: boolean) {
    const state = getPublicRoomState(room, revealTarget);
    if (state.currentRound && room.status === 'playing' && room.currentRound) {
      return {
        ...state,
        currentRound: {
          ...state.currentRound,
          encodedTargetHz: encodeTargetHz(room.currentRound.targetHz, room.id, room.currentRound.roundNumber)
        }
      };
    }
    return state;
  }

  private broadcast(room: DuelRoomState, skipPlayerId?: string): void {
    const payload = JSON.stringify({ type: 'ROOM_STATE', data: this.buildStatePayload(room, false) });
    for (const ws of this.state.getWebSockets()) {
      const tag = this.state.getTags(ws)[0];
      if (!tag || tag === skipPlayerId || !room.players[tag]?.connected) continue;
      this.safeSend(ws, payload);
    }
  }

  private safeSend(ws: WebSocket, payload: string): void {
    try {
      ws.send(payload);
    } catch {
      // Dead socket — the Hibernation API will surface its close separately.
    }
  }

  private consumeRateLimit(ws: WebSocket): boolean {
    const now = Date.now();
    const existing = this.socketWindows.get(ws);
    if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.socketWindows.set(ws, { windowStart: now, count: 1 });
      return true;
    }
    existing.count += 1;
    return existing.count <= RATE_LIMIT_MAX_MESSAGES;
  }
}
