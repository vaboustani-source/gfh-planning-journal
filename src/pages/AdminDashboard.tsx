import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, MessageCircle, Clock, ChevronRight, LogOut, Plus,
  AlertCircle, CreditCard, Settings,
} from "lucide-react";
import CreateEventModal from "@/components/admin/CreateEventModal";

interface EventCard {
  id: string;
  title: string;
  wedding_date: string | null;
  status: string;
  couple_names: string;
  unread_count: number;
  days_until: number | null;
}

interface AttentionItem {
  event_id: string;
  event_title: string;
  tab: string;
  type: "message" | "milestone" | "payment";
  label: string;
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchAttention();
  }, []);

  // Real-time unread badge updates
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { event_id: string | null; read_at: string | null; sender_id: string | null };
          if (!msg.event_id || msg.read_at !== null) return;
          // New unread message — bump the badge for that event card
          setEvents(prev =>
            prev.map(e =>
              e.id === msg.event_id
                ? { ...e, unread_count: e.unread_count + 1 }
                : e
            )
          );
          // Also add to Today's Attention if not already there
          setAttention(prev => {
            const alreadyThere = prev.some(
              a => a.event_id === msg.event_id && a.type === "message"
            );
            if (alreadyThere) return prev;
            const eventTitle = events.find(e => e.id === msg.event_id)?.couple_names ?? "Event";
            return [
              { event_id: msg.event_id!, event_title: eventTitle, tab: "messages", type: "message", label: "Unread messages" },
              ...prev,
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { event_id: string | null; read_at: string | null };
          if (!msg.event_id || msg.read_at === null) return;
          // Message was marked read — re-fetch the accurate count for that event
          supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("event_id", msg.event_id)
            .is("read_at", null)
            .then(({ count }) => {
              setEvents(prev =>
                prev.map(e =>
                  e.id === msg.event_id ? { ...e, unread_count: count ?? 0 } : e
                )
              );
            });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [events]);

  const fetchEvents = async () => {
    try {
      const { data: eventsData, error } = await supabase
        .from("events")
        .select("id, title, wedding_date, status")
        .in("status", ["onboarding", "active", "planning"])
        .order("wedding_date", { ascending: true });

      if (error) throw error;
      if (!eventsData) return;

      const enriched: EventCard[] = await Promise.all(
        eventsData.map(async (event) => {
          const { data: euData } = await supabase
            .from("event_users")
            .select("user_id")
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
                  .map(u => `${u.first_name || ""} ${u.last_name || ""}`.trim())
                  .filter(Boolean)
                  .join(" & ") || event.title;
              }
            }
          }

          const { count: unread_count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("event_id", event.id)
            .is("read_at", null);

          let days_until: number | null = null;
          if (event.wedding_date) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const weddingDate = new Date(event.wedding_date); weddingDate.setHours(0, 0, 0, 0);
            days_until = Math.round((weddingDate.getTime() - today.getTime()) / 86400000);
          }

          return { id: event.id, title: event.title, wedding_date: event.wedding_date, status: event.status, couple_names, unread_count: unread_count ?? 0, days_until };
        })
      );
      setEvents(enriched);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttention = async () => {
    const items: AttentionItem[] = [];

    try {
      // Events with active events
      const { data: allEvents } = await supabase
        .from("events")
        .select("id, title")
        .in("status", ["onboarding", "active", "planning"]);

      if (!allEvents) return;

      const eventIds = allEvents.map(e => e.id);
      const eventMap = Object.fromEntries(allEvents.map(e => [e.id, e.title]));

      // Unread messages
      const { data: unreadMsgs } = await supabase
        .from("messages")
        .select("event_id")
        .in("event_id", eventIds)
        .is("read_at", null);

      const unreadByEvent = new Set((unreadMsgs ?? []).map(m => m.event_id).filter(Boolean));
      unreadByEvent.forEach(eid => {
        if (!eid) return;
        items.push({ event_id: eid, event_title: eventMap[eid] ?? "Event", tab: "messages", type: "message", label: "Unread messages" });
      });

      // Milestones within 14 days still pending
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const in14 = new Date(today); in14.setDate(today.getDate() + 14);
      const { data: milestones } = await supabase
        .from("milestones")
        .select("event_id, title, target_date")
        .in("event_id", eventIds)
        .eq("status", "pending")
        .lte("target_date", in14.toISOString().split("T")[0])
        .gte("target_date", today.toISOString().split("T")[0]);

      (milestones ?? []).forEach(m => {
        if (!m.event_id) return;
        items.push({ event_id: m.event_id, event_title: eventMap[m.event_id] ?? "Event", tab: "milestones", type: "milestone", label: `Milestone due: ${m.title}` });
      });

      // Overdue milestones
      const { data: overdue } = await supabase
        .from("milestones")
        .select("event_id, title, target_date")
        .in("event_id", eventIds)
        .eq("status", "pending")
        .lt("target_date", today.toISOString().split("T")[0]);

      (overdue ?? []).forEach(m => {
        if (!m.event_id) return;
        items.push({ event_id: m.event_id, event_title: eventMap[m.event_id] ?? "Event", tab: "milestones", type: "milestone", label: `Overdue milestone: ${m.title}` });
      });

      // Payments due within 7 days, unpaid
      const in7 = new Date(today); in7.setDate(today.getDate() + 7);
      const { data: payments } = await supabase
        .from("payment_schedule")
        .select("event_id, label, due_date")
        .in("event_id", eventIds)
        .eq("paid", false)
        .lte("due_date", in7.toISOString().split("T")[0])
        .gte("due_date", today.toISOString().split("T")[0]);

      (payments ?? []).forEach(p => {
        if (!p.event_id) return;
        items.push({ event_id: p.event_id, event_title: eventMap[p.event_id] ?? "Event", tab: "financials", type: "payment", label: `Payment due: ${p.label}` });
      });

      setAttention(items);
    } catch (err) {
      console.error("Error fetching attention items:", err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Date TBD";
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
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

  const attentionIcon = (type: AttentionItem["type"]) => {
    if (type === "message") return <MessageCircle size={12} className="text-primary shrink-0" />;
    if (type === "milestone") return <AlertCircle size={12} className="text-sage shrink-0" />;
    return <CreditCard size={12} className="text-muted-foreground shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
                <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <div>
              <span className="font-display text-lg font-light text-foreground tracking-wide">Gilbertsville</span>
              <span className="font-body text-xs text-muted-foreground ml-2">Farmhouse</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-body text-xs text-muted-foreground">Signed in as</p>
              <p className="font-body text-sm font-medium text-foreground">{profile?.first_name || "Brandon"}</p>
            </div>
            <button
              onClick={() => navigate("/admin/settings")}
              title="Settings"
              className="flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings size={15} />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button onClick={() => signOut().then(() => navigate("/login"))}
              className="flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
              <LogOut size={14} />Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page header */}
        <div className="flex items-end justify-between mb-10 animate-fade-up">
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator View</p>
            <h1 className="font-display text-5xl font-light text-foreground mb-1">Active Events</h1>
            <p className="font-body text-sm text-muted-foreground">
              {loading ? "Loading…" : `${events.length} event${events.length !== 1 ? "s" : ""} in planning`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={15} />
            New Event
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Event cards */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3].map(i => <div key={i} className="h-52 rounded-xl bg-card border border-border animate-pulse" />)}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
                  <Calendar size={24} className="text-muted-foreground" />
                </div>
                <h3 className="font-display text-2xl font-light text-foreground mb-2">No active events</h3>
                <p className="font-body text-sm text-muted-foreground max-w-xs mb-6">Create your first wedding event to get started.</p>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90">
                  <Plus size={14} /> Create Event
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {events.map((event, i) => {
                  const daysInfo = getDaysLabel(event.days_until);
                  return (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                      className="group text-left rounded-xl bg-card border border-border hover:border-sage/50 hover:shadow-card transition-all duration-300 overflow-hidden animate-fade-up"
                      style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
                    >
                      <div className="h-1 w-full bg-gradient-to-r from-sage/40 via-sage/60 to-sage/30" />
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-display text-2xl font-light text-foreground group-hover:text-sage-dark transition-colors leading-tight">{event.couple_names}</h3>
                            <p className="font-body text-xs text-muted-foreground mt-0.5">{event.title}</p>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1 flex-shrink-0" />
                        </div>
                        <div className="h-px bg-border mb-4" />
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar size={13} className="text-sage flex-shrink-0" />
                          <span className="font-body text-xs text-foreground">{formatDate(event.wedding_date)}</span>
                        </div>
                        {daysInfo && (
                          <div className="flex items-center gap-2 mb-3">
                            <Clock size={13} className="text-sage flex-shrink-0" />
                            <span className={`font-body text-xs ${daysInfo.color}`}>{daysInfo.text}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MessageCircle size={13} className={event.unread_count > 0 ? "text-primary" : "text-muted-foreground"} />
                          {event.unread_count > 0 ? (
                            <span className="font-body text-xs font-semibold text-primary">{event.unread_count} unread message{event.unread_count !== 1 ? "s" : ""}</span>
                          ) : (
                            <span className="font-body text-xs text-muted-foreground">No unread messages</span>
                          )}
                        </div>
                      </div>
                      <div className="px-6 pb-5">
                        <span className="inline-flex items-center rounded-full bg-sage/8 border border-sage/20 px-2.5 py-0.5 font-body text-xs text-sage capitalize">{event.status}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Today's Attention sidebar */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="rounded-xl bg-card border border-border overflow-hidden sticky top-24">
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <p className="font-display text-lg font-light text-foreground">Today's Attention</p>
                <p className="font-body text-xs text-muted-foreground mt-0.5">Items needing your review</p>
              </div>

              {attention.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mx-auto mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">All clear — nothing urgent right now.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {attention.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(`/admin/events/${item.event_id}?tab=${item.tab}`)}
                      className="w-full text-left px-5 py-3.5 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="flex items-start gap-2.5">
                        {attentionIcon(item.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-xs font-medium text-foreground truncate">{item.label}</p>
                          <p className="font-body text-[10px] text-muted-foreground mt-0.5 truncate">{item.event_title}</p>
                        </div>
                        <ChevronRight size={12} className="text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
