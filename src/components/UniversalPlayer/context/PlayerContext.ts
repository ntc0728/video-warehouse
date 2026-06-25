import { createContext, useContext } from 'react';

export interface PlayerContextValue {
  getVideoElement: () => HTMLVideoElement | null;
}

export const PlayerContext = createContext<PlayerContextValue>({
  getVideoElement: () => null,
});

export function usePlayerElement() {
  return useContext(PlayerContext);
}
