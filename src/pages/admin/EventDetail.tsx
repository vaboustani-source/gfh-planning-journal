import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import OverviewTab from "./tabs/Overview";
import MilestonesTab from "./tabs/Milestones";
import ChecklistTab from "./tabs/Checklist";
import VendorsTab from "./tabs/Vendors";
import AdminMessages from "./tabs/AdminMessages";
import FinancialsTab from "./tabs/Financials";
import LodgingTab from "./tabs/Lodging";
import CeremonyTab from "./tabs/CeremonyTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "milestones", label: "Milestones" },
  { id: "checklist", label: "Checklist" },
  { id: "vendors", label: "Vendors" },
  { id: "messages", label: "Messages" },
  { id: "financials", label: "Financials" },
  { id: "lodging", label: "Lodging" },
  { id: "ceremony", label: "Ceremony" },
];

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
}

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [event, setEvent] = useState<EventData | null>(null);
  const [coupleNames, setCoupleNames] = useState("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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
      .eq("role_in_event", "couple");

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
                onClick={() => setActiveTab(tab.id)}
                className={`relative shrink-0 px-4 py-3 font-body text-sm transition-colors border-b-2 ${
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
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {activeTab === "overview" && <OverviewTab event={event} coupleNames={coupleNames} onUpdate={setEvent} />}
        {activeTab === "milestones" && <MilestonesTab eventId={event.id} />}
        {activeTab === "checklist" && <ChecklistTab eventId={event.id} />}
        {activeTab === "vendors" && <VendorsTab eventId={event.id} />}
        {activeTab === "messages" && <AdminMessages eventId={event.id} onUnreadChange={setUnreadCount} />}
        {activeTab === "financials" && <FinancialsTab eventId={event.id} />}
        {activeTab === "lodging" && <LodgingTab eventId={event.id} />}
      </main>
    </div>
  );
}
