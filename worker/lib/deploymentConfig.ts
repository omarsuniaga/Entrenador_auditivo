const D1_DATABASE_ID_PLACEHOLDER = 'REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID';

type D1DatabaseConfig = { database_id?: unknown };
type DurableObjectBinding = { name?: unknown; class_name?: unknown };
type DurableObjectMigration = { new_sqlite_classes?: unknown };

export type CloudflareConfigValidation = {
  valid: boolean;
  errors: string[];
};

export function validateCloudflareDeploymentConfig(config: Record<string, unknown>): CloudflareConfigValidation {
  const errors: string[] = [];
  const databases = Array.isArray(config.d1_databases) ? config.d1_databases as D1DatabaseConfig[] : [];
  const databaseId = databases[0]?.database_id;
  const bindings = (config.durable_objects as { bindings?: DurableObjectBinding[] } | undefined)?.bindings ?? [];
  const migrations = Array.isArray(config.migrations) ? config.migrations as DurableObjectMigration[] : [];
  const crons = (config.triggers as { crons?: unknown } | undefined)?.crons;

  if (databaseId === D1_DATABASE_ID_PLACEHOLDER) errors.push('database_id marcador');
  if (typeof databaseId !== 'string' || databaseId.trim().length === 0) errors.push('database_id ausente');
  if (!bindings.some((binding) => binding.name === 'DUEL_ROOMS' && binding.class_name === 'DuelRoom')) {
    errors.push('binding DUEL_ROOMS ausente');
  }
  if (!migrations.some((migration) => Array.isArray(migration.new_sqlite_classes) && migration.new_sqlite_classes.includes('DuelRoom'))) {
    errors.push('migración SQLite de DuelRoom ausente');
  }
  if (!Array.isArray(crons) || !crons.includes('0 * * * *')) errors.push('cron horario ausente');

  return { valid: errors.length === 0, errors };
}
