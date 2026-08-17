import { existsSync, readFileSync } from 'node:fs';
import { normalizeDisplayName, validateDisplayName } from '../worker/lib/identity.ts';
import { calculateSoloResult } from '../worker/lib/soloScore.ts';
import { canAuthenticatePlayer, issuePlayerToken, verifyPlayerToken } from '../worker/lib/auth.ts';
import { consumeRateLimit } from '../worker/lib/rateLimit.ts';
import {
  buildSoloLeaderboardQuery,
  createSoloLeaderboardPage,
  decodeRankingCursor,
  encodeRankingCursor,
  parseSoloCompletionRequest,
  parseSoloSessionRequest
} from '../worker/lib/contracts.ts';
import { buildRankingUrl } from '../src/infrastructure/ranking/CloudflareRankingApi.ts';
import { validateCloudflareDeploymentConfig } from '../worker/lib/deploymentConfig.ts';
import { validateCloudflareLocalPreflight, validateMigrationFiles } from '../worker/lib/deploymentPreflight.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function readMigration(name: string): string {
  const path = new URL(`../migrations/${name}`, import.meta.url);
  assert(existsSync(path), `Debe existir la migración ${name}.`);
  return readFileSync(path, 'utf8');
}

function readWranglerConfig(): Record<string, unknown> {
  const path = new URL('../wrangler.jsonc', import.meta.url);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
  {
    name: 'Normaliza alias para detectar duplicados visuales',
    fn: () => {
      assert(normalizeDisplayName('  OÍDO-Agudo  ') === 'oído-agudo', 'Debe recortar y normalizar el alias.');
    }
  },
  {
    name: 'Rechaza alias inválidos y reservados',
    fn: () => {
      assert(!validateDisplayName('ab').valid, 'Debe exigir al menos 3 caracteres.');
      assert(!validateDisplayName('admin').valid, 'Debe bloquear nombres reservados.');
      assert(!validateDisplayName('nombre con espacio').valid, 'No debe permitir espacios.');
    }
  },
  {
    name: 'Acepta alias públicos seguros',
    fn: () => {
      assert(validateDisplayName('Oido_Agudo-01').valid, 'Debe aceptar letras, números, guiones y guiones bajos.');
    }
  },
  {
    name: 'Emite credencial HMAC v?lida y rechaza una expirada o alterada',
    fn: async () => {
      const secret = 'secret-de-prueba';
      const token = await issuePlayerToken('player-1', secret, 1_000, 60_000);
      const payload = await verifyPlayerToken(token, secret, 1_001);
      assert(payload?.playerId === 'player-1', 'Una firma HMAC v?lida debe identificar al jugador.');
      assert(await verifyPlayerToken(token, secret, 61_000) === null, 'Una credencial expirada no debe autenticar.');
      assert(await verifyPlayerToken(`${token}alterado`, secret, 1_001) === null, 'Una firma alterada no debe autenticar.');
    }
  },
  {
    name: 'Impide autenticar jugadores revocados o eliminados',
    fn: () => {
      assert(!canAuthenticatePlayer({ revokedAt: 1_000, deletedAt: null }), 'Un jugador revocado no debe autenticar.');
      assert(!canAuthenticatePlayer({ revokedAt: null, deletedAt: 1_000 }), 'Un jugador eliminado no debe autenticar.');
      assert(canAuthenticatePlayer({ revokedAt: null, deletedAt: null }), 'Un jugador activo debe poder autenticar.');
    }
  },
  {
    name: 'Limita cinco altas por ventana y reinicia la siguiente ventana',
    fn: () => {
      let state = { windowStartedAt: 0, count: 0 };
      for (let attempt = 0; attempt < 5; attempt++) {
        const outcome = consumeRateLimit(state, 5, 10 * 60 * 1000, 1_000);
        assert(outcome.allowed, `El alta ${attempt + 1} debe permitirse.`);
        state = outcome.state;
      }
      const blocked = consumeRateLimit(state, 5, 10 * 60 * 1000, 1_000);
      assert(!blocked.allowed, 'La sexta alta en la misma ventana debe bloquearse.');
      const reset = consumeRateLimit(state, 5, 10 * 60 * 1000, 601_000);
      assert(reset.allowed && reset.state.count === 1, 'La siguiente ventana debe empezar con el primer alta.');
    }
  },
  {
    name: 'Calcula el puntaje en el servidor sin aceptar puntaje del cliente',
    fn: () => {
      const result = calculateSoloResult([440, 1000], [440, 1040], 20);
      assert(result.score === 150, 'Una respuesta exacta y una cercana deben valer 150 puntos.');
      assert(result.accuracy === 98, 'La precisión debe derivarse de las respuestas, no del cliente.');
    }
  },
  {
    name: 'Rechaza resultados de sesión incompletos o fuera del rango acústico',
    fn: () => {
      let rejectedIncomplete = false;
      let rejectedOutOfRange = false;
      try { calculateSoloResult([440, 1000], [440], 20); } catch { rejectedIncomplete = true; }
      try { calculateSoloResult([440], [20001], 20); } catch { rejectedOutOfRange = true; }
      assert(rejectedIncomplete, 'La sesión debe contener una respuesta por ronda.');
      assert(rejectedOutOfRange, 'No se deben aceptar frecuencias fuera de 20-20000 Hz.');
    }
  },
  {
    name: 'Construye la URL del ranking sin concatenaciones inseguras',
    fn: () => {
      assert(
        buildRankingUrl('https://ranking.example/', 'frequency', 10) === 'https://ranking.example/api/rankings/solo?mode=frequency&limit=10',
        'Debe conservar el origen, eliminar la barra final y serializar los filtros.'
      );
    }
  },
  {
    name: 'Valida la creación de sesión sin aceptar parámetros fuera de contrato',
    fn: () => {
      const valid = parseSoloSessionRequest({ difficultyLevel: 4, totalRounds: 10, idempotencyKey: 'inicio_01' });
      assert(valid?.difficultyLevel === 4 && valid.totalRounds === 10, 'Debe aceptar una sesión dentro de los límites.');
      assert(parseSoloSessionRequest({ difficultyLevel: 21, totalRounds: 10, idempotencyKey: 'inicio_01' }) === null, 'Debe rechazar dificultad fuera de rango.');
      assert(parseSoloSessionRequest({ difficultyLevel: 4, totalRounds: 10 }) === null, 'Debe exigir una clave de idempotencia.');
    }
  },
  {
    name: 'Acepta únicamente respuestas e idempotencia al finalizar una sesión',
    fn: () => {
      const valid = parseSoloCompletionRequest({ answers: [440, 1000], idempotencyKey: 'cierre_01' });
      assert(valid?.answers.length === 2, 'Debe conservar las respuestas para que el servidor calcule el resultado.');
      assert(parseSoloCompletionRequest({ answers: [440], score: 9999, accuracy: 100, idempotencyKey: 'cierre_01' }) === null, 'No debe aceptar métricas que el cliente intenta publicar.');
      assert(parseSoloCompletionRequest({ answers: [440] }) === null, 'Debe exigir una clave de idempotencia al cerrar.');
    }
  },
  {
    name: 'Codifica y decodifica cursores de ranking sin aceptar cursores corruptos',
    fn: () => {
      const cursor = encodeRankingCursor({ score: 500, accuracy: 92.5, durationMs: 12_000, completedAt: 1_000, playerId: 'player-1' });
      const decoded = decodeRankingCursor(cursor);
      assert(decoded?.score === 500 && decoded.playerId === 'player-1', 'El cursor debe conservar el último registro estable.');
      assert(decodeRankingCursor('cursor-corrupto') === null, 'Un cursor inválido no debe alterar la consulta.');
    }
  },
  {
    name: 'Construye una consulta de ranking separada por dificultad y cursor canónico',
    fn: () => {
      const cursor = encodeRankingCursor({ score: 500, accuracy: 92, durationMs: 12_000, completedAt: 1_000, playerId: 'player-2' });
      const query = buildSoloLeaderboardQuery({ mode: 'frequency', difficultyLevel: 3, limit: 250, cursor });
      assert(query.limit === 100, 'El límite público no debe exceder 100 filas.');
      assert(query.values[0] === 'frequency' && query.values[1] === 3, 'La consulta debe separar modo y dificultad.');
      assert(query.values.includes(12_000) && query.values.includes('player-2'), 'El cursor debe filtrar desde el último registro canónico.');
      assert(query.sql.includes('a.duration_ms ASC, a.completed_at ASC, a.id ASC'), 'El mejor intento debe respetar duración, fecha e id estable.');
      assert(query.sql.includes('score DESC, accuracy DESC, duration_ms ASC, completed_at ASC, player_id ASC'), 'El ranking debe ordenar por los cinco desempates canónicos.');
    }
  },
  {
    name: 'Pagina el ranking según score, precisión, duración, fecha e identidad',
    fn: () => {
      const page = createSoloLeaderboardPage([
        { player_id: 'player-1', display_name: 'Primero', score: 500, accuracy: 95, duration_ms: 12_000, completed_at: 3 },
        { player_id: 'player-2', display_name: 'Segundo', score: 500, accuracy: 95, duration_ms: 12_000, completed_at: 4 },
        { player_id: 'player-3', display_name: 'Tercero', score: 490, accuracy: 100, duration_ms: 1_000, completed_at: 1 }
      ], 2);
      assert(page.entries.length === 2 && page.entries[0].display_name === 'Primero' && page.entries[1].display_name === 'Segundo', 'La página debe conservar el orden canónico recibido de D1.');
      assert(page.nextCursor !== null, 'Debe emitir cursor cuando existe una página posterior.');
      const next = decodeRankingCursor(page.nextCursor ?? '');
      assert(next?.playerId === 'player-2' && next.completedAt === 4, 'El cursor debe representar exactamente la última fila entregada.');
      const finalPage = createSoloLeaderboardPage([{ player_id: 'player-3', display_name: 'Tercero', score: 490, accuracy: 100, duration_ms: 1_000, completed_at: 1 }], 2);
      assert(finalPage.nextCursor === null, 'No debe emitir cursor cuando no hay resultados posteriores.');
    }
  },
  {
    name: 'Declara el ciclo de vida de identidad sin almacenar IP o token en claro',
    fn: () => {
      const schema = readMigration('0003_identity_lifecycle.sql');
      assert(schema.includes('revoked_at INTEGER'), 'Debe registrar cuándo se revoca una identidad.');
      assert(schema.includes('deleted_at INTEGER'), 'Debe registrar cuándo se elimina una identidad.');
      assert(schema.includes('CREATE TABLE IF NOT EXISTS token_revocations'), 'Debe conservar revocaciones para invalidar credenciales.');
      assert(schema.includes('token_hash TEXT NOT NULL'), 'Las revocaciones deben usar hash, no el token en claro.');
      assert(schema.includes('CREATE TABLE IF NOT EXISTS rate_limit_windows'), 'Debe persistir ventanas de límite de uso.');
      assert(!/\bip_address\b|\btoken\s+TEXT\b/i.test(schema), 'La migración no debe persistir IP ni token en claro.');
    }
  },
  {
    name: 'Declara ranking v2 por dificultad e idempotencia e historial de Duelo',
    fn: () => {
      const schema = readMigration('0004_ranking_v2.sql');
      assert(schema.includes('difficulty_level INTEGER'), 'El ranking debe conservar nivel de dificultad numérico.');
      assert(schema.includes('idx_solo_rankings_v2'), 'Debe indexar modo, dificultad y desempates del ranking.');
      assert(schema.includes('CREATE TABLE IF NOT EXISTS idempotency_records'), 'Debe persistir claves idempotentes por acción.');
      assert(schema.includes('PRIMARY KEY (scope, player_id, idempotency_key)'), 'La idempotencia debe ser única por ámbito, jugador y clave.');
      assert(schema.includes('room_id TEXT'), 'El historial de Duelo debe identificar la sala durable.');
      assert(schema.includes('response_time_ms INTEGER'), 'El historial de Duelo debe guardar tiempo de respuesta de servidor.');
      assert(schema.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_duel_matches_room_id'), 'Una sala no debe persistir más de un cierre.');
    }
  },
  {
    name: 'Declara Durable Object y cron, pero bloquea el ID D1 marcador',
    fn: () => {
      const config = readWranglerConfig();
      const validation = validateCloudflareDeploymentConfig(config);
      const bindings = (config.durable_objects as { bindings?: Array<{ name: string; class_name: string }> }).bindings ?? [];
      const migrations = config.migrations as Array<{ new_sqlite_classes?: string[] }>;
      const crons = (config.triggers as { crons?: string[] }).crons ?? [];

      assert(bindings.some((binding) => binding.name === 'DUEL_ROOMS' && binding.class_name === 'DuelRoom'), 'Debe enlazar DUEL_ROOMS con DuelRoom.');
      assert(migrations.some((migration) => migration.new_sqlite_classes?.includes('DuelRoom')), 'Debe inicializar DuelRoom con almacenamiento SQLite.');
      assert(crons.includes('0 * * * *'), 'Debe ejecutar la retención cada hora.');
      assert(!validation.valid && validation.errors.includes('database_id marcador'), 'No debe permitir despliegue con el ID D1 marcador.');
    }
  },
  {
    name: 'Permite preflight cuando la configuración D1 ya fue provisionada',
    fn: () => {
      const config = readWranglerConfig();
      const provisioned = structuredClone(config);
      const databases = provisioned.d1_databases as Array<{ database_id: string }>;
      databases[0].database_id = '123e4567-e89b-12d3-a456-426614174000';

      const validation = validateCloudflareDeploymentConfig(provisioned);
      assert(validation.valid, `Una configuración provisionada debe pasar: ${validation.errors.join(', ')}`);
    }
  },
  {
    name: 'Separa el preflight local sin credenciales de la validacion de despliegue real',
    fn: () => {
      const config = readWranglerConfig();
      const local = validateCloudflareLocalPreflight(config);

      assert(local.valid, `El preflight local no debe requerir D1 provisionada: ${local.errors.join(', ')}`);
      assert(!validateCloudflareDeploymentConfig(config).valid, 'El despliegue real debe seguir bloqueado con el ID marcador.');
    }
  },
  {
    name: 'Valida que las migraciones D1 sean SQL, unicas y consecutivas',
    fn: () => {
      const migrations = ['0001_ranking_foundation.sql', '0002_solo_sessions.sql', '0003_identity_lifecycle.sql', '0004_ranking_v2.sql'];
      assert(validateMigrationFiles(migrations).valid, 'Las migraciones existentes deben poder validarse sin D1 ni credenciales.');
      assert(!validateMigrationFiles(['0001_base.sql', '0003_salto.sql']).valid, 'No debe permitir una secuencia de migraciones con huecos.');
    }
  }
];

let failures = 0;
for (const test of tests) {
  try {
    await test.fn();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${test.name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exit(1);
