import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

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
  fetchCredits: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  n8nStatus: 'checking',
  setN8nStatus: (status) => set({ n8nStatus: status }),
  credits: { email: 0, sms: 0, whatsapp: 0 },
  setCredits: (credits) => set({ credits }),
  fetchCredits: async () => {
    try {
      // Read credit limits from app_settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('chiave, valore')
        .in('chiave', ['crediti_email', 'crediti_sms', 'crediti_whatsapp']);

      const limitsMap: Record<string, number> = {};
      settings?.forEach((s) => {
        limitsMap[s.chiave] = parseInt(s.valore || '0', 10);
      });

      // Read usage totals
      const { data: usage } = await supabase
        .from('usage_log')
        .select('tipo, quantita');

      const usedMap: Record<string, number> = {};
      usage?.forEach((u) => {
        usedMap[u.tipo] = (usedMap[u.tipo] || 0) + (u.quantita || 0);
      });

      set({
        credits: {
          email: (limitsMap.crediti_email || 50000) - (usedMap.email || 0),
          sms: (limitsMap.crediti_sms || 10000) - (usedMap.sms || 0),
          whatsapp: (limitsMap.crediti_whatsapp || 5000) - (usedMap.whatsapp || 0),
        },
      });
    } catch (err) {
      console.error('Error fetching credits:', err);
    }
  },
}));
