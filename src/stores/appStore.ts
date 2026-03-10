import { create } from 'zustand';

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  n8nStatus: 'online' | 'offline' | 'checking';
  setN8nStatus: (status: 'online' | 'offline' | 'checking') => void;
  credits: {
    email: number;
    sms: number;
    whatsapp: number;
  };
  setCredits: (credits: { email: number; sms: number; whatsapp: number }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  n8nStatus: 'checking',
  setN8nStatus: (status) => set({ n8nStatus: status }),
  credits: { email: 50000, sms: 10000, whatsapp: 5000 },
  setCredits: (credits) => set({ credits }),
}));
