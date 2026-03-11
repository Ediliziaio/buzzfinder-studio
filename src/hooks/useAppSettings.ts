import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type SettingsMap = Record<string, string>;

interface AppSettingsContextValue {
  settings: SettingsMap;
  getSetting: (chiave: string, fallback?: string) => string;
  isLoaded: boolean;
  reload: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({
  settings: {},
  getSetting: () => "",
  isLoaded: false,
  reload: async () => {},
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("app_settings").select("chiave, valore");
    const map: SettingsMap = {};
    data?.forEach((s) => { if (s.valore) map[s.chiave] = s.valore; });
    setSettings(map);
    setIsLoaded(true);
  };

  useEffect(() => { load(); }, []);

  const getSetting = (chiave: string, fallback = "") => settings[chiave] ?? fallback;

  return (
    <AppSettingsContext.Provider value={{ settings, getSetting, isLoaded, reload: load }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export const useAppSettings = () => useContext(AppSettingsContext);
