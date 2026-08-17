/**
 * System Version Generator & Changelog Registry
 * Automatically tracks and increments application build versions with patch records.
 */

export interface VersionInfo {
  version: string;
  buildNumber: number;
  releaseDate: string;
  changelog: string[];
  activeRepairsCount: number;
}

// Current semantic version and build registration
export const APP_VERSION_INFO: VersionInfo = {
  version: '2.5.1',
  buildNumber: 45,
  releaseDate: '2026-08-16',
  activeRepairsCount: 15,
  changelog: [
    'v2.5.1: Persistencia integral en LocalStorage de todas las opciones de configuración (Rondas, Dificultad DDA, Duración de muestra con opción 1s, Retención en silencio, Modo de Espectro, Modo de Envío/Comparar).',
    'v2.5.1: Persistencia completa de la sesión en curso ante recargas (Precisión Global, Desviación Media, Rondas Completadas y Desglose ronda por ronda).',
    'v2.5.1: Persistencia y restauración del Informe de Diagnóstico & Calibración Auditiva completo.',
    'v2.5.1: Persistencia de modalidades del Duelo Multijugador (Nombre, Sala, Rondas, Modo de Juego, Afinación y Escala).',
    'v2.5.0: Sintonizador Radial Giratorio (Rotary Dial) con rotación infinita en 360° para evitar límites físicos de pantalla.',
    'v2.5.0: Rediseño minimalista de la Vista Principal: encapsulación total de parámetros (Rondas, Dificultad, Tiempos, Espectro) en el modal de Configuración.',
    'v2.4.1: Integración completa de Duelos de Notas Musicales en tiempo real y selector armónico en Multiplayer.',
    'v2.4.0: Nueva modalidad de Calibración & Duelo de Notas Musicales (Cromático / Diatónico).',
    'v2.4.0: Implementación del motor físico de Comas Musicales (Coma Pitagórica 23.46 cents / 4.76 Hz y Coma Sintónica).',
    'v2.4.0: Soporte completo para Afinación Pitagórica (3:2), Afinación Justa Ptolemaica y 12-TET estándar.',
    'v2.4.0: Selector de notas táctil con Solfeo (Do, Re, Mi...) y Notación Anglosajona (C, D, E...) con enarmónicos (# / ♭).',
    'v2.3.2: Generador dinámico de versiones y trazabilidad de actualizaciones del sistema.',
    'v2.3.1: Bloqueo de scroll en fondo (body overflow lock) durante la activación de modales.',
    'v2.3.0: Optimización integral de contraste tipográfico para Modo Claro (Light Mode).',
    'v2.2.0: Soporte PWA offline con Web App Manifest y Service Worker.',
    'v2.1.0: Modo Duelo Multijugador en tiempo real con WebSocket y sincronización por debajo de 1.2ms.',
    'v2.0.0: Arquitectura Hexagonal completa (Ports & Adapters) con DDA de 20 niveles.'
  ]
};

export function getAppVersion(): string {
  return `v${APP_VERSION_INFO.version}`;
}

export function getFullVersionLabel(): string {
  return `v${APP_VERSION_INFO.version}`;
}

export function getBuildIdentifier(): string {
  return `v${APP_VERSION_INFO.buildNumber}`;
}


