import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { useInboxUnreadCount } from "@/hooks/useInbox";
import { useSenderPool } from "@/hooks/useSenderPool";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Globe,
  Globe2,
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
  ChevronDown,
  Crosshair,
  LayoutDashboard,
  AtSign,
  ShieldCheck,
  Kanban,
  FileText,
  Phone,
  Zap,
  Bot,
} from "lucide-react";

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  badgeKey?: "unibox" | "senders";
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: NavItem[];
}

const topLevelItems: NavItem[] = [
  { title: "Dashboard", path: "/", icon: LayoutDashboard },
];

const navGroups: NavGroup[] = [
  {
    id: "acquisizione",
    label: "Acquisizione",
    icon: Search,
    items: [
      { title: "Scraper Maps", path: "/scraper/maps", icon: Search },
      { title: "Scraper Siti", path: "/scraper/websites", icon: Globe },
      { title: "Regionale", path: "/scraper-regionale", icon: Globe2 },
      { title: "Contatti", path: "/contacts", icon: Users },
      { title: "Liste", path: "/lists", icon: List },
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    icon: Send,
    items: [
      { title: "Campagne", path: "/campaigns", icon: Send },
      { title: "Template", path: "/templates", icon: FileText },
      { title: "Follow-up", path: "/follow-up", icon: GitBranch },
      { title: "Sequenze", path: "/sequences", icon: GitBranch },
      { title: "Unibox", path: "/unibox", icon: MessageSquare, badgeKey: "unibox" },
      { title: "Chiamate AI", path: "/calls", icon: Phone },
      { title: "Automazioni", path: "/automations", icon: Zap },
      { title: "AI Agent", path: "/ai-agent", icon: Bot },
    ],
  },
  {
    id: "vendite",
    label: "Vendite",
    icon: Kanban,
    items: [
      { title: "Pipeline CRM", path: "/pipeline", icon: Kanban },
      { title: "Analytics", path: "/analytics", icon: BarChart3 },
    ],
  },
  {
    id: "infrastruttura",
    label: "Infrastruttura",
    icon: Settings,
    items: [
      { title: "Pool Mittenti", path: "/senders", icon: AtSign, badgeKey: "senders" },
      { title: "Deliverability", path: "/deliverability", icon: ShieldCheck },
      { title: "Suppression", path: "/suppression", icon: ShieldOff },
      { title: "Impostazioni", path: "/settings", icon: Settings },
    ],
  },
];

function getActiveGroupId(pathname: string): string | null {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.path === "/" ? pathname === "/" : pathname.startsWith(item.path)) {
        return group.id;
      }
    }
  }
  return null;
}

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const location = useLocation();
  const unreadCount = useInboxUnreadCount();
  const { senders } = useSenderPool();

  const activeGroupId = getActiveGroupId(location.pathname);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      initial[g.id] = g.id === activeGroupId;
    });
    return initial;
  });

  // Auto-expand group when route changes
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) => ({ ...prev, [activeGroupId]: true }));
    }
  }, [activeGroupId]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const unhealthySenders = senders.filter(
    (s) => s.attivo && (s.bounce_rate > 0.05 || s.spam_rate > 0.003 || (s.tipo === "email" && (!s.spf_ok || !s.dkim_ok)))
  ).length;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const showUnreadBadge = item.badgeKey === "unibox" && unreadCount > 0;
    const showSenderBadge = item.badgeKey === "senders" && unhealthySenders > 0;
    const hasBadge = showUnreadBadge || showSenderBadge;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={cn(
          "flex items-center gap-3 px-3 py-2 mx-1 rounded-md text-sm font-ui transition-colors relative",
          active
            ? "bg-primary/10 text-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && (
          <>
            <span className="flex-1 truncate">{item.title}</span>
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
  };

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
            BuzzFinder
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {/* Top-level: Dashboard */}
        {topLevelItems.map(renderNavItem)}

        {/* Groups */}
        {navGroups.map((group) => {
          const isOpen = openGroups[group.id] ?? false;
          const groupHasActive = group.items.some((i) => isActive(i.path));

          if (sidebarCollapsed) {
            // Collapsed: just render icons, no group headers
            return group.items.map(renderNavItem);
          }

          return (
            <div key={group.id} className="mt-2">
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 terminal-header cursor-pointer transition-colors",
                  groupHasActive ? "text-primary" : "hover:text-sidebar-accent-foreground"
                )}
              >
                <group.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3 w-3 shrink-0 transition-transform duration-200",
                    isOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-all duration-200",
                  isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                {group.items.map(renderNavItem)}
              </div>
            </div>
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
