export interface SoloSessionRequest {
  difficultyLevel: number;
  totalRounds: number;
  idempotencyKey: string;
}

export interface SoloCompletionRequest {
  answers: unknown[];
  idempotencyKey: string;
}

export interface RankingCursor {
  score: number;
  accuracy: number;
  durationMs: number;
  completedAt: number;
  playerId: string;
}

export interface SoloLeaderboardRow {
  player_id: string;
  display_name: string;
  score: number;
  accuracy: number;
  duration_ms: number;
  completed_at: number;
}

export interface SoloLeaderboardQuery {
  sql: string;
  values: unknown[];
  limit: number;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,128}$/;

function readIdempotencyKey(value: unknown): string | null {
  return typeof value === 'string' && IDEMPOTENCY_KEY.test(value) ? value : null;
}

export function parseSoloSessionRequest(value: unknown): SoloSessionRequest | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const idempotencyKey = readIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey || typeof body.difficultyLevel !== 'number' || typeof body.totalRounds !== 'number') return null;
  if (!Number.isInteger(body.difficultyLevel) || body.difficultyLevel < 1 || body.difficultyLevel > 20) return null;
  if (!Number.isInteger(body.totalRounds) || body.totalRounds < 5 || body.totalRounds > 20) return null;
  return { difficultyLevel: body.difficultyLevel, totalRounds: body.totalRounds, idempotencyKey };
}

export function parseSoloCompletionRequest(value: unknown): SoloCompletionRequest | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const idempotencyKey = readIdempotencyKey(body.idempotencyKey);
  if (!idempotencyKey || !Array.isArray(body.answers)) return null;
  if ('score' in body || 'accuracy' in body || 'durationMs' in body) return null;
  return { answers: body.answers, idempotencyKey };
}

function toBase64Url(value: string): string {
  return btoa(unescape(encodeURIComponent(value))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

export function encodeRankingCursor(cursor: RankingCursor): string {
  return toBase64Url(JSON.stringify(cursor));
}

export function decodeRankingCursor(value: string): RankingCursor | null {
  const decoded = fromBase64Url(value);
  if (!decoded) return null;
  try {
    const cursor = JSON.parse(decoded) as Partial<RankingCursor>;
    if (
      typeof cursor.score !== 'number' || !Number.isFinite(cursor.score)
      || typeof cursor.accuracy !== 'number' || !Number.isFinite(cursor.accuracy)
      || typeof cursor.durationMs !== 'number' || !Number.isFinite(cursor.durationMs) || cursor.durationMs < 0
      || typeof cursor.completedAt !== 'number' || !Number.isFinite(cursor.completedAt)
      || typeof cursor.playerId !== 'string' || cursor.playerId.length === 0
    ) return null;
    return cursor as RankingCursor;
  } catch {
    return null;
  }
}

function clampLeaderboardLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 25;
  return Math.min(Math.max(Math.floor(limit), 1), 100);
}

/** Builds the D1 query using the exact same tuple used by the opaque cursor. */
export function buildSoloLeaderboardQuery(input: {
  mode: string;
  difficultyLevel: number;
  limit?: number;
  cursor?: string | null;
}): SoloLeaderboardQuery {
  const limit = clampLeaderboardLimit(input.limit ?? 25);
  const cursor = input.cursor ? decodeRankingCursor(input.cursor) : null;
  if (input.cursor && !cursor) throw new Error('Cursor de ranking no válido.');

  const cursorPredicate = cursor
    ? `AND (
         score < ?
         OR (score = ? AND accuracy < ?)
         OR (score = ? AND accuracy = ? AND duration_ms > ?)
         OR (score = ? AND accuracy = ? AND duration_ms = ? AND completed_at > ?)
         OR (score = ? AND accuracy = ? AND duration_ms = ? AND completed_at = ? AND player_id > ?)
       )`
    : '';
  const cursorValues = cursor
    ? [
      cursor.score,
      cursor.score, cursor.accuracy,
      cursor.score, cursor.accuracy, cursor.durationMs,
      cursor.score, cursor.accuracy, cursor.durationMs, cursor.completedAt,
      cursor.score, cursor.accuracy, cursor.durationMs, cursor.completedAt, cursor.playerId
    ]
    : [];

  return {
    sql: `WITH ranked_attempts AS (
      SELECT p.id AS player_id, p.display_name, a.score, a.accuracy, a.duration_ms, a.completed_at,
             ROW_NUMBER() OVER (
               PARTITION BY a.player_id
               ORDER BY a.score DESC, a.accuracy DESC, a.duration_ms ASC, a.completed_at ASC, a.id ASC
             ) AS attempt_rank
      FROM solo_attempts a
      JOIN players p ON p.id = a.player_id
      WHERE a.mode = ? AND a.difficulty_level = ? AND a.is_valid = 1
    )
    SELECT player_id, display_name, score, accuracy, duration_ms, completed_at
    FROM ranked_attempts
    WHERE attempt_rank = 1
    ${cursorPredicate}
    ORDER BY score DESC, accuracy DESC, duration_ms ASC, completed_at ASC, player_id ASC
    LIMIT ?`,
    values: [input.mode, input.difficultyLevel, ...cursorValues, limit + 1],
    limit
  };
}

export function createSoloLeaderboardPage(rows: SoloLeaderboardRow[], limit: number): {
  entries: Array<Omit<SoloLeaderboardRow, 'player_id'> & { rank: number }>;
  nextCursor: string | null;
} {
  const entries = rows.slice(0, limit).map(({ player_id: _playerId, ...entry }, index) => ({ rank: index + 1, ...entry }));
  const lastRow = rows.length > limit ? rows[limit - 1] : null;
  return {
    entries,
    nextCursor: lastRow
      ? encodeRankingCursor({
        score: lastRow.score,
        accuracy: lastRow.accuracy,
        durationMs: lastRow.duration_ms,
        completedAt: lastRow.completed_at,
        playerId: lastRow.player_id
      })
      : null
  };
}
