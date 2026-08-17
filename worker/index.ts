import { normalizeDisplayName, validateDisplayName } from './lib/identity';
import { calculateSoloResult } from './lib/soloScore';
import {
  buildSoloLeaderboardQuery,
  createSoloLeaderboardPage,
  decodeRankingCursor,
  parseSoloCompletionRequest,
  parseSoloSessionRequest,
  type SoloLeaderboardRow
} from './lib/contracts';
import { DuelRoom } from './duel/DuelRoom';
import type { DurableObjectNamespace } from './lib/workersTypes';

interface D1Result<T> {
  results: T[];
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  batch(statements: D1Statement[]): Promise<unknown>;
  prepare(query: string): D1Statement;
}

interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY: string;
  PLAYER_TOKEN_SECRET: string;
  DUEL_ROOMS: DurableObjectNamespace;
}

export { DuelRoom };


interface SoloSessionRow {
  id: string;
  player_id: string;
  difficulty_level: number;
  targets_json: string;
  started_at: number;
  expires_at: number;
  status: 'active' | 'completed' | 'expired';
}

interface CompletedSoloAttempt {
  score: number;
  accuracy: number;
  duration_ms: number;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const ALLOWED_MODES = new Set(['frequency', 'notes']);
const SOLO_SESSION_DURATION_MS = 30 * 60 * 1000;
const MINIMUM_ROUND_DURATION_MS = 750;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

async function validateTurnstile(token: unknown, request: Request, env: Env): Promise<boolean> {
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;

  const formData = new FormData();
  formData.append('secret', env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  const remoteIp = request.headers.get('CF-Connecting-IP');
  if (remoteIp) formData.append('remoteip', remoteIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData
  });
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function getPlayerIdFromAuthorization(request: Request, secret: string): Promise<string | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const [encodedPayload, encodedSignature, ...extra] = authorization.slice(7).split('.');
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null;

  const payload = fromBase64Url(encodedPayload);
  const signature = fromBase64Url(encodedSignature);
  if (!payload || !signature) return null;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  if (!await crypto.subtle.verify('HMAC', key, signature, payload)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as { playerId?: unknown; exp?: unknown };
    return typeof parsed.playerId === 'string' && typeof parsed.exp === 'number' && parsed.exp > Date.now()
      ? parsed.playerId
      : null;
  } catch {
    return null;
  }
}

function generateTargets(difficulty: number, totalRounds: number): number[] {
  const minHz = Math.max(20, 20 * difficulty);
  const maxHz = Math.min(20_000, 1_000 + difficulty * 950);
  return Array.from({ length: totalRounds }, () => {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const ratio = random[0] / 0xffffffff;
    return Math.round(minHz * Math.pow(maxHz / minHz, ratio) * 10) / 10;
  });
}

function toleranceForDifficulty(difficulty: number): number {
  return Math.max(5, 35 - difficulty);
}

async function idempotentSessionId(playerId: string, idempotencyKey: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${playerId}:${idempotencyKey}`)));
  const hex = [...bytes.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function issuePlayerToken(playerId: string, secret: string): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ playerId, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return `${toBase64Url(payload)}.${toBase64Url(signature)}`;
}

async function createPlayer(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as { displayName?: unknown; turnstileToken?: unknown } | null;
  const validation = validateDisplayName(body?.displayName);
  if (!validation.valid) return json({ error: validation.reason }, 400);

  if (!await validateTurnstile(body?.turnstileToken, request, env)) {
    return json({ error: 'No se pudo verificar que eres una persona.' }, 403);
  }

  const playerId = crypto.randomUUID();
  const displayName = (body?.displayName as string).trim().normalize('NFC');
  const normalizedName = normalizeDisplayName(displayName);

  try {
    await env.DB.prepare(
      'INSERT INTO players (id, display_name, display_name_normalized, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(playerId, displayName, normalizedName, Date.now(), Date.now()).run();
  } catch {
    return json({ error: 'Ese alias ya está en uso.' }, 409);
  }

  return json({ playerId, displayName, token: await issuePlayerToken(playerId, env.PLAYER_TOKEN_SECRET) }, 201);
}

async function getSoloLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'frequency';
  const difficultyLevel = Number(url.searchParams.get('difficulty') || 1);
  const limit = Number(url.searchParams.get('limit') || 25);
  const cursor = url.searchParams.get('cursor');
  if (!ALLOWED_MODES.has(mode)) return json({ error: 'Modo no v?lido.' }, 400);
  if (!Number.isInteger(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 20) {
    return json({ error: 'Dificultad no v?lida.' }, 400);
  }
  if (cursor && !decodeRankingCursor(cursor)) return json({ error: 'Cursor no v?lido.' }, 400);

  const query = buildSoloLeaderboardQuery({ mode, difficultyLevel, limit, cursor });
  const result = await env.DB.prepare(query.sql).bind(...query.values).all<SoloLeaderboardRow>();
  return json(createSoloLeaderboardPage(result.results, query.limit));
}

async function startSoloSession(request: Request, env: Env): Promise<Response> {
  const playerId = await getPlayerIdFromAuthorization(request, env.PLAYER_TOKEN_SECRET);
  if (!playerId) return json({ error: 'Sesión de jugador no válida.' }, 401);

  const body = parseSoloSessionRequest(await request.json().catch(() => null));
  if (!body) return json({ error: 'La solicitud de sesión no es válida.' }, 400);
  const { difficultyLevel: difficulty, totalRounds } = body;

  const now = Date.now();
  const sessionId = await idempotentSessionId(playerId, body.idempotencyKey, env.PLAYER_TOKEN_SECRET);
  const replay = await env.DB.prepare(
    'SELECT id, player_id, difficulty_level, targets_json, started_at, expires_at, status FROM solo_sessions WHERE id = ? AND player_id = ?'
  ).bind(sessionId, playerId).first<SoloSessionRow>();
  if (replay) {
    const targets = JSON.parse(replay.targets_json) as number[];
    return json({ sessionId: replay.id, mode: 'frequency', difficultyLevel: replay.difficulty_level, totalRounds: targets.length, targets, expiresAt: replay.expires_at });
  }
  const activeSession = await env.DB.prepare(
    "SELECT id FROM solo_sessions WHERE player_id = ? AND status = 'active' AND expires_at > ? LIMIT 1"
  ).bind(playerId, now).first<{ id: string }>();
  if (activeSession) return json({ error: 'Ya tienes una sesión de ranking activa.' }, 409);

  const targets = generateTargets(difficulty, totalRounds);
  await env.DB.prepare(
    'INSERT INTO solo_sessions (id, player_id, mode, difficulty_level, targets_json, started_at, expires_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(sessionId, playerId, 'frequency', difficulty, JSON.stringify(targets), now, now + SOLO_SESSION_DURATION_MS, 'active').run();

  return json({ sessionId, mode: 'frequency', difficultyLevel: difficulty, totalRounds, targets, expiresAt: now + SOLO_SESSION_DURATION_MS }, 201);
}

async function completeSoloSession(request: Request, env: Env, sessionId: string): Promise<Response> {
  const playerId = await getPlayerIdFromAuthorization(request, env.PLAYER_TOKEN_SECRET);
  if (!playerId) return json({ error: 'Sesión de jugador no válida.' }, 401);

  const session = await env.DB.prepare(
    'SELECT id, player_id, difficulty_level, targets_json, started_at, expires_at, status FROM solo_sessions WHERE id = ? AND player_id = ?'
  ).bind(sessionId, playerId).first<SoloSessionRow>();
  if (!session) return json({ error: 'Sesión de ranking no encontrada.' }, 404);

  const body = parseSoloCompletionRequest(await request.json().catch(() => null));
  if (!body) return json({ error: 'Debes enviar respuestas y una clave de idempotencia, sin métricas calculadas por cliente.' }, 400);
  if (session.status === 'completed') {
    const replay = await env.DB.prepare(
      'SELECT score, accuracy, duration_ms FROM solo_attempts WHERE session_id = ?'
    ).bind(session.id).first<CompletedSoloAttempt>();
    if (replay) return json({ sessionId: session.id, score: replay.score, accuracy: replay.accuracy, durationMs: replay.duration_ms, ranked: true });
    return json({ error: 'El cierre de sesión está incompleto.' }, 409);
  }
  if (session.status !== 'active') return json({ error: 'La sesión ya fue finalizada.' }, 409);

  const now = Date.now();
  if (session.expires_at <= now) {
    await env.DB.prepare("UPDATE solo_sessions SET status = 'expired' WHERE id = ?").bind(session.id).run();
    return json({ error: 'La sesión de ranking expiró.' }, 410);
  }

  let targets: number[];
  try { targets = JSON.parse(session.targets_json) as number[]; } catch { return json({ error: 'La sesión está corrupta.' }, 500); }
  if (now - session.started_at < targets.length * MINIMUM_ROUND_DURATION_MS) {
    return json({ error: 'La sesión terminó demasiado rápido para ser válida.' }, 422);
  }

  let result;
  try {
    result = calculateSoloResult(targets, body.answers, toleranceForDifficulty(session.difficulty_level));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Resultado no válido.' }, 400);
  }

  const durationMs = now - session.started_at;
  await env.DB.batch([
    env.DB.prepare("UPDATE solo_sessions SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'active'").bind(now, session.id),
    env.DB.prepare(
      'INSERT INTO solo_attempts (id, player_id, mode, difficulty, score, accuracy, duration_ms, ruleset_version, is_valid, completed_at, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), playerId, 'frequency', String(session.difficulty_level), result.score, result.accuracy, durationMs, 'v1', 1, now, session.id)
  ]);

  return json({ sessionId: session.id, score: result.score, accuracy: result.accuracy, durationMs, ranked: true });
}

// Unambiguous alphabet (no 0/O, 1/I) so a spoken/typed room code can't be misheard.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;
const ROOM_CODE_CREATE_ATTEMPTS = 3;

function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

/** Creates a duel room: picks an unused short code (retrying on the astronomically rare
 * collision), then forwards the client's request body/headers — including any
 * Authorization bearer token — to that Durable Object's /init. */
async function createDuelRoom(request: Request, env: Env): Promise<Response> {
  for (let attempt = 0; attempt < ROOM_CODE_CREATE_ATTEMPTS; attempt++) {
    const roomId = generateRoomCode();
    const stub = env.DUEL_ROOMS.get(env.DUEL_ROOMS.idFromName(roomId));
    const existsResponse = await stub.fetch(new Request('https://duel-room/exists'));
    const { exists } = (await existsResponse.json()) as { exists: boolean };
    if (exists) continue;

    const initRequest = new Request(`https://duel-room/init?roomId=${roomId}`, request);
    return stub.fetch(initRequest);
  }
  return json({ error: 'No se pudo generar un código de sala disponible. Probá de nuevo.' }, 503);
}

function joinDuelRoom(request: Request, env: Env, roomId: string): Promise<Response> {
  const stub = env.DUEL_ROOMS.get(env.DUEL_ROOMS.idFromName(roomId.toUpperCase()));
  const joinRequest = new Request('https://duel-room/join', request);
  return stub.fetch(joinRequest);
}

/** Forwards a WebSocket upgrade to the room's Durable Object, rewriting only the URL
 * (the Upgrade/Connection/Sec-WebSocket-* headers and method come along via the `request`
 * init-clone) so DuelRoom's router sees a plain `/ws` path regardless of the public
 * route shape. */
function forwardDuelWebSocket(request: Request, env: Env, roomId: string): Promise<Response> {
  const stub = env.DUEL_ROOMS.get(env.DUEL_ROOMS.idFromName(roomId.toUpperCase()));
  const forwardUrl = new URL('https://duel-room/ws');
  forwardUrl.search = new URL(request.url).search;
  return stub.fetch(new Request(forwardUrl.toString(), request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') return json({ status: 'ok' });
    if (request.method === 'GET' && url.pathname === '/api/rankings/solo') return getSoloLeaderboard(request, env);
    if (request.method === 'POST' && url.pathname === '/api/players') return createPlayer(request, env);
    if (request.method === 'POST' && url.pathname === '/api/solo-sessions') return startSoloSession(request, env);
    const completionMatch = url.pathname.match(/^\/api\/solo-sessions\/([0-9a-f-]{36})\/complete$/i);
    if (request.method === 'POST' && completionMatch) return completeSoloSession(request, env, completionMatch[1]);

    if (request.method === 'POST' && url.pathname === '/api/duel/rooms') return createDuelRoom(request, env);
    const duelRoomMatch = url.pathname.match(/^\/api\/duel\/rooms\/([A-Z0-9]{3,12})$/i);
    if (request.method === 'POST' && duelRoomMatch) return joinDuelRoom(request, env, duelRoomMatch[1]);
    const duelWsMatch = url.pathname.match(/^\/api\/duel\/rooms\/([A-Z0-9]{3,12})\/ws$/i);
    if (duelWsMatch) return forwardDuelWebSocket(request, env, duelWsMatch[1]);

    if (url.pathname.startsWith('/api/')) return json({ error: 'Ruta no encontrada.' }, 404);

    return new Response('AudioFit Cloudflare Worker foundation is active.', { status: 200 });
  }
};
