import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, CalendarClock, MessageCircle, Clock, ChevronRight, LogOut, Plus,
  AlertCircle, CreditCard, Settings, Eye, FileText, Users, Inbox, Sparkles, TrendingUp, BarChart3,
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermission";
import { Progress } from "@/components/ui/progress";
import CreateEventModal from "@/components/admin/CreateEventModal";
import ActionQueue from "@/components/admin/ActionQueue";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";
import { MidweekBadge } from "@/components/admin/MidweekBadge";
import { format, differenceInDays, parseISO, isValid } from "date-fns";

/* ─── Types ─── */
interface MilestoneInfo {
  total: number;
  completed: number;
  next_title: string | null;
  next_date: string | null;
}

interface EventCard {
  id: string;
  title: string;
  wedding_date: string | null;
  arrival_date: string | null;
  status: string;
  couple_names: string;
  unread_count: number;
  days_until: number | null;
  milestones: MilestoneInfo;
}

type AttentionType = "message" | "milestone" | "payment" | "timeline" | "quiet";

interface AttentionItem {
  event_id: string;
  event_title: string;
  tab: string;
  type: AttentionType;
  label: string;
  critical?: boolean;
}

/* ─── Helpers ─── */
const daysFromNow = (dateStr: string | null): number | null => {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return differenceInDays(d, today);
};

const autoStatus = (completed: number) => {
  if (completed <= 2) return { label: "Onboarding", color: "bg-muted text-muted-foreground" };
  if (completed <= 10) return { label: "Active Planning", color: "bg-sage/15 text-sage" };
  if (completed <= 14) return { label: "Final Phase", color: "bg-amber-100 text-amber-700" };
  return { label: "Ready", color: "bg-emerald-100 text-emerald-700" };
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "Date TBD";
  const d = parseISO(dateStr);
  if (!isValid(d)) return "Date TBD";
  return format(d, "EEEE, MMMM d, yyyy");
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

/* ─── Component ─── */
export default function AdminDashboard() {
  const { profile, signOut, user } = useAuth();
  const { canView } = usePermissions();
  const currentUserId = user?.id ?? null;
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const eventsRef = useRef<EventCard[]>([]);
  useEffect(() => { eventsRef.current = events; }, [events]);

  useEffect(() => {
    if (currentUserId) fetchAll();
  }, [currentUserId]);

  /* ─── Real-time unread badge ─── */
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel("admin-dashboard-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { event_id: string | null; read_at: string | null; sender_id: string | null };
        if (!msg.event_id || msg.read_at !== null) return;
        if (msg.sender_id === currentUserId) return;
        setEvents(prev => prev.map(e => e.id === msg.event_id ? { ...e, unread_count: e.unread_count + 1 } : e));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { event_id: string | null; read_at: string | null };
        if (!msg.event_id) return;
        supabase.from("messages").select("id", { count: "exact", head: true })
          .eq("event_id", msg.event_id).is("read_at", null).neq("sender_id", currentUserId)
          .then(({ count }) => {
            setEvents(prev => prev.map(e => e.id === msg.event_id ? { ...e, unread_count: count ?? 0 } : e));
          });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const fetchAll = async () => {
    try {
      /* Events */
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, wedding_date, arrival_date, status")
        .in("status", ["onboarding", "active", "planning"])
        .order("wedding_date", { ascending: true });
      if (!eventsData) { setLoading(false); return; }

      const eventIds = eventsData.map(e => e.id);

      /* Parallel fetches */
      const [euRes, milestonesRes, unreadRes, timelineRes, paymentsRes, lastMsgRes] = await Promise.all([
        supabase.from("event_users").select("event_id, user_id").in("event_id", eventIds).eq("role_in_event", "couple"),
        supabase.from("milestones").select("event_id, title, target_date, status, sort_order").in("event_id", eventIds).order("sort_order", { ascending: true }),
        supabase.from("messages").select("event_id, read_at, sender_id").in("event_id", eventIds).is("read_at", null).neq("sender_id", currentUserId),
        supabase.from("working_timeline").select("event_id, published").in("event_id", eventIds),
        supabase.from("payment_schedule").select("event_id, label, due_date, paid").in("event_id", eventIds).eq("paid", false),
        supabase.from("messages").select("event_id, created_at").in("event_id", eventIds).order("created_at", { ascending: false }),
      ]);

      /* Couple name lookup */
      const coupleUserIds = [...new Set((euRes.data ?? []).map(eu => eu.user_id).filter(Boolean))] as string[];
      let usersMap: Record<string, string> = {};
      if (coupleUserIds.length > 0) {
        const { data: usersData } = await supabase.from("users").select("id, first_name, last_name").in("id", coupleUserIds);
        (usersData ?? []).forEach(u => {
          usersMap[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        });
      }

      /* Index data by event */
      const euByEvent: Record<string, string[]> = {};
      (euRes.data ?? []).forEach(eu => {
        if (!eu.event_id || !eu.user_id) return;
        if (!euByEvent[eu.event_id]) euByEvent[eu.event_id] = [];
        euByEvent[eu.event_id].push(eu.user_id);
      });

      const milestonesByEvent: Record<string, typeof milestonesRes.data> = {};
      (milestonesRes.data ?? []).forEach(m => {
        if (!m.event_id) return;
        if (!milestonesByEvent[m.event_id]) milestonesByEvent[m.event_id] = [];
        milestonesByEvent[m.event_id]!.push(m);
      });

      const unreadByEvent: Record<string, number> = {};
      (unreadRes.data ?? []).forEach(m => {
        if (!m.event_id) return;
        unreadByEvent[m.event_id] = (unreadByEvent[m.event_id] ?? 0) + 1;
      });

      const timelineByEvent: Record<string, boolean> = {};
      (timelineRes.data ?? []).forEach(t => {
        if (t.event_id) timelineByEvent[t.event_id] = t.published ?? false;
      });

      // Latest message per event
      const lastMsgByEvent: Record<string, string> = {};
      (lastMsgRes.data ?? []).forEach(m => {
        if (m.event_id && !lastMsgByEvent[m.event_id]) lastMsgByEvent[m.event_id] = m.created_at!;
      });

      /* Build enriched cards */
      const enriched: EventCard[] = eventsData.map(event => {
        const coupleIds = euByEvent[event.id] ?? [];
        const coupleNames = coupleIds.map(uid => usersMap[uid]).filter(Boolean).join(" & ") || event.title;

        const ms = milestonesByEvent[event.id] ?? [];
        const completedCount = ms.filter(m => m.status === "complete").length;
        const nextMilestone = ms.find(m => m.status !== "complete");

        return {
          id: event.id,
          title: event.title,
          wedding_date: event.wedding_date,
          arrival_date: event.arrival_date,
          status: event.status,
          couple_names: coupleNames,
          unread_count: unreadByEvent[event.id] ?? 0,
          days_until: daysFromNow(event.wedding_date),
          milestones: {
            total: ms.length || 15,
            completed: completedCount,
            next_title: nextMilestone?.title ?? null,
            next_date: nextMilestone?.target_date ?? null,
          },
        };
      });

      setEvents(enriched);

      /* ─── Today's Attention ─── */
      const items: AttentionItem[] = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];
      const in14 = new Date(today); in14.setDate(today.getDate() + 14);
      const in14Str = in14.toISOString().split("T")[0];

      const eventMap = Object.fromEntries(enriched.map(e => [e.id, e.couple_names]));

      // Unread messages
      Object.entries(unreadByEvent).forEach(([eid, count]) => {
        if (count > 0) items.push({ event_id: eid, event_title: eventMap[eid] ?? "Event", tab: "messages", type: "message", label: `${count} unread message${count !== 1 ? "s" : ""}` });
      });

      // Overdue milestones
      (milestonesRes.data ?? []).forEach(m => {
        if (!m.event_id || m.status === "complete") return;
        if (m.target_date && m.target_date < todayStr) {
          items.push({ event_id: m.event_id, event_title: eventMap[m.event_id] ?? "Event", tab: "milestones", type: "milestone", label: `Overdue: ${m.title}`, critical: true });
        }
      });

      // Upcoming milestones within 14 days
      (milestonesRes.data ?? []).forEach(m => {
        if (!m.event_id || m.status === "complete") return;
        if (m.target_date && m.target_date >= todayStr && m.target_date <= in14Str) {
          items.push({ event_id: m.event_id, event_title: eventMap[m.event_id] ?? "Event", tab: "milestones", type: "milestone", label: `Due soon: ${m.title}` });
        }
      });

      // Overdue payments + payments due within 14 days
      (paymentsRes.data ?? []).forEach(p => {
        if (!p.event_id || !p.due_date) return;
        if (p.due_date < todayStr) {
          const daysOver = Math.abs(differenceInDays(parseISO(p.due_date), today));
          items.push({ event_id: p.event_id, event_title: eventMap[p.event_id] ?? "Event", tab: "financials", type: "payment", label: `Overdue ${daysOver}d: ${p.label}`, critical: true });
        } else if (p.due_date >= todayStr && p.due_date <= in14Str) {
          items.push({ event_id: p.event_id, event_title: eventMap[p.event_id] ?? "Event", tab: "financials", type: "payment", label: `Payment due: ${p.label}`, critical: true });
        }
      });

      // Unpublished timelines where wedding < 90 days
      enriched.forEach(e => {
        if (timelineByEvent[e.id] === false && e.days_until !== null && e.days_until <= 90 && e.days_until >= 0) {
          items.push({ event_id: e.id, event_title: eventMap[e.id] ?? "Event", tab: "timeline", type: "timeline", label: "Timeline not published" });
        }
      });

      // Quiet couples (no message in 14+ days)
      enriched.forEach(e => {
        const lastMsg = lastMsgByEvent[e.id];
        if (!lastMsg) {
          items.push({ event_id: e.id, event_title: eventMap[e.id] ?? "Event", tab: "messages", type: "quiet", label: "No messages yet" });
        } else {
          const daysSince = daysFromNow(lastMsg);
          if (daysSince !== null && daysSince < -14) {
            items.push({ event_id: e.id, event_title: eventMap[e.id] ?? "Event", tab: "messages", type: "quiet", label: `No messages in ${Math.abs(daysSince)} days` });
          }
        }
      });

      setAttention(items);
    } catch (err) {
      console.error("Error fetching dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Derived stats ─── */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeCount = events.length;
  const upcomingThisMonth = events.filter(e => {
    const d = daysFromNow(e.arrival_date);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const totalUnread = events.reduce((s, e) => s + e.unread_count, 0);
  const overdueCount = attention.filter(a => a.type === "milestone" && a.label.startsWith("Overdue")).length;

  const upcomingSoon = events.filter(e => {
    const d = daysFromNow(e.arrival_date);
    return d !== null && d >= 0 && d <= 60;
  });

  /* Season view — group by month */
  const eventsByMonth: Record<string, EventCard[]> = {};
  [...events].sort((a, b) => {
    const da = a.arrival_date || a.wedding_date || "";
    const db = b.arrival_date || b.wedding_date || "";
    return da.localeCompare(db);
  }).forEach(e => {
    const dateStr = e.arrival_date || e.wedding_date;
    const key = dateStr ? format(parseISO(dateStr), "MMMM yyyy") : "Date TBD";
    if (!eventsByMonth[key]) eventsByMonth[key] = [];
    eventsByMonth[key].push(e);
  });

  /* Attention grouped by type */
  const attentionGroupsDef: { type: AttentionType; title: string; items: AttentionItem[] }[] = [
    { type: "message" as AttentionType, title: "Unread Messages", items: attention.filter(a => a.type === "message") },
    { type: "milestone" as AttentionType, title: "Milestones", items: attention.filter(a => a.type === "milestone") },
    { type: "payment" as AttentionType, title: "Payments", items: attention.filter(a => a.type === "payment") },
    { type: "timeline" as AttentionType, title: "Timelines", items: attention.filter(a => a.type === "timeline") },
    { type: "quiet" as AttentionType, title: "Quiet Couples", items: attention.filter(a => a.type === "quiet") },
  ];
  const attentionGroups = attentionGroupsDef.filter(g => g.items.length > 0);

  const attentionIcon = (type: AttentionType) => {
    if (type === "message") return <MessageCircle size={12} className="text-primary shrink-0" />;
    if (type === "milestone") return <AlertCircle size={12} className="text-sage shrink-0" />;
    if (type === "payment") return <CreditCard size={12} className="text-amber-600 shrink-0" />;
    if (type === "timeline") return <FileText size={12} className="text-muted-foreground shrink-0" />;
    return <Clock size={12} className="text-muted-foreground shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
              <span className="font-display text-lg font-light text-foreground tracking-wide">Gilbertsville Farmhouse</span>
              <span className="font-body text-xs text-muted-foreground ml-2">Admin Planning Journal</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <GlobalSearchTrigger scope="admin-dashboard" variant="bar" />

            <div className="text-right hidden sm:block">
              <p className="font-body text-xs text-muted-foreground">Signed in as</p>
              <p className="font-body text-sm font-medium text-foreground">{profile?.first_name || "Brandon"}</p>
            </div>
            {canView("marketing_roster") && (
              <button
                onClick={() => navigate("/admin/marketing-roster")}
                title="Marketing Roster"
                aria-label="Marketing Roster"
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                <Sparkles size={20} />
              </button>
            )}
            {canView("sales_roster") && (
              <button
                onClick={() => navigate("/admin/sales-roster")}
                title="Sales Roster"
                aria-label="Sales Roster"
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                <TrendingUp size={20} />
              </button>
            )}
            {canView("gmail_inbox") && (
              <button
                onClick={() => navigate("/admin/inbox")}
                title="Inbox"
                aria-label="Inbox"
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                <Inbox size={20} />
              </button>
            )}
            {profile?.role === "admin" && (
              <button
                onClick={() => navigate("/admin/ceo-dashboard")}
                title="CEO Dashboard"
                aria-label="CEO Dashboard"
                className="transition-colors text-muted-foreground hover:text-foreground"
              >
                <BarChart3 size={20} />
              </button>
            )}
            {canView("settings") && (
              <button
                onClick={() => navigate("/admin/settings")}
                title="Settings"
                aria-label="Settings"
                className="transition-colors"
                style={{ color: "#6B6B6B" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#2C3E2D")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6B6B")}
              >
                <Settings size={20} />
              </button>
            )}
            <button onClick={() => signOut().then(() => navigate("/login"))} className="flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
              <LogOut size={14} />Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page header + New Event */}
        <div className="flex items-end justify-between mb-6 animate-fade-up">
          <div>
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Coordinator View</p>
            <h1 className="font-display text-5xl font-light text-foreground mb-1">Dashboard</h1>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity">
            <Plus size={15} /> New Event
          </button>
        </div>

        {/* ─── Action Queue (Needs Your Attention) ─── */}
        <div className="mb-8">
          <ActionQueue />
        </div>

        {/* ─── Quick Stats Bar ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-up" style={{ animationDelay: "60ms" }}>
          {[
            { icon: Calendar, label: "Active Events", value: activeCount, onClick: () => {} },
            { icon: CalendarClock, label: "Upcoming This Month", value: upcomingThisMonth, onClick: () => {} },
            { icon: MessageCircle, label: "Unread Messages", value: totalUnread, onClick: () => navigate("/admin/messages") },
            { icon: AlertCircle, label: "Overdue Milestones", value: overdueCount, onClick: () => {} },
          ].map((stat, i) => (
            <button key={i} onClick={stat.onClick} className="bg-sage/10 rounded-xl px-4 py-3 text-left hover:bg-sage/15 transition-colors group">
              <div className="flex items-center gap-2 mb-1">
                <stat.icon size={14} className="text-sage" />
                <span className="font-display text-2xl font-light text-foreground">{loading ? "–" : stat.value}</span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground">{stat.label}</p>
            </button>
          ))}
        </div>

        {/* ─── Upcoming Soon ─── */}
        {!loading && upcomingSoon.length > 0 && (
          <div className="mb-8 animate-fade-up" style={{ animationDelay: "120ms" }}>
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">Arriving Soon</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingSoon.map(e => {
                const arrDays = daysFromNow(e.arrival_date);
                return (
                  <button key={e.id} onClick={() => navigate(`/admin/events/${e.id}`)} className="bg-card border border-sage/30 rounded-xl px-5 py-4 text-left hover:border-sage/50 hover:shadow-card transition-all group">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-display text-lg font-light text-foreground">{e.couple_names}</h4>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-body text-[10px] text-amber-700 font-medium">Final prep</span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground">
                      Arrives {e.arrival_date ? format(parseISO(e.arrival_date), "MMM d") : "TBD"} · {arrDays !== null ? `${arrDays} days away` : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Two-column layout ─── */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Event cards */}
          <div className="flex-1 min-w-0">
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">All Events</p>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3].map(i => <div key={i} className="h-56 rounded-xl bg-card border border-border animate-pulse" />)}
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
                  const status = autoStatus(event.milestones.completed);
                  const progressPct = event.milestones.total > 0 ? Math.round((event.milestones.completed / event.milestones.total) * 100) : 0;
                  return (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/admin/events/${event.id}`)}
                      className="group text-left rounded-xl bg-card border border-border hover:border-sage/50 hover:shadow-card transition-all duration-300 overflow-hidden animate-fade-up"
                      style={{ animationDelay: `${i * 60}ms`, opacity: 0 }}
                    >
                      <div className="h-1 w-full bg-gradient-to-r from-sage/40 via-sage/60 to-sage/30" />
                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display text-xl font-light text-foreground group-hover:text-sage-dark transition-colors leading-tight truncate">{event.couple_names}</h3>
                              <MidweekBadge weddingDate={event.wedding_date} />
                            </div>
                            <p className="font-body text-[11px] text-muted-foreground mt-0.5">{formatDate(event.wedding_date)}</p>
                          </div>
                          <div className="flex items-center gap-2 mt-1 shrink-0">
                            {event.unread_count > 0 && (
                              <span className="relative flex h-5 min-w-5 items-center justify-center">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40" />
                                <span className="relative inline-flex items-center justify-center rounded-full h-5 min-w-5 px-1 bg-primary text-primary-foreground font-body text-[10px] font-bold">{event.unread_count}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Days away */}
                        {daysInfo && (
                          <p className={`font-body text-xs mb-3 ${daysInfo.color}`}>{daysInfo.text}</p>
                        )}

                        {/* Milestone progress */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-body text-[10px] text-muted-foreground">{event.milestones.completed} of {event.milestones.total} milestones</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[10px] font-medium ${status.color}`}>{status.label}</span>
                          </div>
                          <Progress value={progressPct} className="h-1.5" />
                        </div>

                        {/* Next milestone */}
                        {event.milestones.next_title && (
                          <p className="font-body text-[11px] text-muted-foreground truncate mb-3">
                            Next: {event.milestones.next_title}
                            {event.milestones.next_date && ` · ${format(parseISO(event.milestones.next_date), "MMM d")}`}
                          </p>
                        )}

                        {/* Bottom actions */}
                        <div className="h-px bg-border mb-3" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}?tab=messages`); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors"
                              title="Messages"
                            >
                              <MessageCircle size={14} className={event.unread_count > 0 ? "text-primary" : "text-muted-foreground"} />
                            </span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/preview/${event.id}`); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors"
                              title="Preview Portal"
                            >
                              <Eye size={14} className="text-muted-foreground" />
                            </span>
                            <span
                              role="button"
                              onClick={(e) => { e.stopPropagation(); navigate(`/admin/events/${event.id}?tab=timeline`); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors"
                              title="Timeline"
                            >
                              <Clock size={14} className="text-muted-foreground" />
                            </span>
                          </div>
                          <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          {/* ─── Today's Attention Sidebar ─── */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="rounded-xl bg-card border border-border overflow-hidden sticky top-24">
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <p className="font-display text-lg font-light text-foreground">Today's Attention</p>
                <p className="font-body text-xs text-muted-foreground mt-0.5">Items needing your review</p>
              </div>

              {attentionGroups.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mx-auto mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-sage">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-body text-sm text-muted-foreground">All clear — nothing urgent right now.</p>
                </div>
              ) : (
                <div>
                  {attentionGroups.map(group => (
                    <div key={group.type}>
                      <div className="px-5 py-2 bg-muted/10">
                        <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">{group.title}</p>
                      </div>
                      <div className="divide-y divide-border">
                        {group.items.map((item, i) => (
                          <button
                            key={`${group.type}-${i}`}
                            onClick={() => navigate(`/admin/events/${item.event_id}?tab=${item.tab}`)}
                            className={`w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors group ${item.critical ? "border-l-2 border-l-[#C9A84C]" : ""}`}
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
                    </div>
                  ))}
                </div>
              )}

              {/* All Messages link */}
              <div className="border-t border-border">
                <button onClick={() => navigate("/admin/messages")} className="w-full text-left px-5 py-3 hover:bg-muted/40 transition-colors flex items-center gap-2">
                  <MessageCircle size={13} className="text-sage" />
                  <span className="font-body text-xs text-sage font-medium">View all message threads →</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Season View (full width below main layout) ─── */}
        {!loading && events.length > 0 && (
          <div className="mt-12 pb-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-7 h-7 rounded-full bg-sage/10 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-sage" />
              </div>
              <div>
                <p className="font-display text-lg font-light text-foreground">Full Season</p>
                <p className="font-body text-xs text-muted-foreground">All events at a glance</p>
              </div>
            </div>
            <div className="rounded-xl bg-card border border-border/60 overflow-hidden shadow-soft">
              {Object.entries(eventsByMonth).map(([month, monthEvents]) => (
                <div key={month}>
                  <div className="px-5 py-2.5 bg-muted/20 border-b border-border/40">
                    <p className="font-display text-sm font-medium text-foreground tracking-wide">{month}</p>
                  </div>
                  {monthEvents.map((e, idx) => {
                    const d = daysFromNow(e.arrival_date || e.wedding_date);
                    const st = autoStatus(e.milestones.completed);
                    const isLast = idx === monthEvents.length - 1;
                    return (
                      <button
                        key={e.id}
                        onClick={() => navigate(`/admin/events/${e.id}`)}
                        className={`w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-muted/15 transition-colors group ${!isLast ? "border-b border-border/30" : ""}`}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="font-body text-sm font-medium text-foreground truncate block">{e.couple_names}</span>
                          <span className="font-body text-[11px] text-muted-foreground mt-0.5 block">
                            {(e.arrival_date || e.wedding_date) ? format(parseISO(e.arrival_date || e.wedding_date!), "MMMM d, yyyy") : "Date TBD"}
                          </span>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-[10px] font-medium shrink-0 ${st.color}`}>{st.label}</span>
                        {d !== null && (
                          <span className="font-body text-xs text-muted-foreground shrink-0 w-16 text-right tabular-nums">{d}d</span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 group-hover:text-foreground/60 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
