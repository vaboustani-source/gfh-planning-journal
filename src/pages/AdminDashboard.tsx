import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, MessageCircle, Clock, ChevronRight, LogOut } from "lucide-react";

interface EventCard {
  id: string;
  title: string;
  wedding_date: string | null;
  status: string;
  couple_names: string;
  unread_count: number;
  days_until: number | null;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      // Get all active events
      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("id, title, wedding_date, status")
        .in("status", ["onboarding", "active", "planning"])
        .order("wedding_date", { ascending: true });

      if (eventsError) throw eventsError;
      if (!eventsData) return;

      // For each event, get couple names and unread message count
      const enriched: EventCard[] = await Promise.all(
        eventsData.map(async (event) => {
          // Get couple users for this event
          const { data: euData } = await supabase
            .from("event_users")
            .select("user_id, role_in_event")
            .eq("event_id", event.id)
            .eq("role_in_event", "couple");

          let couple_names = event.title;

          if (euData && euData.length > 0) {
            const userIds = euData.map(eu => eu.user_id).filter(Boolean) as string[];
            if (userIds.length > 0) {
              const { data: usersData } = await supabase
                .from("users")
                .select("first_name, last_name")
                .in("id", userIds);

              if (usersData && usersData.length > 0) {
                couple_names = usersData
                  .map(u => u.first_name || u.last_name ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : "")
                  .filter(Boolean)
                  .join(" & ") || event.title;
              }
            }
          }

          // Get unread message count (messages with no read_at)
          const { count: unread_count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id)
            .is("read_at", null);

          // Calculate days until wedding
          let days_until: number | null = null;
          if (event.wedding_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const weddingDate = new Date(event.wedding_date);
            weddingDate.setHours(0, 0, 0, 0);
            days_until = Math.round((weddingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          }

          return {
            id: event.id,
            title: event.title,
            wedding_date: event.wedding_date,
            status: event.status,
            couple_names,
            unread_count: unread_count ?? 0,
            days_until,
          };
        })
      );

      setEvents(enriched);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Date TBD";
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysLabel = (days: number | null) => {
    if (days === null) return null;
    if (days < 0) return { text: `${Math.abs(days)} days ago`, color: "text-muted-foreground" };
    if (days === 0) return { text: "Today!", color: "text-primary font-semibold" };
    if (days === 1) return { text: "Tomorrow", color: "text-primary" };
    if (days <= 30) return { text: `${days} days away`, color: "text-sage" };
    const weeks = Math.round(days / 7);
    if (weeks <= 12) return { text: `${weeks} weeks away`, color: "text-foreground" };
    const months = Math.round(days / 30);
    return { text: `${months} months away`, color: "text-muted-foreground" };
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
                <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <span className="font-display text-lg font-light text-foreground tracking-wide">Gilbertsville</span>
              <span className="font-body text-xs text-muted-foreground ml-2">Farmhouse</span>
            </div>
          </div>

          <nav className="flex items-center gap-6">
            <span className="font-body text-sm font-medium text-primary border-b border-primary pb-0.5">
              Dashboard
            </span>
          </nav>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-body text-xs text-muted-foreground">Signed in as</p>
              <p className="font-body text-sm font-medium text-foreground">
                {profile?.first_name || "Brandon"}
              </p>
            </div>
            <button
              onClick={() => signOut().then(() => navigate("/login"))}
              className="flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="mb-10 animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
            Coordinator View
          </p>
          <h1 className="font-display text-5xl font-light text-foreground mb-2">
            Active Events
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            {loading ? "Loading…" : `${events.length} event${events.length !== 1 ? "s" : ""} in planning`}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-52 rounded-lg bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
              <Calendar size={24} className="text-muted-foreground" />
            </div>
            <h3 className="font-display text-2xl font-light text-foreground mb-2">No active events</h3>
            <p className="font-body text-sm text-muted-foreground max-w-xs">
              Active wedding events will appear here once they've been created.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event, i) => {
              const daysInfo = getDaysLabel(event.days_until);
              return (
                <button
                  key={event.id}
                  onClick={() => navigate(`/admin/events/${event.id}`)}
                  className="group text-left rounded-xl bg-card border border-border hover:border-sage/50 hover:shadow-card transition-all duration-300 overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
                >
                  {/* Top accent stripe */}
                  <div className="h-1 w-full bg-gradient-to-r from-sage/40 via-sage/60 to-sage/30" />

                  <div className="p-6">
                    {/* Names */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-display text-2xl font-light text-foreground group-hover:text-sage-dark transition-colors leading-tight">
                          {event.couple_names}
                        </h3>
                        <p className="font-body text-xs text-muted-foreground mt-0.5">
                          {event.title}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0"
                      />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border mb-4" />

                    {/* Date */}
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar size={13} className="text-sage flex-shrink-0" />
                      <span className="font-body text-xs text-foreground">
                        {formatDate(event.wedding_date)}
                      </span>
                    </div>

                    {/* Days countdown */}
                    {daysInfo && (
                      <div className="flex items-center gap-2 mb-3">
                        <Clock size={13} className="text-sage flex-shrink-0" />
                        <span className={`font-body text-xs ${daysInfo.color}`}>
                          {daysInfo.text}
                        </span>
                      </div>
                    )}

                    {/* Unread messages */}
                    <div className="flex items-center gap-2">
                      <MessageCircle size={13} className={event.unread_count > 0 ? "text-primary" : "text-muted-foreground"} />
                      {event.unread_count > 0 ? (
                        <span className="font-body text-xs font-semibold text-primary">
                          {event.unread_count} unread message{event.unread_count !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="font-body text-xs text-muted-foreground">No unread messages</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="px-6 pb-5">
                    <span className="inline-flex items-center rounded-full bg-sage/8 border border-sage/20 px-2.5 py-0.5 font-body text-xs text-sage capitalize">
                      {event.status}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
