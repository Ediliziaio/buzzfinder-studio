import { useLocation } from "react-router-dom";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, Smartphone, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const breadcrumbMap: Record<string, string> = {
  "/scraper/maps": "Scraper Maps",
  "/scraper/websites": "Scraper Siti",
  "/contacts": "Contatti",
  "/lists": "Liste",
  "/campaigns": "Campagne",
  "/analytics": "Analytics",
  "/settings": "Impostazioni",
};

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { credits, n8nStatus, sidebarCollapsed } = useAppStore();

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
        <span className="font-mono text-xs text-muted-foreground">LeadHunter</span>
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

        {/* n8n status */}
        <div className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              n8nStatus === "online" ? "bg-primary pulse-dot" : n8nStatus === "offline" ? "bg-destructive" : "bg-warning"
            )}
          />
          <span className="font-mono text-[10px] text-muted-foreground">n8n</span>
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
