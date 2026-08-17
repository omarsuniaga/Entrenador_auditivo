/**
 * Lightweight obfuscation for the multiplayer target frequency in flight.
 *
 * This is NOT cryptographic security: the room id and round number needed to derive
 * the keystream are public (visible to anyone in the room, or via /api/rooms), and the
 * decode function ships in the client bundle. Its only job is to stop the trivial case —
 * glancing at the WS frame in devtools and reading the answer as a plain number — by
 * requiring an extra step to recover it. A player who wants to reverse-engineer the
 * client-side decode can still do so; that is an inherent limitation of synthesizing the
 * target tone in the browser instead of streaming server-rendered audio.
 */

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function encodeTargetHz(hz: number, roomId: string, roundNumber: number): string {
  const key = fnv1aHash(`${roomId}:${roundNumber}`);
  const scaled = Math.round(hz * 100) >>> 0;
  return ((scaled ^ key) >>> 0).toString(36);
}

export function decodeTargetHz(encoded: string, roomId: string, roundNumber: number): number {
  const key = fnv1aHash(`${roomId}:${roundNumber}`);
  const scaled = (parseInt(encoded, 36) ^ key) >>> 0;
  return scaled / 100;
}
