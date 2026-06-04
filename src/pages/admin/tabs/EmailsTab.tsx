import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, ChevronDown, ChevronRight, Paperclip, Reply, Send, X } from "lucide-react";
import { toast } from "sonner";

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
  direction?: "received" | "sent" | null;
}

function sanitizeHtml(html: string): string {
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

function extractAddress(header: string | null): string {
  if (!header) return "";
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim();
}

export default function EmailsTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [emails, setEmails] = useState<Email[]>([]);
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set());
  const [replyFor, setReplyFor] = useState<string | null>(null); // gmail_thread_id
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("project_emails")
      .select("*")
      .eq("event_id", eventId)
      .order("received_at", { ascending: false });
    setEmails((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [eventId]);

  const threads = Object.values(
    emails.reduce<Record<string, Email[]>>((acc, e) => {
      (acc[e.gmail_thread_id] ||= []).push(e);
      return acc;
    }, {})
  ).map(msgs => {
    const sorted = [...msgs].sort((a, b) => (new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()));
    const newest = sorted[sorted.length - 1];
    return { id: newest.gmail_thread_id, subject: newest.subject || "(no subject)", messages: sorted, newest_at: newest.received_at };
  }).sort((a, b) => new Date(b.newest_at || 0).getTime() - new Date(a.newest_at || 0).getTime());

  const toggleThread = (id: string) => {
    setOpenThreads(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleMessage = (id: string) => {
    setOpenMessages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const openReply = (thread: { id: string; subject: string; messages: Email[] }) => {
    // Find last received message in thread to address the reply
    const lastReceived = [...thread.messages].reverse().find(m => (m.direction ?? "received") === "received") || thread.messages[thread.messages.length - 1];
    setReplyFor(thread.id);
    setReplyTo(extractAddress(lastReceived?.from_address || ""));
    const subj = (thread.subject || "").replace(/^\s*(re:\s*)+/i, "Re: ").trim();
    setReplySubject(/^re:/i.test(subj) ? subj : `Re: ${subj}`);
    setReplyBody("");
    setReplyInReplyTo(lastReceived?.gmail_message_id ?? null);
  };

  const sendReply = async () => {
    if (!replyFor || !replyTo.trim() || !replyBody.trim()) {
      toast.error("Add a recipient and a message before sending.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("gmail-send-reply", {
        body: {
          event_id: eventId,
          gmail_thread_id: replyFor,
          in_reply_to_message_id: replyInReplyTo,
          to: replyTo,
          subject: replySubject,
          body_text: replyBody,
        },
      });
      if (error) throw error;
      toast.success("Reply sent.");
      setReplyFor(null);
      await reload();
      setOpenThreads(prev => new Set(prev).add(replyFor));
    } catch (e: any) {
      toast.error(e.message ?? "Could not send");
    } finally {
      setSending(false);
    }
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
                <div className="w-full p-4 flex items-start gap-3">
                  <button onClick={() => toggleThread(t.id)} className="mt-1 text-muted-foreground">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <button onClick={() => toggleThread(t.id)} className="flex-1 min-w-0 text-left">
                    <p className="font-body text-sm font-medium text-foreground truncate">{t.subject}</p>
                    <p className="font-body text-xs text-muted-foreground truncate mt-0.5">
                      {participants} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"} · {formatDate(t.newest_at)}
                    </p>
                  </button>
                  <button
                    onClick={() => openReply(t)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage text-white font-body text-xs hover:bg-sage-dark"
                  >
                    <Reply size={12} /> Reply
                  </button>
                </div>

                {open && (
                  <div className="border-t border-border divide-y divide-border">
                    {t.messages.map((m, idx) => {
                      const isLast = idx === t.messages.length - 1;
                      const isOpen = openMessages.has(m.id) || isLast;
                      const isSent = (m.direction ?? "received") === "sent";
                      return (
                        <div key={m.id} className={`p-4 ${isSent ? "bg-sage/5" : ""}`}>
                          <button onClick={() => toggleMessage(m.id)} className="w-full flex items-start gap-3 text-left">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSent ? "bg-sage text-white" : "bg-sage/10 border border-sage/20 text-sage"}`}>
                              <span className="font-body text-xs font-medium">{((m.from_name || m.from_address || "?")[0] || "?").toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                {isSent && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sage text-white font-body text-[10px] uppercase tracking-wide">Sent</span>
                                )}
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

                {replyFor === t.id && (
                  <div className="border-t border-border bg-background/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-body text-xs font-medium text-muted-foreground uppercase tracking-wide">Reply from Brandon's Gmail</p>
                      <button onClick={() => setReplyFor(null)} className="text-muted-foreground hover:text-foreground">
                        <X size={14} />
                      </button>
                    </div>
                    <div className="grid gap-2">
                      <input
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        placeholder="To"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
                      />
                      <input
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        placeholder="Subject"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
                      />
                      <textarea
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Write your reply…"
                        rows={6}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40 resize-y"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={sendReply}
                        disabled={sending}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark disabled:opacity-60"
                      >
                        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Send reply
                      </button>
                    </div>
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
