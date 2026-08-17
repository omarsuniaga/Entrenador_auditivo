/**
 * WebSocket Handler
 * Attaches to HTTP server, parses incoming player actions and broadcasts authoritative state.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { roomManager, ServerRoom } from './roomManager';
import { encodeTargetHz } from '../src/shared/utils/frequencyObfuscation';

const MAX_PAYLOAD_BYTES = 8 * 1024; // generous for our small JSON control messages
const HEARTBEAT_INTERVAL_MS = 30000;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 30;

type HeartbeatWs = WebSocket & { isAlive?: boolean };

function isAllowedOrigin(origin: string | undefined, host: string | undefined): boolean {
  // Non-browser clients (server-to-server, test scripts) typically send no Origin header
  // at all — a browser can never forge its absence, so this stays permissive for them
  // without weakening the check that actually matters: a browser tab on another site
  // cannot open a cross-site WebSocket to us (CSWSH) because its Origin won't match.
  if (!origin) return true;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sanitizeString(value: unknown, maxLength: number, fallback: string = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || fallback;
}

export function setupWebSocketServer(server: any) {
  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: MAX_PAYLOAD_BYTES,
    verifyClient: (info: { origin: string; req: IncomingMessage }, callback: (res: boolean, code?: number, message?: string) => void) => {
      if (isAllowedOrigin(info.req.headers.origin, info.req.headers.host)) {
        callback(true);
      } else {
        callback(false, 403, 'Forbidden origin');
      }
    }
  });

  function broadcastRoom(room: ServerRoom, revealTarget = false) {
    const state = roomManager.getPublicRoomState(room, revealTarget);
    const payload = JSON.stringify({ type: 'ROOM_STATE', data: state });

    for (const player of room.players.values()) {
      if (player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(payload);
      }
    }
  }

  roomManager.setRoomStateListener((room) => broadcastRoom(room));

  // Heartbeat: a connection that dies without a clean FIN (phone sleep, dropped wifi)
  // never fires 'close' on its own, so a ghost player would otherwise sit as
  // connected:true forever and block allPlayersSubmitted() from ever resolving the room.
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as HeartbeatWs;
      if (ws.isAlive === false) {
        ws.terminate(); // triggers this socket's 'close' handler -> roomManager.removePlayer
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => clearInterval(heartbeatTimer));
  wss.on('error', (err) => console.error('WebSocketServer error:', err));

  wss.on('connection', (rawWs: WebSocket) => {
    const ws = rawWs as HeartbeatWs;
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('error', (err) => console.error('WebSocket connection error:', err));

    let currentRoomId: string | null = null;
    let currentPlayerId: string | null = null;

    // Per-connection message-rate limiter — an unbounded client can otherwise flood
    // JSON.parse and game-state mutations as fast as the socket allows.
    let windowStart = Date.now();
    let messagesInWindow = 0;

    ws.on('message', (raw: string) => {
      const now = Date.now();
      if (now - windowStart > RATE_LIMIT_WINDOW_MS) {
        windowStart = now;
        messagesInWindow = 0;
      }
      messagesInWindow++;
      if (messagesInWindow > RATE_LIMIT_MAX_MESSAGES) {
        ws.close(1008, 'Rate limit exceeded');
        return;
      }

      try {
        const message = JSON.parse(raw.toString());
        const { type, data } = message;

        switch (type) {
          case 'CREATE_ROOM': {
            const { totalRounds, playerId, gameMode, scaleType, tuningSystem, a4Reference } = data;
            const roomName = sanitizeString(data.roomName, 40);
            const hostName = sanitizeString(data.hostName, 30, 'Anfitrión');
            const avatar = sanitizeString(data.avatar, 8);
            currentPlayerId = sanitizeString(playerId, 64) || `p_${Date.now()}`;
            const room = roomManager.createRoom(
              roomName,
              { id: currentPlayerId, name: hostName, avatar, ws },
              totalRounds,
              { gameMode, scaleType, tuningSystem, a4Reference }
            );
            currentRoomId = room.id;
            const hostPlayer = room.players.get(currentPlayerId);

            ws.send(JSON.stringify({
              type: 'ROOM_CREATED',
              data: { roomId: room.id, playerId: currentPlayerId, sessionToken: hostPlayer?.sessionToken }
            }));
            broadcastRoom(room);
            break;
          }

          case 'UPDATE_ROOM_SETTINGS': {
            if (!currentRoomId || !currentPlayerId) return;
            const ok = roomManager.updateRoomSettings(currentRoomId, currentPlayerId, data);
            if (ok) {
              const room = roomManager.getRoom(currentRoomId);
              if (room) broadcastRoom(room);
            }
            break;
          }

          case 'JOIN_ROOM': {
            const { playerId, sessionToken } = data;
            const roomId = sanitizeString(data.roomId, 12);
            const playerName = sanitizeString(data.playerName, 30, 'Jugador');
            const avatar = sanitizeString(data.avatar, 8);
            currentPlayerId = sanitizeString(playerId, 64) || `p_${Date.now()}`;
            const room = roomManager.joinRoom(roomId, { id: currentPlayerId, name: playerName, avatar, ws, sessionToken });

            if (!room) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'No se pudo unir a la sala. Verifica el código, si ya comenzó, o si esa sesión pertenece a otro dispositivo.'
              }));
              return;
            }

            currentRoomId = room.id;
            const joinedPlayer = room.players.get(currentPlayerId);
            ws.send(JSON.stringify({
              type: 'JOINED_ROOM',
              data: { roomId: room.id, playerId: currentPlayerId, sessionToken: joinedPlayer?.sessionToken }
            }));
            broadcastRoom(room);
            break;
          }

          case 'LEAVE_ROOM': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.leaveRoom(currentRoomId, currentPlayerId);
            currentRoomId = null;
            if (room) broadcastRoom(room);
            break;
          }

          case 'SET_READY': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;
            const player = room.players.get(currentPlayerId);
            if (player) {
              player.isReady = !!data.isReady;
              broadcastRoom(room);
            }
            break;
          }

          case 'START_MATCH': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room || !roomManager.canStartMatch(room, currentPlayerId)) {
              ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Se requieren al menos dos jugadores conectados y listos para iniciar el duelo.'
              }));
              return;
            }

            room.status = 'countdown';
            broadcastRoom(room);

            // 3 second countdown before first round
            setTimeout(() => {
              roomManager.startRound(room, (r) => {
                broadcastRoom(r, true);
              });
              broadcastRoom(room);
            }, 3000);
            break;
          }

          case 'SUBMIT_GUESS': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room) return;

            const { userHz, responseTimeMs, guessedNoteIndex, guessedOctave } = data;
            const ok = roomManager.submitGuess(room, currentPlayerId, {
              userHz,
              responseTimeMs,
              guessedNoteIndex,
              guessedOctave
            });

            if (ok) {
              // Check if all players have submitted
              if (roomManager.allPlayersSubmitted(room)) {
                roomManager.evaluateRoundResults(room);
                broadcastRoom(room, true);
              } else {
                broadcastRoom(room, false);
              }
            }
            break;
          }

          case 'NEXT_ROUND': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room || room.hostId !== currentPlayerId) return;

            if (room.status === 'round_result') {
              if (room.currentRoundNumber >= room.totalRounds) {
                room.status = 'game_over';
              } else {
                roomManager.startRound(room, (r) => {
                  broadcastRoom(r, true);
                });
              }
              broadcastRoom(room);
            }
            break;
          }

          case 'RESTART_GAME': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room || room.hostId !== currentPlayerId) return;

            room.status = 'lobby';
            room.currentRoundNumber = 0;
            room.roundHistory = [];
            room.currentRound = undefined;
            room.abandonedByName = undefined;
            room.winnerByAbandonmentId = undefined;
            for (const p of room.players.values()) {
              p.score = 0;
              p.totalAccuracy = 0;
              p.roundsPlayed = 0;
              p.currentRoundSubmission = undefined;
            }
            broadcastRoom(room);
            break;
          }

          case 'PLAY_SYNC_TARGET': {
            if (!currentRoomId || !currentPlayerId) return;
            const room = roomManager.getRoom(currentRoomId);
            if (!room || !room.currentRound || room.status !== 'playing') return;

            // Broadcast scheduled audio playback to all connected room members.
            // Hz is obfuscated in transit — see src/shared/utils/frequencyObfuscation.ts.
            const scheduledPlayTime = Date.now() + 500; // 500ms future scheduled time
            const payload = JSON.stringify({
              type: 'SYNC_PLAY_AUDIO',
              data: {
                roomId: room.id,
                roundNumber: room.currentRound.roundNumber,
                encodedTargetHz: encodeTargetHz(room.currentRound.targetHz, room.id, room.currentRound.roundNumber),
                durationMs: room.currentRound.audioDurationMs || 2500,
                scheduledPlayTime
              }
            });

            for (const player of room.players.values()) {
              if (player.ws && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(payload);
              }
            }
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({
              type: 'PONG',
              data: {
                clientTimestamp: data?.clientTimestamp,
                serverTimestamp: Date.now()
              }
            }));
            break;
          }
        }
      } catch (err) {
        console.error('WebSocket message parsing error:', err);
      }
    });

    ws.on('close', () => {
      const removed = roomManager.removePlayer(ws);
      if (removed) {
        broadcastRoom(removed.room);
      }
    });
  });

  return wss;
}
