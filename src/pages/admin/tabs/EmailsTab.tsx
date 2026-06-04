import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, ChevronDown, ChevronRight, Paperclip } from "lucide-react";

interface Email {
  id: string;
  gmail_thread_id: string;
  gmail_message_id: string;
  from_address: string | null;
  from_name: string | null;
  to_addresses: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  has_attachments: boolean;
  attachments: any;
  received_at: string | null;
}

function sanitizeHtml(html: string): string {
  // Strip scripts/iframes/style/on* handlers — best-effort. Renders inside a sandboxed container.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on[a-z]+="[^"]*"/gi, "")
    .replace(/ on[a-z]+='[^']*'/gi, "");
}

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EmailsTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("project_emails")
        .select("*")
        .eq("event_id", eventId)
        .order("received_at", { ascending: false });
      setEmails((data as any) ?? []);
      setLoading(false);
    })();
  }, [eventId]);

  // Group by thread
  const threads = Object.values(
    emails.reduce<Record<string, Email[]>>((acc, e) => {
      (acc[e.gmail_thread_id] ||= []).push(e);
      return acc;
    }, {})
  ).map(msgs => {
    // sort newest-first inside thread for display, but newest message defines thread order
    const sorted = [...msgs].sort((a, b) => (new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()));
    const newest = sorted[sorted.length - 1];
    return { id: newest.gmail_thread_id, subject: newest.subject || "(no subject)", messages: sorted, newest_at: newest.received_at };
  }).sort((a, b) => new Date(b.newest_at || 0).getTime() - new Date(a.newest_at || 0).getTime());

  const toggleThread = (id: string) => {
    setOpenThreads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleMessage = (id: string) => {
    setOpenMessages(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-3xl font-light text-foreground">Emails</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Emails filed here from Brandon's inbox. New replies in filed threads appear automatically.
        </p>
      </div>

      {loading ? (
        <div className="py-16 flex items-center justify-center text-muted-foreground">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Mail size={24} className="text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-body text-sm text-muted-foreground">No emails filed yet. Use the admin Inbox to file vendor or team emails to this event.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map(t => {
            const open = openThreads.has(t.id);
            const participants = [...new Set(t.messages.map(m => m.from_name || m.from_address).filter(Boolean))].slice(0, 3).join(", ");
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button onClick={() => toggleThread(t.id)} className="w-full p-4 flex items-start gap-3 hover:bg-muted/20 text-left">
                  <div className="mt-1 text-muted-foreground">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground truncate">{t.subject}</p>
                    <p className="font-body text-xs text-muted-foreground truncate mt-0.5">
                      {participants} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"} · {formatDate(t.newest_at)}
                    </p>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border divide-y divide-border">
                    {t.messages.map((m, idx) => {
                      const isLast = idx === t.messages.length - 1;
                      const isOpen = openMessages.has(m.id) || isLast;
                      return (
                        <div key={m.id} className="p-4">
                          <button onClick={() => toggleMessage(m.id)} className="w-full flex items-start gap-3 text-left">
                            <div className="w-8 h-8 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center shrink-0">
                              <span className="font-body text-xs text-sage">{((m.from_name || m.from_address || "?")[0] || "?").toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-body text-sm text-foreground font-medium">{m.from_name || m.from_address}</span>
                                {m.from_name && m.from_address && (
                                  <span className="font-body text-xs text-muted-foreground">&lt;{m.from_address}&gt;</span>
                                )}
                                {m.has_attachments && <Paperclip size={11} className="text-muted-foreground" />}
                                <span className="ml-auto font-body text-[11px] text-muted-foreground">{formatDate(m.received_at)}</span>
                              </div>
                              {!isOpen && <p className="font-body text-xs text-muted-foreground truncate mt-1">{m.snippet}</p>}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="mt-3 ml-11">
                              {m.body_html ? (
                                <div
                                  className="font-body text-sm text-foreground prose prose-sm max-w-none [&_a]:text-sage [&_a]:underline-offset-2"
                                  // eslint-disable-next-line react/no-danger
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.body_html) }}
                                />
                              ) : (
                                <pre className="font-body text-sm text-foreground whitespace-pre-wrap break-words">{m.body_text || m.snippet}</pre>
                              )}
                              {Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {m.attachments.map((a: any, i: number) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 border border-border px-2.5 py-1 font-body text-[11px] text-muted-foreground">
                                      <Paperclip size={10} /> {a.filename}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
