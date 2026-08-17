/**
 * Presentation Context: AudioProfileContext
 * Provides global state and persistence for the selected acoustic output device
 * (Altavoces Móvil / Integrados vs. Auriculares / Monitores de Estudio).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  OutputProfileId,
  AudioOutputProfileConfig,
  AUDIO_OUTPUT_PROFILES,
  getEffectiveFrequencyBounds,
  getEffectiveOctaveBounds,
  filterIsoFrequenciesForProfile,
  detectRecommendedProfile
} from '../../core/entities/AudioOutputProfile';

export interface AudioProfileContextType {
  profileId: OutputProfileId;
  profile: AudioOutputProfileConfig;
  isMobileSpeakerMode: boolean;
  setProfileId: (id: OutputProfileId) => void;
  toggleProfile: () => void;
  getEffectiveBounds: (levelMinHz?: number, levelMaxHz?: number) => { minHz: number; maxHz: number };
  getEffectiveOctaves: (minOct?: number, maxOct?: number) => { minOctave: number; maxOctave: number };
  filterIsoBands: (bands: number[]) => number[];
}

const STORAGE_KEY = 'audiofit_output_profile_v1';

const AudioProfileContext = createContext<AudioProfileContextType>({
  profileId: 'mobile_speaker',
  profile: AUDIO_OUTPUT_PROFILES.mobile_speaker,
  isMobileSpeakerMode: true,
  setProfileId: () => {},
  toggleProfile: () => {},
  getEffectiveBounds: (levelMinHz = 20, levelMaxHz = 20000) => ({ minHz: 130, maxHz: 12000 }),
  getEffectiveOctaves: (minOct = 2, maxOct = 6) => ({ minOctave: 3, maxOctave: 6 }),
  filterIsoBands: (bands) => bands.filter(f => f >= 130 && f <= 12000)
});

export const AudioProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profileId, setProfileIdState] = useState<OutputProfileId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'mobile_speaker' || saved === 'headphones_studio') {
        return saved;
      }
    } catch {
      // Ignored
    }
    return detectRecommendedProfile();
  });

  const setProfileId = useCallback((id: OutputProfileId) => {
    setProfileIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Ignored
    }
  }, []);

  const toggleProfile = useCallback(() => {
    setProfileId(profileId === 'mobile_speaker' ? 'headphones_studio' : 'mobile_speaker');
  }, [profileId, setProfileId]);

  const profile = AUDIO_OUTPUT_PROFILES[profileId] || AUDIO_OUTPUT_PROFILES.mobile_speaker;
  const isMobileSpeakerMode = profileId === 'mobile_speaker';

  const getEffectiveBounds = useCallback((levelMinHz: number = 20, levelMaxHz: number = 20000) => {
    return getEffectiveFrequencyBounds(profileId, levelMinHz, levelMaxHz);
  }, [profileId]);

  const getEffectiveOctaves = useCallback((minOct: number = 2, maxOct: number = 6) => {
    return getEffectiveOctaveBounds(profileId, minOct, maxOct);
  }, [profileId]);

  const filterIsoBands = useCallback((bands: number[]) => {
    return filterIsoFrequenciesForProfile(profileId, bands);
  }, [profileId]);

  return (
    <AudioProfileContext.Provider
      value={{
        profileId,
        profile,
        isMobileSpeakerMode,
        setProfileId,
        toggleProfile,
        getEffectiveBounds,
        getEffectiveOctaves,
        filterIsoBands
      }}
    >
      {children}
    </AudioProfileContext.Provider>
  );
};

export const useAudioProfile = () => useContext(AudioProfileContext);
