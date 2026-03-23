import { useLocation } from "react-router-dom";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Smartphone, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";

const breadcrumbMap: Record<string, string> = {
  "/scraper/maps": "Scraper Maps",
  "/scraper/websites": "Scraper Siti",
  "/scraper-regionale": "Scraper Regionale",
  "/ai-agent": "AI Agent",
  "/contacts": "Contatti",
  "/lists": "Liste",
  "/campaigns": "Campagne",
  "/analytics": "Analytics",
  "/settings": "Impostazioni",
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { credits, sidebarCollapsed, setCredits } = useAppStore();

  const fetchCredits = useCallback(async () => {
    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("chiave, valore")
        .in("chiave", ["limite_email_giorno", "limite_sms_giorno", "limite_whatsapp_giorno"]);

      const limits: Record<string, number> = {
        email: 50000, sms: 10000, whatsapp: 5000,
      };
      settings?.forEach((s) => {
        if (s.chiave === "limite_email_giorno") limits.email = (Number(s.valore) || 1000) * 30;
        if (s.chiave === "limite_sms_giorno") limits.sms = (Number(s.valore) || 500) * 30;
        if (s.chiave === "limite_whatsapp_giorno") limits.whatsapp = (Number(s.valore) || 250) * 30;
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: usage } = await supabase
        .from("usage_log")
        .select("tipo, quantita")
        .gte("created_at", startOfMonth.toISOString());

      const used: Record<string, number> = { email: 0, sms: 0, whatsapp: 0 };
      usage?.forEach((u) => {
        if (u.tipo in used) used[u.tipo] += (u.quantita || 0);
      });

      setCredits({
        email: Math.max(0, limits.email - used.email),
        sms: Math.max(0, limits.sms - used.sms),
        whatsapp: Math.max(0, limits.whatsapp - used.whatsapp),
      });
    } catch {
      // Keep default credits on error
    }
  }, [setCredits]);

  useEffect(() => {
    fetchCredits();
    const interval = setInterval(fetchCredits, 60000);
    return () => clearInterval(interval);
  }, [fetchCredits]);

  const currentPage = Object.entries(breadcrumbMap).find(([path]) =>
    location.pathname.startsWith(path)
  );

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-6 transition-all duration-200",
        sidebarCollapsed ? "ml-[52px]" : "ml-[220px]"
      )}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">BuzzFinder</span>
        {currentPage && (
          <>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-mono text-xs text-foreground">{currentPage[1]}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Credits pills */}
        <div className="flex items-center gap-2">
          <CreditPill icon={<Mail className="h-3 w-3" />} label="Email" value={credits.email} />
          <CreditPill icon={<MessageSquare className="h-3 w-3" />} label="SMS" value={credits.sms} />
          <CreditPill icon={<Smartphone className="h-3 w-3" />} label="WA" value={credits.whatsapp} />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

function CreditPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
      {icon}
      <span className="font-mono text-[10px] text-muted-foreground">{label}:</span>
      <span className="font-mono text-[11px] text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}
