import { readFileSync } from 'node:fs';
import { validateCloudflareDeploymentConfig } from '../worker/lib/deploymentConfig.ts';

const configPath = new URL('../wrangler.jsonc', import.meta.url);
const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
const validation = validateCloudflareDeploymentConfig(config);

if (!validation.valid) {
  console.error(`Configuración Cloudflare inválida: ${validation.errors.join(', ')}.`);
  process.exit(1);
}

console.log('Configuración Cloudflare lista para preflight.');
