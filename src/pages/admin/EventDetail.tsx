import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
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
import ActivityTab from "./tabs/ActivityTab";
import DecorTab from "./tabs/DecorTab";
import EventForms from "./tabs/EventForms";
import ExperiencesTab from "./tabs/ExperiencesTab";
import OurPeopleTab from "./tabs/OurPeopleTab";

const TABS = [
  { id: "overview", label: "Overview" },
  
  { id: "milestones", label: "Milestones" },
  { id: "checklist", label: "Checklist" },
  { id: "vendors", label: "Vendors" },
  { id: "ceremony", label: "Ceremony & Music" },
  { id: "decor", label: "Décor" },
  { id: "experiences", label: "Experiences" },
  { id: "timeline", label: "Timeline" },
  { id: "menus-bar", label: "Menus & Bar" },
  { id: "dietary", label: "Dietary & Kids" },
  { id: "our-people", label: "Our People" },
  { id: "financials", label: "Financials" },
  { id: "messages", label: "Messages" },
  { id: "notes", label: "Notes" },
  { id: "forms", label: "Forms" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

const TAB_ORDER = TABS.map(t => t.id);

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
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "overview");

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId }, { replace: true });
  }, [setSearchParams]);
  const [event, setEvent] = useState<EventData | null>(null);
  const [coupleNames, setCoupleNames] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const navigateToNextTab = useCallback(() => {
    const idx = TAB_ORDER.indexOf(activeTab);
    const nextIdx = (idx + 1) % TAB_ORDER.length;
    handleTabChange(TAB_ORDER[nextIdx]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, handleTabChange]);

  useEffect(() => {
    if (!eventId) return;
    fetchEvent();
    fetchUnread();
  }, [eventId]);

  const fetchEvent = async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId!)
      .single();
    if (data) setEvent(data);

    // Couple names
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="h-14 flex items-center gap-4">
            <button
              onClick={() => navigate("/admin")}
              className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={15} />
              Dashboard
            </button>
            <div className="h-4 w-px bg-border" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg font-light text-foreground truncate leading-tight">
                {coupleNames || event.title}
              </p>
              {days !== null && (
                <p className="font-body text-[11px] text-muted-foreground leading-none mt-0.5">
                  {days > 0 ? `${days} days until arrival` : days === 0 ? "Arrival is today" : `${Math.abs(days)} days since arrival`}
                </p>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`relative shrink-0 px-3 lg:px-4 py-3 font-body text-xs lg:text-sm transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.id === "messages" && unreadCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab content */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8 pb-24">
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
        {activeTab === "financials" && <FinancialsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
        {activeTab === "messages" && <AdminMessages eventId={event.id} onUnreadChange={setUnreadCount} />}
        {activeTab === "notes" && <AdminNotesTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
        {activeTab === "forms" && <EventForms eventId={event.id} />}
        {activeTab === "documents" && <AdminDocumentsTab eventId={event.id} onNavigateNext={navigateToNextTab} />}
        {activeTab === "activity" && <ActivityTab eventId={event.id} />}
      </main>
    </div>
  );
}
