const RESERVED_NAMES = new Set([
  'admin', 'administrator', 'audiofit', 'cloudflare', 'moderador', 'moderator',
  'null', 'root', 'soporte', 'support', 'system', 'sistema'
]);

const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}_-]{3,16}$/u;

export function normalizeDisplayName(displayName: string): string {
  return displayName.trim().normalize('NFC').toLocaleLowerCase('es');
}

export function validateDisplayName(displayName: unknown): { valid: boolean; reason?: string } {
  if (typeof displayName !== 'string') return { valid: false, reason: 'El alias es obligatorio.' };

  const normalized = normalizeDisplayName(displayName);
  if (!DISPLAY_NAME_PATTERN.test(normalized)) {
    return { valid: false, reason: 'El alias debe tener 3 a 16 caracteres: letras, números, guion o guion bajo.' };
  }
  if (RESERVED_NAMES.has(normalized)) {
    return { valid: false, reason: 'Ese alias está reservado.' };
  }

  return { valid: true };
}
