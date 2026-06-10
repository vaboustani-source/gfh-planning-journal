import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, NavLink } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Menu, X } from "lucide-react";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";
import OverviewTab from "./tabs/Overview";
import MilestonesTab from "./tabs/Milestones";
import ChecklistTab from "./tabs/Checklist";
import VendorsTab from "./tabs/Vendors";
import AdminMessages from "./tabs/AdminMessages";
import FinancialsTab from "./tabs/Financials";

import CeremonyTab from "./tabs/CeremonyTab";
import TimelineTab from "./tabs/TimelineTab";
import DietaryTab from "./tabs/DietaryTab";
import MenusBarTab from "./tabs/MenusBarTab";
import AdminNotesTab from "./tabs/AdminNotesTab";
import AdminDocumentsTab from "./tabs/AdminDocumentsTab";
import ContractsTab from "./tabs/ContractsTab";
import ActivityTab from "./tabs/ActivityTab";
import DecorTab from "./tabs/DecorTab";
import EventForms from "./tabs/EventForms";
import ExperiencesTab from "./tabs/ExperiencesTab";
import OurPeopleTab from "./tabs/OurPeopleTab";
import EmailsTab from "./tabs/EmailsTab";
import Rsvp from "../portal/Rsvp";
import { LifecycleBadge } from "@/components/admin/HandoffPanel";
import { MidweekBadge } from "@/components/admin/MidweekBadge";

type NavItem = { id: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Event Overview",
    items: [
      { id: "overview", label: "Overview" },
      { id: "milestones", label: "Milestones" },
      { id: "activity", label: "Activity" },
    ],
  },
  {
    label: "Guests & Lodging",
    items: [
      { id: "our-people", label: "Our People" },
      { id: "rsvp", label: "RSVP" },
    ],
  },
  {
    label: "Planning",
    items: [
      { id: "checklist", label: "Checklist" },
      { id: "forms", label: "Forms" },
      { id: "documents", label: "Documents" },
      { id: "contracts", label: "Contracts" },
    ],
  },
  {
    label: "Vendors & Services",
    items: [
      { id: "vendors", label: "Vendors" },
      { id: "experiences", label: "Experiences" },
      { id: "decor", label: "Décor" },
    ],
  },
  {
    label: "Weekend Details",
    items: [
      { id: "ceremony", label: "Ceremony & Music" },
      { id: "timeline", label: "Timeline" },
      { id: "menus-bar", label: "Menus & Bar" },
      { id: "dietary", label: "Dietary & Kids" },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "financials", label: "Financials" },
      { id: "messages", label: "Messages" },
      { id: "emails", label: "Emails" },
      { id: "notes", label: "Notes" },
    ],
  },
];

const TAB_ORDER = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));

export interface EventData {
  id: string;
  title: string;
  wedding_date: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  ceremony_location: string | null;
  cocktail_hour_location: string | null;
  rehearsal_dinner_location: string | null;
  package_tier: string | null;
  status: string;
  event_type: string;
  estimated_guest_count: number | null;
  tasting_date: string | null;
  how_heard: string | null;
  wedding_date_note: string | null;
  arrival_date_note: string | null;
  departure_date_note: string | null;
  tasting_date_note: string | null;
  lifecycle_stage?: string | null;
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams]);

  const [event, setEvent] = useState<EventData | null>(null);
  const [coupleNames, setCoupleNames] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const navigateToNextTab = useCallback(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = (idx + 1) % TAB_ORDER.length;
    handleTabChange(TAB_ORDER[nextIdx]);
  }, [activeTab, handleTabChange]);

  useEffect(() => {
    if (!eventId) return;
    fetchEvent();
    fetchUnread();
  }, [eventId]);

  // Keep activeTab in sync with URL changes
  useEffect(() => {
    const t = searchParams.get("tab") || "overview";
    if (t !== activeTab) setActiveTab(t);
  }, [searchParams]);

  const fetchEvent = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId!)
      .single();
    if (data) setEvent(data);

    const { data: euData } = await supabase
      .from("event_users")
      .select("user_id")
      .eq("event_id", eventId!)
      .in("role_in_event", ["partner_1", "partner_2", "couple"]);

    if (euData && euData.length > 0) {
      const ids = euData.map(r => r.user_id).filter(Boolean) as string[];
      const { data: usersData } = await supabase
        .from("users")
        .select("first_name, last_name")
        .in("id", ids);
      if (usersData) {
        const names = usersData
          .map(u => `${u.first_name || ""} ${u.last_name || ""}`.trim())
          .filter(Boolean)
          .join(" & ");
        setCoupleNames(names);
      }
    }
    setLoading(false);
  };

  const fetchUnread = async () => {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId!)
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  };

  const daysUntilArrival = () => {
    if (!event?.arrival_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const arrival = new Date(event.arrival_date); arrival.setHours(0, 0, 0, 0);
    return Math.round((arrival.getTime() - today.getTime()) / 86400000);
  };

  const days = daysUntilArrival();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sage/30 border-t-sage animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-body text-muted-foreground">Event not found.</p>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-border">
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 font-body text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>
        <p className="font-display text-base font-medium text-foreground leading-tight truncate">
          {coupleNames || event.title}
        </p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <LifecycleBadge stage={(event.lifecycle_stage ?? "portal_open") as any} />
          <MidweekBadge weddingDate={event.wedding_date} />
        </div>
        {days !== null && (
          <p className="font-body text-[11px] text-muted-foreground mt-1">
            {days > 0 ? `${days} days until arrival` : days === 0 ? "Arrival is today" : `${Math.abs(days)} days since arrival`}
          </p>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi === 0 ? "" : "mt-4"}>
            <p className="px-3 pt-2 pb-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-col">
              {group.items.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`relative flex items-center justify-between w-full h-9 pl-4 pr-3 font-body text-sm transition-colors border-l-2 ${
                      isActive
                        ? "border-sage bg-sage/10 text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.id === "messages" && unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  const activeLabel = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeTab)?.label || "";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-sidebar sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 bg-sidebar border-r border-border flex flex-col h-full shadow-elevated">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground z-10"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-sm border-b border-border flex items-center px-4 h-14 gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 -ml-1.5 text-foreground">
            <Menu size={20} strokeWidth={1.75} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-display text-base font-light text-foreground truncate inline-flex items-center gap-2">
              <span className="truncate">{coupleNames || event.title}</span>
              <MidweekBadge weddingDate={event.wedding_date} />
            </p>
            <p className="font-body text-[10px] text-muted-foreground leading-none">{activeLabel}</p>
          </div>
          <GlobalSearchTrigger scope="admin-event" eventId={event.id} variant="icon" />
        </header>

        {/* Desktop search bar */}
        <div className="hidden lg:flex sticky top-0 z-20 bg-background/85 backdrop-blur-sm border-b border-border px-8 py-2.5">
          <GlobalSearchTrigger scope="admin-event" eventId={event.id} variant="bar" />
        </div>


        <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-8 pb-24">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <OverviewTab event={event} coupleNames={coupleNames} onUpdate={setEvent} onNavigateNext={navigateToNextTab} />}
            {activeTab === "milestones" && <MilestonesTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "checklist" && <ChecklistTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "vendors" && <VendorsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "ceremony" && <CeremonyTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "decor" && <DecorTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "experiences" && <ExperiencesTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "timeline" && <TimelineTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "menus-bar" && <MenusBarTab eventId={event.id} onNavigateNext={navigateToNextTab} tastingDate={event.tasting_date} tastingDateNote={event.tasting_date_note} />}
            {activeTab === "dietary" && <DietaryTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "our-people" && <OurPeopleTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "rsvp" && <Rsvp eventId={event.id} />}
            {activeTab === "financials" && <FinancialsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "messages" && <AdminMessages eventId={event.id} onUnreadChange={setUnreadCount} />}
            {activeTab === "emails" && <EmailsTab eventId={event.id} />}
            {activeTab === "notes" && <AdminNotesTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "forms" && <EventForms eventId={event.id} />}
            {activeTab === "documents" && <AdminDocumentsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "contracts" && <ContractsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
            {activeTab === "activity" && <ActivityTab eventId={event.id} />}
          </div>
        </main>
      </div>
    </div>
  );
}
