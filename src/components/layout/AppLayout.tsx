import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/utils";
import { useSenderAlerts } from "@/hooks/useSenderAlerts";

export function AppLayout() {
  const { sidebarCollapsed } = useAppStore();
  useSenderAlerts();

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <AppHeader />
      <main
        className={cn(
          "transition-all duration-200 p-6",
          sidebarCollapsed ? "ml-[52px]" : "ml-[220px]"
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
