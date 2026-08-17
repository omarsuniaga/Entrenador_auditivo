const baseUrl = process.env.CLOUDFLARE_SMOKE_URL;
if (!baseUrl) {
  console.error('CLOUDFLARE_SMOKE_URL es obligatoria para validar un despliegue real.');
  process.exit(1);
}

const response = await fetch(new URL('/api/health', baseUrl));
const body = await response.json().catch(() => null) as { status?: unknown } | null;
if (response.status !== 200 || body?.status !== 'ok') {
  console.error('Smoke de despliegue Cloudflare fallo: /api/health no respondio correctamente.');
  process.exit(1);
}

console.log(`Smoke de despliegue Cloudflare correcto: ${new URL(baseUrl).origin}`);
