import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import AcceptInvite from "./pages/AcceptInvite";
import AdminDashboard from "./pages/AdminDashboard";
import EventDetail from "./pages/admin/EventDetail";
import AdminSettings from "./pages/admin/AdminSettings";
import CeoDashboard from "./pages/admin/CeoDashboard";
import AdminAllMessages from "./pages/admin/AdminAllMessages";
import AdminInbox from "./pages/admin/AdminInbox";
import MarketingRoster from "./pages/admin/MarketingRoster";
import SalesRoster from "./pages/admin/SalesRoster";
import PreferredVendors from "./pages/admin/PreferredVendors";
import DecorCatalog from "./pages/admin/DecorCatalog";
import Resources from "./pages/admin/Resources";
import AdminForms from "./pages/admin/Forms";
import SettingsLayout from "./pages/admin/SettingsLayout";
import SettingsJournal from "./pages/admin/settings/SettingsJournal";
import SettingsIntegrations from "./pages/admin/settings/SettingsIntegrations";
import SettingsTeamRoles from "./pages/admin/settings/SettingsTeamRoles";
import SettingsContractTemplates from "./pages/admin/settings/SettingsContractTemplates";
import SettingsEmailCopy from "./pages/admin/settings/SettingsEmailCopy";
import SettingsScheduledEmails from "./pages/admin/settings/SettingsScheduledEmails";
import SettingsEmailTest from "./pages/admin/settings/SettingsEmailTest";
import PreviewPortalLayout from "./pages/admin/PreviewPortalLayout";
import PortalLayout from "./pages/portal/PortalLayout";
import PortalHistory from "./pages/portal/History";
import StartHere from "./pages/portal/StartHere";
import Today from "./pages/portal/Today";
import OurWeekend from "./pages/portal/OurWeekend";
import Timeline from "./pages/portal/Timeline";
import Planning from "./pages/portal/Planning";
import Vendors from "./pages/portal/Vendors";
import Ceremony from "./pages/portal/Ceremony";
import Decor from "./pages/portal/Decor";
import Experiences from "./pages/portal/Experiences";
import ExperienceCatalog from "./pages/admin/ExperienceCatalog";
import LayoutLibrary from "./pages/admin/LayoutLibrary";
import Seating from "./pages/portal/Seating";
import MenusMeals from "./pages/portal/MenusMeals";
import OurPeople from "./pages/portal/OurPeople";
import Financials from "./pages/portal/Financials";
import Budget from "./pages/portal/Budget";
import Messages from "./pages/portal/Messages";
import Notes from "./pages/portal/Notes";
import PortalForms from "./pages/portal/Forms";
import Documents from "./pages/portal/Documents";
import Contracts from "./pages/portal/Contracts";
import Rsvp from "./pages/portal/Rsvp";
import Insurance from "./pages/portal/Insurance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/set-password" element={<SetPassword />} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />

            {/* Public RSVP — no auth */}
            <Route path="/rsvp/:token" element={<PublicRsvp />} />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ceo-dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <CeoDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events/:eventId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <EventDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SettingsLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/admin/settings/journal" replace />} />
              <Route path="journal" element={<SettingsJournal />} />
              <Route path="preferred-vendors" element={<PreferredVendors />} />
              <Route path="decor-rentals" element={<DecorCatalog />} />
              <Route path="experiences" element={<ExperienceCatalog />} />
              <Route path="layouts" element={<LayoutLibrary />} />
              <Route path="resources" element={<Resources />} />
              <Route path="forms" element={<AdminForms />} />
              <Route path="contract-templates" element={<SettingsContractTemplates />} />
              <Route path="email-copy" element={<SettingsEmailCopy />} />
              <Route path="automated-emails" element={<SettingsScheduledEmails />} />
              <Route path="integrations" element={<SettingsIntegrations />} />
              <Route path="team" element={<SettingsTeamRoles />} />
              <Route path="email-test" element={<SettingsEmailTest />} />
            </Route>
            <Route
              path="/admin/account"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminAllMessages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/inbox"
              element={
                <ProtectedRoute section="gmail_inbox">
                  <AdminInbox />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/marketing-roster"
              element={
                <ProtectedRoute section="marketing_roster">
                  <MarketingRoster />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sales-roster"
              element={
                <ProtectedRoute section="sales_roster">
                  <SalesRoster />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/preferred-vendors"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PreferredVendors />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/decor-catalog"
              element={
                <ProtectedRoute requiredRole="admin">
                  <DecorCatalog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/experiences"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ExperienceCatalog />
                </ProtectedRoute>
              }
            />
            <Route path="/admin/layouts" element={<ProtectedRoute requiredRole="admin"><LayoutLibrary /></ProtectedRoute>} />
            <Route
              path="/admin/resources"
              element={
                <ProtectedRoute requiredRole="admin">
                  <Resources />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/forms"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminForms />
                </ProtectedRoute>
              }
            />

            {/* Admin Preview of Couple Portal */}
            <Route
              path="/admin/preview/:eventId"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PreviewPortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="today" replace />} />
              <Route path="start" element={<StartHere />} />
              <Route path="today" element={<Today />} />
              <Route path="our-wedding" element={<OurWeekend />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="planning" element={<Planning />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="ceremony" element={<Ceremony />} />
              <Route path="decor" element={<Decor />} />
              <Route path="experiences" element={<Experiences />} />
              <Route path="seating" element={<Seating />} />
              <Route path="menus-meals" element={<MenusMeals />} />
              <Route path="our-people" element={<OurPeople />} />
              <Route path="financials" element={<Financials />} />
              <Route path="budget" element={<Budget />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notes" element={<Notes />} />
              <Route path="forms" element={<PortalForms />} />
              <Route path="documents" element={<Documents />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="insurance" element={<Insurance />} />
              <Route path="rsvp" element={<Rsvp />} />
              <Route path="history" element={<PortalHistory />} />
            </Route>

            {/* Couple Portal — nested */}
            <Route
              path="/portal"
              element={
                <ProtectedRoute requiredRole="couple">
                  <PortalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/portal/today" replace />} />
              <Route path="start" element={<StartHere />} />
              <Route path="today" element={<Today />} />
              <Route path="our-wedding" element={<OurWeekend />} />
              <Route path="timeline" element={<Timeline />} />
              <Route path="planning" element={<Planning />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="ceremony" element={<Ceremony />} />
              <Route path="decor" element={<Decor />} />
              <Route path="experiences" element={<Experiences />} />
              <Route path="seating" element={<Seating />} />
              <Route path="menus-meals" element={<MenusMeals />} />
              <Route path="our-people" element={<OurPeople />} />
              <Route path="financials" element={<Financials />} />
              <Route path="budget" element={<Budget />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notes" element={<Notes />} />
              <Route path="forms" element={<PortalForms />} />
              <Route path="documents" element={<Documents />} />
              <Route path="contracts" element={<Contracts />} />
              <Route path="insurance" element={<Insurance />} />
              <Route path="rsvp" element={<Rsvp />} />
              <Route path="history" element={<PortalHistory />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
