import { readdirSync } from 'node:fs';
import { validateMigrationFiles } from '../worker/lib/deploymentPreflight.ts';

const migrationsPath = new URL('../migrations/', import.meta.url);
const files = readdirSync(migrationsPath).filter((file) => file.endsWith('.sql'));
const validation = validateMigrationFiles(files);

if (!validation.valid) {
  console.error(`Migraciones Cloudflare invalidas: ${validation.errors.join(', ')}.`);
  process.exit(1);
}

console.log(`Migraciones Cloudflare validas: ${files.length}.`);
