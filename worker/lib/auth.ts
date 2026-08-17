export interface PlayerTokenPayload {
  playerId: string;
  exp: number;
}

export interface PlayerAuthState {
  revokedAt: number | null;
  deletedAt: number | null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage
  );
}

export async function issuePlayerToken(
  playerId: string,
  secret: string,
  now = Date.now(),
  ttlMs = 30 * 24 * 60 * 60 * 1000
): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify({ playerId, exp: now + ttlMs } satisfies PlayerTokenPayload));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await importHmacKey(secret, ['sign']), payload));
  return `${toBase64Url(payload)}.${toBase64Url(signature)}`;
}

export async function verifyPlayerToken(token: string, secret: string, now = Date.now()): Promise<PlayerTokenPayload | null> {
  const [encodedPayload, encodedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra.length > 0) return null;

  const payload = fromBase64Url(encodedPayload);
  const signature = fromBase64Url(encodedSignature);
  if (!payload || !signature) return null;

  const validSignature = await crypto.subtle.verify('HMAC', await importHmacKey(secret, ['verify']), signature, payload);
  if (!validSignature) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as Partial<PlayerTokenPayload>;
    return typeof parsed.playerId === 'string' && typeof parsed.exp === 'number' && parsed.exp > now
      ? { playerId: parsed.playerId, exp: parsed.exp }
      : null;
  } catch {
    return null;
  }
}

export function canAuthenticatePlayer({ revokedAt, deletedAt }: PlayerAuthState): boolean {
  return revokedAt === null && deletedAt === null;
}
