import { useState, useEffect, useCallback } from 'react';
import { ProfileRepository } from './repository';
import { Student, NewStudent } from './types';

export function useProfile() {
  const [profile, setProfile] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await ProfileRepository.getProfile();
      setProfile(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const createProfile = async (newProfile: NewStudent) => {
    const created = await ProfileRepository.createProfile(newProfile);
    setProfile(created);
    return created;
  };

  const updateProfile = async (updates: Partial<NewStudent>) => {
    if (!profile) throw new Error('No profile exists to update');
    const updated = await ProfileRepository.updateProfile(profile.id, updates);
    setProfile(updated);
    return updated;
  };

  return { profile, isLoading, error, createProfile, updateProfile, refreshProfile: loadProfile };
}
