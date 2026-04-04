import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import SetPassword from "./pages/SetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import EventDetail from "./pages/admin/EventDetail";
import AdminSettings from "./pages/admin/AdminSettings";
import PreviewPortalLayout from "./pages/admin/PreviewPortalLayout";
import PortalLayout from "./pages/portal/PortalLayout";
import Today from "./pages/portal/Today";
import OurWeekend from "./pages/portal/OurWeekend";
import Planning from "./pages/portal/Planning";
import Vendors from "./pages/portal/Vendors";
import Ceremony from "./pages/portal/Ceremony";
import Decor from "./pages/portal/Decor";
import MenusMeals from "./pages/portal/MenusMeals";
import OurPeople from "./pages/portal/OurPeople";
import Financials from "./pages/portal/Financials";
import Messages from "./pages/portal/Messages";
import Notes from "./pages/portal/Notes";
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
                  <AdminSettings />
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
              <Route path="today" element={<Today />} />
              <Route path="our-wedding" element={<OurWeekend />} />
              <Route path="planning" element={<Planning />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="ceremony" element={<Ceremony />} />
              <Route path="menus-meals" element={<MenusMeals />} />
              <Route path="our-people" element={<OurPeople />} />
              <Route path="financials" element={<Financials />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notes" element={<Notes />} />
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
              <Route path="today" element={<Today />} />
              <Route path="our-wedding" element={<OurWeekend />} />
              <Route path="planning" element={<Planning />} />
              <Route path="vendors" element={<Vendors />} />
              <Route path="ceremony" element={<Ceremony />} />
              <Route path="menus-meals" element={<MenusMeals />} />
              <Route path="our-people" element={<OurPeople />} />
              <Route path="financials" element={<Financials />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notes" element={<Notes />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
