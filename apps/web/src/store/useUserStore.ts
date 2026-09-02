import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AvatarConfig {
  body: number;
  eyes: number;
  mouth: number;
  hair: number;
  accessory: number;
  bodyColor: string;
}

export interface UserState {
  guestId: string | null;
  username: string;
  avatar: AvatarConfig;
  language: string;
  volume: number;
  
  initializeGuest: () => void;
  setUsername: (name: string) => void;
  setAvatar: (config: AvatarConfig) => void;
  setLanguage: (lang: string) => void;
  setVolume: (vol: number) => void;
}

const defaultAvatar: AvatarConfig = {
  body: 0,
  eyes: 0,
  mouth: 0,
  hair: 0,
  accessory: 0,
  bodyColor: '#ffcc99'
};

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      guestId: null,
      username: '',
      avatar: defaultAvatar,
      language: 'en',
      volume: 0.5,

      initializeGuest: () => {
        if (!get().guestId) {
          const newId = `guest_${Math.random().toString(36).substring(2, 9)}`;
          set({ guestId: newId });
        }
      },
      setUsername: (name: string) => set({ username: name.trim() }),
      setAvatar: (config: AvatarConfig) => set({ avatar: config }),
      setLanguage: (lang: string) => set({ language: lang }),
      setVolume: (vol: number) => set({ volume: vol }),
    }),
    {
      name: 'drawing-game-user-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
