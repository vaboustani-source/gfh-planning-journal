import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, ChevronRight } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import AdminMessages from "@/pages/admin/tabs/AdminMessages";

interface ThreadSummary {
  event_id: string;
  couple_names: string;
  event_title: string;
  unread_count: number;
  latest_message: string | null;
  latest_time: string | null;
}

export default function AdminAllMessages() {
  const { profile, user } = useAuth();
  const currentUserId = user?.id ?? null;
  const navigate = useNavigate();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);

  useEffect(() => { if (currentUserId) fetchThreads(); }, [currentUserId]);

  const fetchThreads = async () => {
    try {
      const { data: events } = await supabase
        .from("events")
        .select("id, title")
        .in("status", ["onboarding", "active", "planning"]);
      if (!events || events.length === 0) { setLoading(false); return; }

      const eventIds = events.map(e => e.id);

      const [euRes, msgsRes] = await Promise.all([
        supabase.from("event_users").select("event_id, user_id").in("event_id", eventIds).eq("role_in_event", "couple"),
        supabase.from("messages").select("event_id, body, created_at, read_at, sender_id").in("event_id", eventIds).order("created_at", { ascending: false }),
      ]);

      const coupleUserIds = [...new Set((euRes.data ?? []).map(eu => eu.user_id).filter(Boolean))] as string[];
      let usersMap: Record<string, string> = {};
      if (coupleUserIds.length > 0) {
        const { data: usersData } = await supabase.from("users").select("id, first_name, last_name").in("id", coupleUserIds);
        (usersData ?? []).forEach(u => { usersMap[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim(); });
      }

      const euByEvent: Record<string, string[]> = {};
      (euRes.data ?? []).forEach(eu => {
        if (!eu.event_id || !eu.user_id) return;
        if (!euByEvent[eu.event_id]) euByEvent[eu.event_id] = [];
        euByEvent[eu.event_id].push(eu.user_id);
      });

      const summaries: ThreadSummary[] = events.map(event => {
        const coupleIds = euByEvent[event.id] ?? [];
        const coupleNames = coupleIds.map(uid => usersMap[uid]).filter(Boolean).join(" & ") || event.title;
        const eventMsgs = (msgsRes.data ?? []).filter(m => m.event_id === event.id);
        const latest = eventMsgs[0];
        const unread = eventMsgs.filter(m => !m.read_at).length;

        return {
          event_id: event.id,
          couple_names: coupleNames,
          event_title: event.title,
          unread_count: unread,
          latest_message: latest?.body?.slice(0, 80) ?? null,
          latest_time: latest?.created_at ?? null,
        };
      });

      // Sort: unread first, then by latest message time
      summaries.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (b.unread_count > 0 && a.unread_count === 0) return 1;
        return (b.latest_time ?? "").localeCompare(a.latest_time ?? "");
      });

      setThreads(summaries);
    } catch (err) {
      console.error("Error fetching threads:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnreadChange = () => {
    fetchThreads();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} /> Dashboard
          </button>
          <div className="h-6 w-px bg-border" />
          <h1 className="font-display text-xl font-light text-foreground">All Messages</h1>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Thread list */}
          <div className={`${selectedEvent ? "hidden lg:block" : ""} w-full lg:w-96 shrink-0`}>
            <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">Conversations</p>
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto" />
                </div>
              ) : threads.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle size={20} className="text-muted-foreground mx-auto mb-2" />
                  <p className="font-body text-sm text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {threads.map(thread => (
                    <button
                      key={thread.event_id}
                      onClick={() => setSelectedEvent(thread.event_id)}
                      className={`w-full text-left px-5 py-4 hover:bg-muted/40 transition-colors ${selectedEvent === thread.event_id ? "bg-sage/5 border-l-2 border-l-sage" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-body text-sm font-medium text-foreground truncate">{thread.couple_names}</p>
                            {thread.unread_count > 0 && (
                              <span className="inline-flex items-center justify-center rounded-full h-4 min-w-4 px-1 bg-primary text-primary-foreground font-body text-[9px] font-bold shrink-0">{thread.unread_count}</span>
                            )}
                          </div>
                          {thread.latest_message && (
                            <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{thread.latest_message}</p>
                          )}
                          {thread.latest_time && (
                            <p className="font-body text-[10px] text-muted-foreground/60 mt-0.5">
                              {isValid(parseISO(thread.latest_time)) ? format(parseISO(thread.latest_time), "MMM d, h:mm a") : ""}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Thread view */}
          <div className="flex-1 min-w-0">
            {selectedEvent ? (
              <div>
                <button onClick={() => setSelectedEvent(null)} className="lg:hidden flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors mb-4">
                  <ArrowLeft size={14} /> Back to threads
                </button>
                <div className="rounded-xl bg-card border border-border overflow-hidden">
                  <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                    <p className="font-body text-sm font-medium text-foreground">
                      {threads.find(t => t.event_id === selectedEvent)?.couple_names}
                    </p>
                    <button
                      onClick={() => navigate(`/admin/events/${selectedEvent}?tab=messages`)}
                      className="font-body text-[11px] text-sage hover:text-sage-dark transition-colors"
                    >
                      Open in event →
                    </button>
                  </div>
                  <div className="px-4">
                    <AdminMessages eventId={selectedEvent} onUnreadChange={handleUnreadChange} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mb-4">
                  <MessageCircle size={20} className="text-sage" />
                </div>
                <p className="font-display text-xl font-light text-foreground mb-1">Select a conversation</p>
                <p className="font-body text-sm text-muted-foreground">Choose a thread from the left to view messages.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
