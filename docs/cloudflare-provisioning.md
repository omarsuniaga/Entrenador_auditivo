# Provisionamiento y despliegue en Cloudflare

Esta guía configura la infraestructura real del Worker. `worker/duel/DuelRoom.ts` ya existe
y se exporta (2026-08-17) — `npx wrangler deploy --dry-run` bundlea sin errores y reconoce
tanto el binding `DUEL_ROOMS` (Durable Object) como `DB` (D1). El despliegue real solo
sigue pendiente de Turnstile y de los secretos del Worker (sección 5), no de código.

## Resultado esperado

Al terminar, habrá un Worker con su base D1, el namespace de Durable Objects, los secretos fuera del repositorio y un pipeline de GitHub Actions que aplica migraciones antes de desplegar. La PWA y la API se servirán desde el mismo origen; mientras estén en orígenes distintos, la PWA usa `VITE_RANKING_API_URL`.

## 1. Preparar el repositorio y herramientas

1. Confirmá que el repositorio local tiene remoto GitHub y rama `master` (la rama por defecto de este repo). El workflow `.github/workflows/cloudflare.yml` se activa en PRs y en pushes a `master`.
2. Instalá dependencias con `npm ci`.
3. Autenticá Wrangler con una cuenta que tenga permiso para crear D1 y desplegar Workers. No pegues tokens en la terminal, código ni archivos versionados.
4. Ejecutá primero el control sin credenciales:

   ```bash
   npm run preflight:cloudflare:local
   ```

Este control valida migraciones, pruebas, tipos y el endpoint de salud sin crear recursos remotos.

## 2. Crear D1 y fijar su binding

Desde la raíz del proyecto, creá la base de producción:

```bash
npx wrangler d1 create entrenador-auditivo
```

Cloudflare devolverá un UUID. Reemplazá **solo** este valor en `wrangler.jsonc`:

```jsonc
"database_id": "REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID"
```

por el UUID recibido. Mantené `binding: "DB"`, `database_name: "entrenador-auditivo"` y `migrations_dir: "migrations"`: el Worker y el pipeline dependen de esos nombres.

Después verificá la configuración estricta:

```bash
npm run validate:cloudflare-config
```

Debe terminar correctamente antes de aplicar cambios remotos. Si muestra `database_id marcador`, el UUID no fue reemplazado. Nunca sustituyas el ID por un secreto: un ID de D1 es identificador de configuración, no una credencial.

## 3. Aplicar migraciones de D1

Probá las migraciones primero en estado local de Wrangler y revisá la lista:

```bash
npx wrangler d1 migrations apply entrenador-auditivo --local
npx wrangler d1 migrations list entrenador-auditivo --remote
```

Para producción, aplicá exclusivamente los SQL versionados y secuenciales del directorio `migrations/`:

```bash
npx wrangler d1 migrations apply entrenador-auditivo --remote
```

No edites una migración ya aplicada. Para corregir producción, agregá una migración nueva. D1 conserva la lista de migraciones aplicadas y toma un respaldo antes de aplicar en remoto; una migración que falla deja aplicado el último estado exitoso.

## 4. Durable Objects

`wrangler.jsonc` declara:

- binding `DUEL_ROOMS` asociado a la clase `DuelRoom`;
- migración de clase SQLite `v1-duel-room`;
- cron horario para la retención futura (declarado; todavía no hay un handler `scheduled` que lo consuma — no bloquea el deploy, pero no hace nada por ahora).

`DuelRoom` vive en `worker/duel/DuelRoom.ts`: una instancia por sala activa (`env.DUEL_ROOMS.idFromName(código)`), usando la WebSocket Hibernation API (la sala puede evacuarse de memoria con los sockets abiertos) y `ctx.storage.setAlarm()` para el countdown previo a la ronda, el deadline de cada ronda y la ventana de reconexión — nunca `setTimeout`, que no sobrevive una hibernación. Toda la lógica de juego (puntaje, ganador de ronda, abandono, empate) es pura y vive separada en `worker/duel/roomState.ts`, probada en `tests/duel-room-suite.ts` sin necesitar un runtime de Workers real. Al finalizar un duelo, si al menos un jugador se autenticó (`Authorization: Bearer <token de jugador>`, el mismo sistema de identidad anónima que ranking individual), se escribe en `duel_matches`/`duel_participants`; los invitados pueden jugar pero sus resultados no entran al ranking (la FK de `duel_participants.player_id` exige una fila real en `players`).

No hay un recurso separado que se cree manualmente: Cloudflare provisiona la clase al desplegar el Worker que la exporta. No renombres, elimines ni cambies de almacenamiento la clase sin una migración de Durable Objects adicional. Verificado con `npx wrangler deploy --dry-run` (2026-08-17): el Worker bundlea sin errores y reconoce ambos bindings (`DUEL_ROOMS` y `DB`).

**Rutas del Worker para Duelo:**
- `POST /api/duel/rooms` — crea una sala (genera el código de 5 caracteres, reintenta en la colisión improbable).
- `POST /api/duel/rooms/:codigo` — une un jugador a una sala existente (o reconecta con `sessionToken`).
- `GET /api/duel/rooms/:codigo/ws` — upgrade a WebSocket; requiere `playerId`/`sessionToken` como query params, ya emitidos por los dos endpoints anteriores.

## 5. Secretos y variables

| Nombre | Dónde se configura | Uso | ¿Se versiona? |
| --- | --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Secret del Worker Cloudflare | Siteverify del alta anónima | No |
| `PLAYER_TOKEN_SECRET` | Secret del Worker Cloudflare | Firma HMAC de credenciales de jugador | No |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | Autentica Wrangler para migrar y desplegar | No |
| `CLOUDFLARE_SMOKE_URL` | GitHub Actions variable | URL pública usada por el smoke `GET /api/health` | Sí, como variable, no como secret |
| `VITE_RANKING_API_URL` | Variable de build de la PWA | Origen de la API si no comparte origen con la PWA | Sí, solo URL pública |

Configurá cada secreto del Worker mediante entrada interactiva, una vez por ambiente:

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put PLAYER_TOKEN_SECRET
```

Usá una clave HMAC aleatoria larga para `PLAYER_TOKEN_SECRET`, independiente de cualquier token de GitHub o Cloudflare. En desarrollo local, copiá `.dev.vars.example` a `.dev.vars` y reemplazá valores de ejemplo. **No uses valores reales de producción en `.dev.vars`.**

En GitHub, creá el secret de repositorio `CLOUDFLARE_API_TOKEN` con privilegios mínimos para Workers y D1 de esta cuenta. Creá `CLOUDFLARE_SMOKE_URL` como *Actions variable*, con una URL HTTPS pública y sin ruta, por ejemplo `https://entrenador-auditivo.<subdominio>.workers.dev`. Nunca expongas el token de API como variable de Actions.

`VITE_RANKING_API_URL` se incorpora al JavaScript del navegador durante el build. No debe contener secretos, tokens ni claves Turnstile privadas. Si PWA y Worker comparten origen, dejala vacía para usar rutas relativas.

## 6. Qué NO debe entrar a Git

No versionés nunca:

- `.dev.vars`, `.env`, `.env.*` con valores reales, ni copias de salida de comandos con secretos;
- tokens de Cloudflare, GitHub, Turnstile o credenciales de jugador;
- `PLAYER_TOKEN_SECRET` ni el secreto privado de Turnstile;
- bases locales de Wrangler (`.wrangler/`) ni logs de despliegue que incluyan cabeceras;
- archivos de configuración con secretos embebidos.

El `.gitignore` actual cubre `.env*`; agregá `.dev.vars` y `.wrangler/` antes de iniciar el despliegue si no están ya cubiertos por la política del repositorio. `.dev.vars.example`, `.env.example`, migraciones SQL y `wrangler.jsonc` sí se versionan, pero solo con nombres y marcadores seguros.

## 7. Secuencia de despliegue

1. Validá localmente: `npm run preflight:cloudflare:local`.
2. Creá D1, reemplazá el UUID y ejecutá `npm run validate:cloudflare-config`.
3. Aplicá las migraciones remotas y confirmá que la lista no contiene pendientes.
4. Configurá los dos secretos del Worker y las configuraciones de GitHub Actions.
5. Cuando `DuelRoom` esté implementado y probado, desplegá manualmente el primer Worker con `npx wrangler deploy`.
6. Consultá `https://<worker>/api/health`; debe responder `{ "status": "ok" }`.
7. Confirmá que `CLOUDFLARE_SMOKE_URL` apunta a esa URL. Después, un push a `master` ejecuta preflight, migraciones remotas, deploy y smoke en ese orden.

El workflow no despliega si falta `CLOUDFLARE_API_TOKEN`; tampoco debe promoverse si falla el preflight o el smoke. Antes de anunciar producción, probá registro Turnstile, sesión individual, ranking y reconexión de Duelo con datos de prueba, nunca con secretos en el navegador.

## 8. Rollback seguro

1. Si el Worker nuevo falla **antes** de migrar datos incompatibles, desplegá la versión anterior del Worker desde Cloudflare o el commit previo y verificá `/api/health`.
2. Si ya se aplicó una migración D1, **no** la reviertas editando su archivo. Prepará una nueva migración correctiva o restaurá una copia de seguridad validada, evaluando pérdida de datos antes de hacerlo.
3. Si falla Duelo v2, desactivá su feature flag cuando se implemente; restaurá temporalmente WebSocket v1. No borres resultados v2 ya cerrados.
4. Si un secreto se filtró, revocalo en su proveedor, generá uno nuevo, actualizá el secret del Worker o GitHub y desplegá de nuevo. Cambiar `PLAYER_TOKEN_SECRET` invalida los tokens existentes: es un corte de sesiones esperado.

Guardá la URL, versión desplegada, resultado de migraciones y resultado del smoke en el registro de la entrega. Nunca guardes valores de secretos en ese registro.

## Referencias oficiales

- [Comandos D1 de Wrangler](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Migraciones D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Configuración, secretos y Durable Objects de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [GitHub Actions para Workers](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
