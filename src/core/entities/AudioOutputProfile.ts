/**
 * Domain Entity: AudioOutputProfile
 * Models acoustic output transducer capabilities (Mobile Micro-Speakers vs. Studio Headphones/Monitors)
 * to ensure all generated frequencies, octave bounds, and ISO graphic EQ bands are physically audible.
 */

export type OutputProfileId = 'mobile_speaker' | 'headphones_studio';

export interface AudioOutputProfileConfig {
  id: OutputProfileId;
  name: string;
  nameEs: string;
  shortLabel: string;
  description: string;
  acousticRationale: string;
  minHz: number;
  maxHz: number;
  minOctave: number; // For musical note training (C3 = ~130.8 Hz)
  maxOctave: number; // C6 = ~1046.5 Hz or C7
  icon: 'Smartphone' | 'Headphones';
  isRecommendedForMobile: boolean;
}

export const AUDIO_OUTPUT_PROFILES: Record<OutputProfileId, AudioOutputProfileConfig> = {
  mobile_speaker: {
    id: 'mobile_speaker',
    name: 'Mobile / Built-in Speakers',
    nameEs: 'Altavoces Móvil / Integrados',
    shortLabel: 'Altavoces Móvil',
    description: 'Calibrado para micro-transductores (130 Hz - 12,000 Hz). Elimina sub-graves inaudibles en smartphones y tablets.',
    acousticRationale: 'Los micro-parlantes tienen una frecuencia de corte fundamental (f₀) entre 150-250 Hz. Las frecuencias inferiores a 130 Hz son inaudibles o solo generan distorsión armónica.',
    minHz: 130,
    maxHz: 12000,
    minOctave: 3, // C3 is ~130.81 Hz
    maxOctave: 6, // C6 is ~1046.50 Hz
    icon: 'Smartphone',
    isRecommendedForMobile: true
  },
  headphones_studio: {
    id: 'headphones_studio',
    name: 'Headphones / Studio Monitors',
    nameEs: 'Auriculares / Monitores de Estudio',
    shortLabel: 'Auriculares / Estudio',
    description: 'Espectro auditivo completo (20 Hz - 20,000 Hz). Rango íntegro para audífonos, monitores con subwoofer y entornos de producción.',
    acousticRationale: 'Permite el entrenamiento en sub-graves profundos (20-60 Hz) y brillo ultra-alto (12-20 kHz) gracias a la respuesta extendida de audífonos y monitores dedicados.',
    minHz: 20,
    maxHz: 20000,
    minOctave: 1, // C1 is ~32.7 Hz
    maxOctave: 7, // C7 is ~2093 Hz
    icon: 'Headphones',
    isRecommendedForMobile: false
  }
};

/**
 * Calculates the effective frequency boundaries given an output profile and target difficulty level limits.
 */
export function getEffectiveFrequencyBounds(
  profileId: OutputProfileId,
  levelMinHz: number = 20,
  levelMaxHz: number = 20000
): { minHz: number; maxHz: number } {
  const profile = AUDIO_OUTPUT_PROFILES[profileId] || AUDIO_OUTPUT_PROFILES.mobile_speaker;
  
  const effectiveMin = Math.max(profile.minHz, levelMinHz);
  const effectiveMax = Math.min(profile.maxHz, levelMaxHz);

  // Safety safeguard if level boundaries are narrower than profile
  if (effectiveMin >= effectiveMax) {
    return { minHz: profile.minHz, maxHz: profile.maxHz };
  }

  return { minHz: effectiveMin, maxHz: effectiveMax };
}

/**
 * Filters ISO graphic equalizer frequencies to remove bands outside the physical transducer profile.
 */
export function filterIsoFrequenciesForProfile(
  profileId: OutputProfileId,
  frequencies: number[]
): number[] {
  const profile = AUDIO_OUTPUT_PROFILES[profileId] || AUDIO_OUTPUT_PROFILES.mobile_speaker;
  return frequencies.filter(f => f >= profile.minHz && f <= profile.maxHz);
}

/**
 * Clamps note octaves to the physically audible range of the selected transducer.
 */
export function getEffectiveOctaveBounds(
  profileId: OutputProfileId,
  requestedMinOctave: number = 2,
  requestedMaxOctave: number = 6
): { minOctave: number; maxOctave: number } {
  const profile = AUDIO_OUTPUT_PROFILES[profileId] || AUDIO_OUTPUT_PROFILES.mobile_speaker;
  return {
    minOctave: Math.max(profile.minOctave, requestedMinOctave),
    maxOctave: Math.min(profile.maxOctave, requestedMaxOctave)
  };
}

/**
 * Detects whether the current client device is likely a mobile device / tablet
 * to recommend 'mobile_speaker' by default.
 */
export function detectRecommendedProfile(): OutputProfileId {
  if (typeof window === 'undefined') return 'mobile_speaker';

  try {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isTouch || isSmallScreen || isMobileUserAgent) {
      return 'mobile_speaker';
    }
  } catch {
    // Default fallback
  }

  return 'headphones_studio';
}
