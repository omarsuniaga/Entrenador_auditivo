import { readFileSync } from 'node:fs';
import { validateCloudflareLocalPreflight } from '../worker/lib/deploymentPreflight.ts';

const configPath = new URL('../wrangler.jsonc', import.meta.url);
const validation = validateCloudflareLocalPreflight(JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>);

if (!validation.valid) {
  console.error(`Configuracion Cloudflare local invalida: ${validation.errors.join(', ')}.`);
  process.exit(1);
}

console.log('Configuracion Cloudflare valida para preflight local (sin desplegar).');
