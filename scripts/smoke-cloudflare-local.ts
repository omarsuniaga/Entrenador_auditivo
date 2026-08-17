import worker from '../worker/index.ts';

const response = await worker.fetch(new Request('https://local.audiofit.test/api/health'), {} as never);
const body = await response.json() as { status?: unknown };

if (response.status !== 200 || body.status !== 'ok') {
  console.error('Smoke local Cloudflare fallo: /api/health no respondio correctamente.');
  process.exit(1);
}

console.log('Smoke local Cloudflare correcto.');
