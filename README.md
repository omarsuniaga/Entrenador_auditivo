# AudioLab — Entrenador Auditivo

Sistema de calibración y entrenamiento auditivo: escuchá un tono con frecuencia oculta,
sintonizalo de oído y medí tu desviación exacta en Hz y cents. Incluye entrenamiento en
solitario (frecuencia continua o notas musicales) y duelos multijugador en tiempo real
sobre WebSocket.

## Arquitectura

El proyecto sigue una arquitectura hexagonal (puertos y adaptadores):

- `src/core/` — dominio puro (entidades, servicios, puertos). Sin dependencias de React,
  DOM ni red.
- `src/application/` — casos de uso que orquestan el dominio.
- `src/infrastructure/` — adaptadores concretos (Web Audio, almacenamiento local, cliente
  WebSocket).
- `src/presentation/` — componentes React, hooks y contexto.
- `server.ts` + `server/` — servidor Express que sirve la SPA (vía Vite en dev / estáticos
  en producción) y expone el motor de duelos multijugador sobre WebSocket (`/ws`).

## Requisitos

Node.js 18+ (o Bun, hay `bun.lock` en el repo).

## Correr en local

```bash
npm install
npm run dev
```

Levanta el servidor Express + Vite (modo desarrollo) en `http://localhost:3000` — o en el
puerto que indique la variable de entorno `PORT`.

## Scripts

- `npm run dev` — servidor de desarrollo (Express + Vite middleware + WebSocket).
- `npm run build` — build de producción (cliente con Vite, servidor empaquetado con esbuild
  a `dist/server.cjs`).
- `npm start` — corre el build de producción.
- `npm test` — corre la suite de tests (`tests/test-suite.ts`, runner propio sobre
  `src/tests/testDefinitions.ts`).
- `npm run lint` — chequeo de tipos (`tsc --noEmit`).

## Variables de entorno

Ver [.env.example](.env.example). `PORT` controla el puerto del servidor (por defecto
3000); es la que usan plataformas como Cloud Run para asignar el puerto en runtime.

## Cloudflare

La guía de [provisionamiento y despliegue en Cloudflare](docs/cloudflare-provisioning.md)
describe cómo crear D1, configurar secretos, GitHub Actions, variables de la PWA y rollback.
