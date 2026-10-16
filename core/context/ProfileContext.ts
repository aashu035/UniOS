import { createContext } from 'react';

export const ProfileContext = createContext<{
  hasProfile: boolean | null;
  setHasProfile: (val: boolean) => void;
}>({
  hasProfile: null,
  setHasProfile: () => {},
});


