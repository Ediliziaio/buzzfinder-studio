import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import {
  Search,
  Globe,
  Users,
  List,
  Send,
  GitBranch,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Crosshair,
} from "lucide-react";

const navItems = [
  { title: "Scraper Maps", path: "/scraper/maps", icon: Search },
  { title: "Scraper Siti", path: "/scraper/websites", icon: Globe },
  { title: "Contatti", path: "/contacts", icon: Users },
  { title: "Liste", path: "/lists", icon: List },
  { title: "Campagne", path: "/campaigns", icon: Send },
  { title: "Analytics", path: "/analytics", icon: BarChart3 },
  { title: "Impostazioni", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const location = useLocation();

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
          const isActive = location.pathname.startsWith(item.path);
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
              {!sidebarCollapsed && <span>{item.title}</span>}
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
