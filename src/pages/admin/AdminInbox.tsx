import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Loader2, Inbox, FileText, CheckCircle2, ChevronDown, RefreshCw, Search, Sparkles, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

interface InboxItem {
  id: string;
  thread_id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string | null;
  has_attachments?: boolean;
  filed: { event_id: string; event_title: string | null; couple_name?: string | null } | null;
}

interface EventOpt { id: string; title: string; couple: string | null }

interface Suggestion { suggested_event_id: string; suggested_couple_name: string; confidence: "high" | "medium" | "low" }

interface FullMessage { body_text: string | null; body_html: string | null; attachments: any[] }

function parseFrom(from: string): { name: string; address: string } {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), address: m[2].trim() };
  return { name: from, address: from };
}

function relative(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const day = 86400000;
  if (diff < day) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diff < 7 * day) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "")
    .replace(/ on[a-z]+='[^']*'/gi, "");
}

export default function AdminInbox() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<string | null>(null);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const [filingId, setFilingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | null>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bodies, setBodies] = useState<Record<string, FullMessage>>({});
  const [bodyLoading, setBodyLoading] = useState<string | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-sync-filed");
      if (error) throw error;
      const n = (data as any)?.new_messages ?? 0;
      toast.success(n ? `Pulled ${n} new message${n === 1 ? "" : "s"}.` : "Already up to date.");
    } catch (e: any) {
      toast.error(e.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const load = async (q: string = search) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-inbox", { body: { q } });
      if (error) {
        if (String(error.message).includes("not connected")) setConnected(null);
        else toast.error(error.message ?? "Could not load inbox");
        setItems([]);
      } else {
        setConnected(data.email_address);
        setItems(data.messages ?? []);
        // fetch suggestions for these emails
        const emails = (data.messages ?? []).filter((m: InboxItem) => !m.filed).map((m: InboxItem) => ({
          id: m.id, from: m.from, subject: m.subject, snippet: m.snippet,
        }));
        if (emails.length) {
          supabase.functions.invoke("gmail-suggest", { body: { emails } }).then(({ data: sd }) => {
            if (sd?.suggestions) setSuggestions(sd.suggestions);
          });
        } else {
          setSuggestions({});
        }
      }
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    const { data: evs } = await supabase
      .from("events")
      .select("id, title, partner1_name, partner2_name, wedding_date")
      .order("wedding_date", { ascending: true });
    const opts: EventOpt[] = (evs ?? []).map((e: any) => ({
      id: e.id, title: e.title,
      couple: [e.partner1_name, e.partner2_name].filter(Boolean).join(" & ") || null,
    }));
    setEvents(opts);
  };

  useEffect(() => { load(""); loadEvents(); }, []);

  const eventLabel = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of events) m[e.id] = e.couple || e.title;
    return m;
  }, [events]);

  const fileTo = async (msg: InboxItem, eventId: string) => {
    setFilingId(msg.id);
    setOpenMenuFor(null);
    try {
      const { error } = await supabase.functions.invoke("gmail-file-thread", {
        body: { event_id: eventId, gmail_thread_id: msg.thread_id },
      });
      if (error) throw error;
      const label = eventLabel[eventId] || "event";
      toast.success(`Filed to ${label}. Replies will follow automatically.`);
      setItems(prev => prev.map(it => it.thread_id === msg.thread_id ? { ...it, filed: { event_id: eventId, event_title: label, couple_name: label } } : it));
    } catch (e: any) {
      toast.error(e.message ?? "Could not file");
    } finally {
      setFilingId(null);
    }
  };

  const toggleExpand = async (msg: InboxItem) => {
    if (expanded === msg.id) { setExpanded(null); return; }
    setExpanded(msg.id);
    if (!bodies[msg.id]) {
      setBodyLoading(msg.id);
      try {
        // If thread is already filed, body sits in project_emails
        const { data: pe } = await supabase
          .from("project_emails")
          .select("body_text, body_html, attachments")
          .eq("gmail_message_id", msg.id)
          .maybeSingle();
        if (pe) {
          setBodies(b => ({ ...b, [msg.id]: { body_text: pe.body_text, body_html: pe.body_html, attachments: (pe.attachments as any) ?? [] } }));
        } else {
          // Fall back to snippet only for unfiled previews
          setBodies(b => ({ ...b, [msg.id]: { body_text: msg.snippet, body_html: null, attachments: [] } }));
        }
      } finally { setBodyLoading(null); }
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    load(searchInput);
  };

  const clearSearch = () => { setSearchInput(""); setSearch(""); load(""); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate("/admin")} className="flex items-center gap-2 font-body text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={15} /> Dashboard
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center">
              <Inbox size={12} className="text-sage" />
            </div>
            <span className="font-display text-xl font-light">Inbox</span>
            {connected && (<span className="font-body text-xs text-muted-foreground ml-2">· {connected}</span>)}
          </div>
          {connected && (
            <button
              onClick={() => { load(); syncNow(); }}
              disabled={syncing || loading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync now
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {connected && (
          <form onSubmit={submitSearch} className="mb-5 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search Gmail — sender, subject, keyword…"
                className="w-full pl-9 pr-9 py-2 rounded-xl border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
              />
              {search && (
                <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sage text-white font-body text-sm hover:bg-sage-dark transition-colors">
              Search
            </button>
          </form>
        )}

        {loading ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : !connected ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <Mail size={28} className="text-muted-foreground/50 mx-auto mb-3" />
            <p className="font-display text-xl font-light mb-1">Gmail isn't connected</p>
            <p className="font-body text-sm text-muted-foreground mb-5">Connect Brandon's Gmail in Settings to start filing emails.</p>
            <button onClick={() => navigate("/admin/settings/integrations")} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-body text-sm hover:opacity-90">
              Open Settings
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center font-body text-sm text-muted-foreground">
            {search ? "No matches in Gmail." : "Inbox is empty."}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {items.map((m) => {
                const from = parseFrom(m.from);
                const sug = !m.filed ? suggestions[m.id] : null;
                const isOpen = expanded === m.id;
                return (
                  <li key={m.id} className="hover:bg-muted/10 transition-colors">
                    <div className="p-4 flex items-start gap-4">
                      <div className="w-9 h-9 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
                        <span className="font-body text-xs text-sage font-medium">
                          {(from.name || from.address)[0]?.toUpperCase()}
                        </span>
                      </div>
                      <button onClick={() => toggleExpand(m)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-baseline gap-2">
                          <span className="font-body text-sm font-medium text-foreground truncate">{from.name || from.address}</span>
                          {m.has_attachments && <Paperclip size={11} className="text-muted-foreground shrink-0" />}
                          <span className="font-body text-[11px] text-muted-foreground ml-auto shrink-0">{relative(m.date)}</span>
                        </div>
                        <p className="font-body text-sm text-foreground truncate mt-0.5">{m.subject}</p>
                        <p className="font-body text-xs text-muted-foreground truncate mt-0.5">{m.snippet}</p>
                      </button>
                      <div className="shrink-0 relative flex items-center gap-2">
                        {m.filed ? (
                          <button
                            onClick={() => m.filed && navigate(`/admin/events/${m.filed.event_id}?tab=emails`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage/10 border border-sage/25 font-body text-xs text-sage-dark hover:bg-sage/15"
                          >
                            <CheckCircle2 size={12} /> Filed → {m.filed.couple_name || m.filed.event_title || "event"}
                          </button>
                        ) : sug ? (
                          <>
                            <span
                              className={
                                sug.confidence === "high"
                                  ? "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage text-white font-body text-[11px]"
                                  : sug.confidence === "medium"
                                  ? "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sage/10 border border-sage text-sage-dark font-body text-[11px]"
                                  : "inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/40 border border-border text-muted-foreground font-body text-[11px]"
                              }
                              title={`${sug.confidence} confidence`}
                            >
                              <Sparkles size={10} /> → {sug.suggested_couple_name}
                            </span>
                            <button
                              onClick={() => fileTo(m, sug.suggested_event_id)}
                              disabled={filingId === m.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sage text-white font-body text-xs hover:bg-sage-dark disabled:opacity-60"
                            >
                              {filingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} File
                            </button>
                            <button onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)} className="px-2 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-muted-foreground">
                              <ChevronDown size={11} />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setOpenMenuFor(openMenuFor === m.id ? null : m.id)}
                            disabled={filingId === m.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-foreground"
                          >
                            {filingId === m.id ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                            File to project <ChevronDown size={11} />
                          </button>
                        )}
                        {openMenuFor === m.id && (
                          <div className="absolute right-0 top-9 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-elevated z-10">
                            {events.length === 0 ? (
                              <p className="p-3 font-body text-xs text-muted-foreground">No events.</p>
                            ) : (
                              events.map(ev => (
                                <button
                                  key={ev.id}
                                  onClick={() => fileTo(m, ev.id)}
                                  className="w-full text-left px-3 py-2 hover:bg-muted/40 font-body text-sm border-b border-border/40 last:border-0"
                                >
                                  <div className="text-foreground truncate">{ev.couple || ev.title}</div>
                                  {ev.couple && <div className="text-[11px] text-muted-foreground truncate">{ev.title}</div>}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-4 pb-5 ml-[52px] mr-4">
                        {bodyLoading === m.id ? (
                          <div className="py-4 text-muted-foreground"><Loader2 size={14} className="animate-spin" /></div>
                        ) : bodies[m.id]?.body_html ? (
                          <div
                            className="font-body text-sm text-foreground prose prose-sm max-w-none [&_a]:text-sage [&_a]:underline-offset-2 rounded-lg border border-border bg-background p-4"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(bodies[m.id]!.body_html!) }}
                          />
                        ) : (
                          <pre className="font-body text-sm text-foreground whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4">
                            {bodies[m.id]?.body_text || m.snippet}
                          </pre>
                        )}
                        {!m.filed && (
                          <p className="font-body text-xs text-muted-foreground mt-2">Tip: file this thread to a wedding to keep it organized and follow new replies automatically.</p>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
