import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { AppSettingsProvider } from "@/hooks/useAppSettings";
import AuthPage from "@/pages/Auth";
import IndexPage from "@/pages/Index";
import ContactsPage from "@/pages/Contacts";
import ScraperMapsPage from "@/pages/ScraperMaps";
import ScraperWebsitesPage from "@/pages/ScraperWebsites";
import ListsPage from "@/pages/Lists";
import CampaignsPage from "@/pages/Campaigns";
import AnalyticsPage from "@/pages/Analytics";
import SettingsPage from "@/pages/Settings";
import CampaignDetailPage from "@/pages/CampaignDetail";
import FollowUpSequencesPage from "@/pages/FollowUpSequences";
import SuppressionListPage from "@/pages/SuppressionList";
import UniboxPage from "@/pages/Unibox";
import PipelinePage from "@/pages/Pipeline";
import SendersPage from "@/pages/Senders";
import DeliverabilityPage from "@/pages/Deliverability";
import TemplatesPage from "@/pages/Templates";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-mono text-sm text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={session ? <Navigate to="/contacts" /> : <AuthPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<IndexPage />} />
        <Route path="/scraper/maps" element={<ScraperMapsPage />} />
        <Route path="/scraper/websites" element={<ScraperWebsitesPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/unibox" element={<UniboxPage />} />
        <Route path="/follow-up" element={<FollowUpSequencesPage />} />
        <Route path="/suppression" element={<SuppressionListPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/senders" element={<SendersPage />} />
        <Route path="/deliverability" element={<DeliverabilityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
