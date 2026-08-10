import { createContext, useContext } from 'react';

export const ProfileContext = createContext<{
  hasProfile: boolean | null;
  setHasProfile: (val: boolean) => void;
}>({
  hasProfile: null,
  setHasProfile: () => {},
});

export const useProfile = () => useContext(ProfileContext);
