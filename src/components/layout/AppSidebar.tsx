import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useInboxUnreadCount } from "@/hooks/useInbox";
import { useSenderPool } from "@/hooks/useSenderPool";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Globe,
  Users,
  List,
  Send,
  MessageSquare,
  GitBranch,
  ShieldOff,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  LayoutDashboard,
  AtSign,
  ShieldCheck,
  Kanban,
  FileText,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
  { title: "Contatti", path: "/contacts", icon: Users },
  { title: "Liste", path: "/lists", icon: List },
  { title: "Campagne", path: "/campaigns", icon: Send },
  { title: "Template", path: "/templates", icon: FileText },
  { title: "Unibox", path: "/unibox", icon: MessageSquare, badgeKey: "unibox" as const },
  { title: "Follow-up", path: "/follow-up", icon: GitBranch },
  { title: "Analytics", path: "/analytics", icon: BarChart3 },
  { title: "Pipeline CRM", path: "/pipeline", icon: Kanban },
  { title: "Scraper Maps", path: "/scraper/maps", icon: Search },
  { title: "Scraper Siti", path: "/scraper/websites", icon: Globe },
  { title: "Pool Mittenti", path: "/senders", icon: AtSign, badgeKey: "senders" as const },
  { title: "Deliverability", path: "/deliverability", icon: ShieldCheck },
  { title: "Suppression", path: "/suppression", icon: ShieldOff },
  { title: "Impostazioni", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const location = useLocation();
  const unreadCount = useInboxUnreadCount();
  const { senders } = useSenderPool();

  const unhealthySenders = senders.filter(
    (s) => s.attivo && (s.bounce_rate > 0.05 || s.spam_rate > 0.003 || (s.tipo === "email" && (!s.spf_ok || !s.dkim_ok)))
  ).length;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        sidebarCollapsed ? "w-[52px]" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-3">
        <Crosshair className="h-5 w-5 shrink-0 text-primary" />
        {!sidebarCollapsed && (
          <span className="ml-2 font-display text-sm font-bold text-foreground tracking-tight">
            LeadHunter
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const showUnreadBadge = item.badgeKey === "unibox" && unreadCount > 0;
          const showSenderBadge = item.badgeKey === "senders" && unhealthySenders > 0;
          const hasBadge = showUnreadBadge || showSenderBadge;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 mx-1 rounded-md text-sm font-ui transition-colors relative",
                isActive
                  ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {showUnreadBadge && (
                    <Badge variant="destructive" className="ml-auto text-xs h-5 min-w-5 px-1 flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                  {showSenderBadge && (
                    <Badge className="ml-auto text-xs h-5 min-w-5 px-1 flex items-center justify-center bg-yellow-500 text-yellow-950 hover:bg-yellow-500">
                      {unhealthySenders}
                    </Badge>
                  )}
                </>
              )}
              {sidebarCollapsed && hasBadge && (
                <span className={cn(
                  "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
                  showUnreadBadge ? "bg-destructive" : "bg-yellow-500"
                )} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex h-10 items-center justify-center border-t border-border text-muted-foreground hover:text-foreground transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
