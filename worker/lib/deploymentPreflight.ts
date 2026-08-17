import { validateCloudflareDeploymentConfig, type CloudflareConfigValidation } from './deploymentConfig';

export function validateCloudflareLocalPreflight(config: Record<string, unknown>): CloudflareConfigValidation {
  const localConfig = structuredClone(config);
  const databases = Array.isArray(localConfig.d1_databases)
    ? localConfig.d1_databases as Array<{ database_id?: unknown }>
    : [];

  if (databases[0]?.database_id === 'REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID') {
    databases[0].database_id = 'local-preflight-no-deploy';
  }

  return validateCloudflareDeploymentConfig(localConfig);
}

export function validateMigrationFiles(files: string[]): CloudflareConfigValidation {
  const errors: string[] = [];
  const numbers = files.map((file) => {
    const match = /^(\d{4})_[a-z0-9_]+\.sql$/i.exec(file);
    if (!match) {
      errors.push(`nombre de migracion invalido: ${file}`);
      return null;
    }
    return Number(match[1]);
  });

  if (numbers.some((number) => number === null)) return { valid: false, errors };
  const sorted = [...numbers as number[]].sort((left, right) => left - right);
  if (new Set(sorted).size !== sorted.length) errors.push('numeros de migracion duplicados');
  sorted.forEach((number, index) => {
    if (number !== index + 1) errors.push(`secuencia de migraciones incompleta en ${String(number).padStart(4, '0')}`);
  });

  return { valid: errors.length === 0, errors };
}
