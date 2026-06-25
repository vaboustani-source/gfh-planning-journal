import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Loader2, ChevronDown, ChevronRight, Paperclip, Reply, Send, X, Tag, RefreshCw, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor, { htmlToPlainText } from "@/components/admin/RichTextEditor";

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
  vendor_category?: string | null;
  matched_vendor_id?: string | null;
  matched_vendor_name?: string | null;
}

interface VendorOpt { id: string; business_name: string | null; contact_name: string | null; category: string | null }

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
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [groupBy, setGroupBy] = useState<"vendor" | "chronological">("vendor");
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set());
  const [assignOpenFor, setAssignOpenFor] = useState<string | null>(null);
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyInReplyTo, setReplyInReplyTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [signatureHtml, setSignatureHtml] = useState<string>("");

  const reload = async () => {
    setLoading(true);
    const [{ data: ed }, { data: vd }] = await Promise.all([
      supabase.from("project_emails").select("*").eq("event_id", eventId).order("received_at", { ascending: false }),
      supabase.from("vendors").select("id, business_name, contact_name, category").eq("event_id", eventId),
    ]);
    setEmails((ed as any) ?? []);
    setVendors((vd as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [eventId]);

  // Load current user's email signature once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("email_signatures")
        .select("html")
        .eq("user_id", user.id)
        .maybeSingle();
      setSignatureHtml((data?.html as string) ?? "");
    })();
  }, []);

  // Auto-recategorize once on mount if uncategorized exist and vendors exist
  useEffect(() => {
    if (loading) return;
    const hasUncat = emails.some(e => !e.matched_vendor_id && (e.direction ?? "received") !== "sent");
    if (hasUncat && vendors.length > 0) {
      supabase.functions.invoke("gmail-recategorize", { body: { event_id: eventId, only_uncategorized: true } })
        .then(({ data }) => {
          if ((data as any)?.updated > 0) reload();
        }).catch(() => {});
    }
    // eslint-disable-next-line
  }, [loading]);

  const recategorize = async () => {
    setRecategorizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("gmail-recategorize", { body: { event_id: eventId, only_uncategorized: false } });
      if (error) throw error;
      toast.success(`Recategorized ${(data as any)?.updated ?? 0} email${(data as any)?.updated === 1 ? "" : "s"}.`);
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setRecategorizing(false);
    }
  };

  const threads = useMemo(() => {
    const byThread = emails.reduce<Record<string, Email[]>>((acc, e) => {
      (acc[e.gmail_thread_id] ||= []).push(e);
      return acc;
    }, {});
    return Object.values(byThread).map(msgs => {
      const sorted = [...msgs].sort((a, b) => (new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()));
      const newest = sorted[sorted.length - 1];
      // Thread takes the most recent received message's category
      const lastReceived = [...sorted].reverse().find(m => (m.direction ?? "received") === "received") || newest;
      return {
        id: newest.gmail_thread_id,
        subject: newest.subject || "(no subject)",
        messages: sorted,
        newest_at: newest.received_at,
        vendor_category: lastReceived.vendor_category || null,
        matched_vendor_id: lastReceived.matched_vendor_id || null,
        matched_vendor_name: lastReceived.matched_vendor_name || null,
      };
    }).sort((a, b) => new Date(b.newest_at || 0).getTime() - new Date(a.newest_at || 0).getTime());
  }, [emails]);

  const groups = useMemo(() => {
    if (groupBy !== "vendor") return null;
    const map = new Map<string, typeof threads>();
    for (const t of threads) {
      const key = t.vendor_category || "__uncat__";
      if (!map.has(key)) map.set(key, [] as any);
      (map.get(key) as any).push(t);
    }
    const entries = Array.from(map.entries());
    // Sort: categorized alpha, uncategorized last
    entries.sort((a, b) => {
      if (a[0] === "__uncat__") return 1;
      if (b[0] === "__uncat__") return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [threads, groupBy]);

  const toggleThread = (id: string) => {
    setOpenThreads(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleMessage = (id: string) => {
    setOpenMessages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const openReply = (thread: { id: string; subject: string; messages: Email[] }) => {
    const lastReceived = [...thread.messages].reverse().find(m => (m.direction ?? "received") === "received") || thread.messages[thread.messages.length - 1];
    setReplyFor(thread.id);
    setReplyTo(extractAddress(lastReceived?.from_address || ""));
    const subj = (thread.subject || "").replace(/^\s*(re:\s*)+/i, "Re: ").trim();
    setReplySubject(/^re:/i.test(subj) ? subj : `Re: ${subj}`);
    setReplyBody(signatureHtml ? `<p></p><p></p>${signatureHtml}` : "");
    setReplyInReplyTo(lastReceived?.gmail_message_id ?? null);
  };

  const sendReply = async () => {
    const plain = htmlToPlainText(replyBody);
    if (!replyFor || !replyTo.trim() || !plain.trim()) {
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
          body_text: plain,
          body_html: replyBody,
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

  const assignVendor = async (threadId: string, vendorId: string | null) => {
    setAssignOpenFor(null);
    try {
      const { error } = await supabase.functions.invoke("gmail-assign-vendor", {
        body: { event_id: eventId, gmail_thread_id: threadId, vendor_id: vendorId },
      });
      if (error) throw error;
      toast.success(vendorId ? "Categorized." : "Cleared category.");
      await reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const renderThread = (t: typeof threads[number]) => {
    const open = openThreads.has(t.id);
    const participants = [...new Set(t.messages.map(m => m.from_name || m.from_address).filter(Boolean))].slice(0, 3).join(", ");
    return (
      <div key={t.id} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="w-full p-4 flex items-start gap-3">
          <button onClick={() => toggleThread(t.id)} className="mt-1 text-muted-foreground">
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={() => toggleThread(t.id)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-body text-sm font-medium text-foreground truncate">{t.subject}</p>
              {t.matched_vendor_name && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sage/10 border border-sage/25 font-body text-[10px] text-sage-dark">
                  from {t.matched_vendor_name}
                </span>
              )}
            </div>
            <p className="font-body text-xs text-muted-foreground truncate mt-0.5">
              {participants} · {t.messages.length} message{t.messages.length === 1 ? "" : "s"} · {formatDate(t.newest_at)}
            </p>
          </button>
          <div className="shrink-0 relative flex items-center gap-2">
            {!t.matched_vendor_id && (
              <div className="relative">
                <button
                  onClick={() => setAssignOpenFor(assignOpenFor === t.id ? null : t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-foreground"
                >
                  <Tag size={12} /> Assign to vendor <ChevronDown size={11} />
                </button>
                {assignOpenFor === t.id && (
                  <div className="absolute right-0 top-9 w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-lg z-10">
                    {vendors.length === 0 ? (
                      <p className="p-3 font-body text-xs text-muted-foreground">No vendors on this event yet.</p>
                    ) : (
                      vendors.map(v => (
                        <button
                          key={v.id}
                          onClick={() => assignVendor(t.id, v.id)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/40 font-body text-sm border-b border-border/40 last:border-0"
                        >
                          <div className="text-foreground truncate">{v.business_name || v.contact_name || "Vendor"}</div>
                          {v.category && <div className="text-[11px] text-muted-foreground truncate">{v.category}</div>}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => openReply(t)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage text-white font-body text-xs hover:bg-sage-dark"
            >
              <Reply size={12} /> Reply
            </button>
          </div>
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
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="To" className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40" />
              <input value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder="Subject" className="w-full px-3 py-2 rounded-lg border border-border bg-card font-body text-sm focus:outline-none focus:ring-2 focus:ring-sage/40" />
              <RichTextEditor value={replyBody} onChange={setReplyBody} placeholder="Write your reply..." minHeight={160} />
            </div>
            <div className="flex justify-end">
              <button onClick={sendReply} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark disabled:opacity-60">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send reply
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-3xl font-light text-foreground">Emails</h2>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Auto-sorted by vendor role. New replies in filed threads appear here automatically.
          </p>
        </div>
        {threads.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setGroupBy("vendor")}
                className={`px-3 py-1.5 rounded-md font-body text-xs transition-colors ${groupBy === "vendor" ? "bg-sage text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                Group by vendor
              </button>
              <button
                onClick={() => setGroupBy("chronological")}
                className={`px-3 py-1.5 rounded-md font-body text-xs transition-colors ${groupBy === "chronological" ? "bg-sage text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                All emails
              </button>
            </div>
            <button
              onClick={recategorize}
              disabled={recategorizing}
              title="Re-run vendor matching for all filed emails"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 font-body text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {recategorizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Recategorize
            </button>
          </div>
        )}
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
      ) : groupBy === "chronological" ? (
        <div className="space-y-3">{threads.map(renderThread)}</div>
      ) : (
        <div className="space-y-8">
          {groups!.map(([cat, list]) => (
            <section key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sage/10 border border-sage/25 text-sage-dark font-body text-xs">
                  <Tag size={11} />
                  {cat === "__uncat__" ? "Uncategorized" : cat}
                  <span className="text-sage-dark/70">· {list.length}</span>
                </span>
              </div>
              <div className="space-y-3">{list.map(renderThread)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
