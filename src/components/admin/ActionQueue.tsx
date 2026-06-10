import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageCircle, FileSignature, ClipboardList, AlertCircle, AtSign,
  Sparkles, Send, RefreshCw, ChevronRight, Loader2, UserPlus,
} from "lucide-react";
import { formatDistanceToNow, parseISO, differenceInDays, format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { MidweekBadge } from "@/components/admin/MidweekBadge";

type ItemKind = "message" | "contract" | "form" | "milestone" | "mention" | "handoff";

interface BaseItem {
  id: string;
  kind: ItemKind;
  event_id: string;
  event_name: string;
  wedding_date: string | null;
  urgency: number; // lower = more urgent
  created_at: string;
}

interface MessageItem extends BaseItem {
  kind: "message";
  recent: { who: string; body: string; created_at: string }[];
}
interface ContractItem extends BaseItem {
  kind: "contract";
  contract_id: string;
  title: string;
  days_since: number;
}
interface FormItem extends BaseItem {
  kind: "form";
  assignment_id: string;
  title: string;
  days_since: number;
}
interface MilestoneItem extends BaseItem {
  kind: "milestone";
  title: string;
  days_overdue: number;
}
interface MentionItem extends BaseItem {
  kind: "mention";
  message_id: string;
  who: string;
  snippet: string;
}
interface HandoffItem extends BaseItem {
  kind: "handoff";
  package_tier: string | null;
  handed_off_at: string;
}
type QueueItem = MessageItem | ContractItem | FormItem | MilestoneItem | MentionItem | HandoffItem;

const HARD_CAP = 10;
const STALE_DAYS = 14;

function isHiddenMilestoneTitle(t: string | null | undefined) {
  if (!t) return false;
  return /^(reminder|internal):/i.test(t.trim());
}

export default function ActionQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().slice(0, 10);
      const staleCutoff = new Date(today); staleCutoff.setDate(today.getDate() - STALE_DAYS);

      // Fetch active events + couple display names
      const { data: events } = await supabase
        .from("events")
        .select("id, title, wedding_date, partner1_name, partner2_name, status, lifecycle_stage, handed_off_at, package_tier")
        .in("status", ["onboarding", "active", "planning"]);
      const eventIds = (events ?? []).map(e => e.id);
      if (eventIds.length === 0) { setItems([]); setHiddenCount(0); return; }

      // Fetch current user role for handoff visibility
      const { data: myProfile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      const myRole = (myProfile?.role ?? "") as string;
      const canSeeHandoff = ["admin", "event_director"].includes(myRole);

      const { data: eus } = await supabase
        .from("event_users")
        .select("id, event_id, user_id, display_name, role_in_event")
        .in("event_id", eventIds);

      const eventName = (eid: string) => {
        const ev = events!.find(e => e.id === eid);
        if (!ev) return "Event";
        const couples = (eus ?? []).filter(u => u.event_id === eid && ["couple","partner_1","partner_2","partner1","partner2"].includes(u.role_in_event as string))
          .map(u => u.display_name).filter(Boolean) as string[];
        if (couples.length) return couples.join(" & ");
        if (ev.partner1_name && ev.partner2_name) return `${ev.partner1_name} & ${ev.partner2_name}`;
        return ev.title;
      };
      const eventWedding = (eid: string) => events!.find(e => e.id === eid)?.wedding_date ?? null;
      const COUPLE_ROLES = new Set(["couple", "partner_1", "partner_2", "partner1", "partner2"]);
      const coupleUserIds = new Set(
        (eus ?? []).filter(u => COUPLE_ROLES.has(u.role_in_event as string) && u.user_id).map(u => u.user_id as string)
      );
      const euById = Object.fromEntries((eus ?? []).map(u => [u.id, u]));

      // === 1. Unanswered couple messages ===
      const { data: allMsgs } = await supabase
        .from("messages")
        .select("id, event_id, sender_id, sender_event_user_id, body, created_at, mentions, read_at")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });

      const messageItems: MessageItem[] = [];
      const lastByEvent = new Map<string, any>();
      (allMsgs ?? []).forEach(m => { if (!lastByEvent.has(m.event_id!)) lastByEvent.set(m.event_id!, m); });
      for (const [eid, last] of lastByEvent) {
        if (!last.sender_id || !coupleUserIds.has(last.sender_id)) continue;
        const recent = (allMsgs ?? [])
          .filter(m => m.event_id === eid)
          .slice(0, 3)
          .reverse()
          .map(m => {
            const eu = m.sender_event_user_id ? euById[m.sender_event_user_id] : null;
            const isCouple = m.sender_id && coupleUserIds.has(m.sender_id);
            return {
              who: eu?.display_name || (isCouple ? "Couple" : "Brandon"),
              body: (m.body || "").toString().replace(/<[^>]+>/g, "").trim(),
              created_at: m.created_at!,
            };
          });
        messageItems.push({
          id: `msg-${eid}`, kind: "message", event_id: eid,
          event_name: eventName(eid), wedding_date: eventWedding(eid),
          recent, urgency: 0, created_at: last.created_at!,
        });
      }

      // === 5. @mentions for Brandon (unread) ===
      const myEus = (eus ?? []).filter(u => u.user_id === user.id).map(u => u.id);
      const mentionItems: MentionItem[] = [];
      (allMsgs ?? []).forEach(m => {
        const mentions: string[] = (m.mentions as any) || [];
        if (!mentions.length || m.read_at) return;
        if (m.sender_id === user.id) return;
        if (!myEus.some(id => mentions.includes(id))) return;
        const eu = m.sender_event_user_id ? euById[m.sender_event_user_id] : null;
        mentionItems.push({
          id: `mention-${m.id}`, kind: "mention", event_id: m.event_id!,
          event_name: eventName(m.event_id!), wedding_date: eventWedding(m.event_id!),
          message_id: m.id, who: eu?.display_name || "Someone",
          snippet: ((m.body || "").toString().replace(/<[^>]+>/g, "").trim()).slice(0, 140),
          urgency: 1, created_at: m.created_at!,
        });
      });

      // === 2. Unsigned contracts > 5 days ===
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, event_id, title, status, sent_at")
        .in("event_id", eventIds)
        .eq("status", "sent");
      const contractIds = (contracts ?? []).map(c => c.id);
      let sigByContract: Record<string, number> = {};
      if (contractIds.length) {
        const { data: sigs } = await supabase
          .from("contract_signatures").select("contract_id").in("contract_id", contractIds);
        (sigs ?? []).forEach(s => {
          sigByContract[s.contract_id!] = (sigByContract[s.contract_id!] ?? 0) + 1;
        });
      }
      const contractItems: ContractItem[] = (contracts ?? [])
        .filter(c => !sigByContract[c.id] && c.sent_at)
        .map(c => {
          const days = differenceInDays(today, parseISO(c.sent_at!));
          return { days, c };
        })
        .filter(({ days }) => days > 5 && days <= STALE_DAYS)
        .map(({ days, c }) => ({
          id: `contract-${c.id}`, kind: "contract", event_id: c.event_id!,
          event_name: eventName(c.event_id!), wedding_date: eventWedding(c.event_id!),
          contract_id: c.id, title: c.title || "Contract",
          days_since: days, urgency: 2, created_at: c.sent_at!,
        }));

      // === 3. Forms sent but not started > 7 days ===
      const { data: assignments } = await supabase
        .from("form_assignments")
        .select("id, event_id, form_id, status, created_at, submitted_at, forms(title)")
        .in("event_id", eventIds);
      const formItems: FormItem[] = (assignments ?? [])
        .filter(a => a.status !== "submitted" && !a.submitted_at && a.created_at)
        .map(a => {
          const days = differenceInDays(today, parseISO(a.created_at!));
          return { days, a };
        })
        .filter(({ days }) => days > 7 && days <= STALE_DAYS)
        .map(({ days, a }) => ({
          id: `form-${a.id}`, kind: "form", event_id: a.event_id!,
          event_name: eventName(a.event_id!), wedding_date: eventWedding(a.event_id!),
          assignment_id: a.id, title: (a as any).forms?.title || "Form",
          days_since: days, urgency: 3, created_at: a.created_at!,
        }));

      // === 4. Overdue milestones ===
      const { data: ms } = await supabase
        .from("milestones")
        .select("id, event_id, title, target_date, status")
        .in("event_id", eventIds)
        .neq("status", "complete");
      let hiddenMs = 0;
      const milestoneItems: MilestoneItem[] = [];
      (ms ?? []).forEach(m => {
        if (!m.target_date || m.target_date >= todayStr) return;
        const daysOverdue = differenceInDays(today, parseISO(m.target_date));
        if (daysOverdue > STALE_DAYS) { hiddenMs++; return; }
        if (isHiddenMilestoneTitle(m.title)) { hiddenMs++; return; }
        milestoneItems.push({
          id: `milestone-${m.id}`, kind: "milestone", event_id: m.event_id!,
          event_name: eventName(m.event_id!), wedding_date: eventWedding(m.event_id!),
          title: m.title || "Milestone", days_overdue: daysOverdue,
          urgency: 1, created_at: m.target_date,
        });
      });

      // === 6. Handoff notifications (admin / event_director) ===
      const handoffItems: HandoffItem[] = [];
      if (canSeeHandoff) {
        (events ?? []).forEach(e => {
          if (e.lifecycle_stage === "handed_off" && e.handed_off_at) {
            handoffItems.push({
              id: `handoff-${e.id}`, kind: "handoff", event_id: e.id,
              event_name: eventName(e.id), wedding_date: eventWedding(e.id),
              package_tier: (e as any).package_tier ?? null,
              handed_off_at: e.handed_off_at as string,
              urgency: 0, created_at: e.handed_off_at as string,
            });
          }
        });
      }

      // Combine + sort by group: messages, overdue, reminders
      const all: QueueItem[] = [...handoffItems, ...messageItems, ...mentionItems, ...milestoneItems, ...contractItems, ...formItems];
      all.sort((a, b) => {
        if (a.urgency !== b.urgency) return a.urgency - b.urgency;
        return b.created_at.localeCompare(a.created_at);
      });

      const shown = all.slice(0, HARD_CAP);
      const hidden = (all.length - shown.length) + hiddenMs;
      setItems(shown);
      setHiddenCount(hidden);
    } catch (err) {
      console.error("ActionQueue load error", err);
      setItems([]);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  if (items === null) {
    return (
      <div className="rounded-xl bg-card border border-sage/20 p-6 animate-fade-up">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading your queue...
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-sage/20 p-8 text-center animate-fade-up">
        <div className="w-12 h-12 rounded-full bg-sage/10 mx-auto mb-3 flex items-center justify-center">
          <Sparkles size={18} className="text-sage" />
        </div>
        <p className="font-display text-xl font-light text-foreground mb-1">You're all caught up.</p>
        <p className="font-body text-sm text-muted-foreground">Nothing needs your attention right now.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-sage/30 overflow-hidden animate-fade-up">
      <div className="px-5 py-4 border-b border-sage/20 bg-sage/5 flex items-center justify-between">
        <div>
          <p className="font-display text-xl font-light text-foreground">Needs Your Attention</p>
          <p className="font-body text-xs text-muted-foreground mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} to handle this morning</p>
        </div>
        <button onClick={() => void load()} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="divide-y divide-border">
        {items.map(item => (
          <ActionCard key={item.id} item={item} eventName={item.event_name} onSent={() => void load()} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <div className="px-5 py-3 bg-muted/20 border-t border-border text-center">
          <button onClick={() => navigate("/admin/messages")} className="font-body text-xs text-sage hover:underline">
            {hiddenCount} item{hiddenCount !== 1 ? "s" : ""} hidden · view full list
          </button>
        </div>
      )}
    </div>
  );
}

function ActionCard({ item, eventName, onSent }: { item: QueueItem; eventName: string; onSent: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [draft, setDraft] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  const generateDraft = useCallback(async (regen = false) => {
    setDrafting(true);
    if (regen) setDraft("");
    setShowDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke("draft-reply", {
        body: { event_id: item.event_id, conversation_id: item.event_id },
      });
      if (error) throw error;
      setDraft((data as any)?.draft ?? "");
    } catch (e: any) {
      toast({ title: "Couldn't draft reply", description: e?.message || "Try again.", variant: "destructive" });
      setShowDraft(false);
    } finally {
      setDrafting(false);
    }
  }, [item.event_id]);

  const sendReply = useCallback(async () => {
    if (!draft.trim() || !user || item.kind !== "message") return;
    setSending(true);
    try {
      const { data: eu } = await supabase.from("event_users").select("id").eq("event_id", item.event_id).eq("user_id", user.id).maybeSingle();
      await supabase.from("messages").insert({
        event_id: item.event_id,
        sender_id: user.id,
        sender_event_user_id: eu?.id ?? null,
        body: draft.trim(),
      });
      toast({ title: "Reply sent", description: `Sent to ${eventName}.` });
      setDraft(""); setShowDraft(false);
      onSent();
    } catch (e: any) {
      toast({ title: "Couldn't send", description: e?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }, [draft, user, item, eventName, onSent]);

  const weddingLabel = item.wedding_date ? format(parseISO(item.wedding_date), "MMM d, yyyy") : null;
  const eventLink = (tab: string) => navigate(`/admin/events/${item.event_id}?tab=${tab}`);

  return (
    <div className="px-5 py-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3">
        <KindIcon kind={item.kind} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap mb-1">
            <button
              onClick={() => navigate(`/admin/events/${item.event_id}`)}
              className="font-display text-base text-foreground hover:text-sage-dark transition-colors"
            >
              {eventName}
            </button>
            {weddingLabel && <span className="font-body text-[11px] text-muted-foreground">· {weddingLabel}</span>}
          </div>

          {item.kind === "message" && <MessageContent item={item} />}
          {item.kind === "contract" && (
            <p className="font-body text-sm text-foreground">
              Contract "<span className="font-medium">{item.title}</span>" sent {item.days_since} days ago, still unsigned.
            </p>
          )}
          {item.kind === "form" && (
            <p className="font-body text-sm text-foreground">
              Form "<span className="font-medium">{item.title}</span>" sent {item.days_since} days ago, not started.
            </p>
          )}
          {item.kind === "milestone" && (
            <p className="font-body text-sm text-foreground">
              <span className="font-medium">{item.title}</span> is {item.days_overdue} day{item.days_overdue !== 1 ? "s" : ""} overdue.
            </p>
          )}
          {item.kind === "mention" && (
            <p className="font-body text-sm text-foreground">
              <span className="font-medium">{item.who}</span> mentioned you: <span className="text-muted-foreground">"{item.snippet}"</span>
            </p>
          )}
          {item.kind === "handoff" && (
            <p className="font-body text-sm text-foreground">
              New client ready to onboard — <span className="capitalize">{item.package_tier ?? "base"}</span> package.
              Configure the wedding, then open the portal for them.
            </p>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {item.kind === "message" && !showDraft && (
              <button
                onClick={() => generateDraft(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sage text-white text-xs font-medium hover:bg-sage-dark transition-colors"
              >
                <Sparkles size={12} /> Draft a reply
              </button>
            )}
            {item.kind === "message" && (
              <button onClick={() => eventLink("messages")} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                Open conversation <ChevronRight size={12} />
              </button>
            )}
            {item.kind === "contract" && (
              <>
                <button onClick={() => eventLink("contracts")} className="px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-muted">View</button>
                <button onClick={() => toast({ title: "Reminder noted", description: "Open the contract to send a fresh nudge." })} className="px-3 py-1.5 rounded-md bg-sage text-white text-xs hover:bg-sage-dark">Send Reminder</button>
              </>
            )}
            {item.kind === "form" && (
              <button onClick={() => eventLink("forms")} className="px-3 py-1.5 rounded-md bg-sage text-white text-xs hover:bg-sage-dark">Send Reminder</button>
            )}
            {item.kind === "milestone" && (
              <button onClick={() => eventLink("milestones")} className="px-3 py-1.5 rounded-md bg-sage text-white text-xs hover:bg-sage-dark inline-flex items-center gap-1">
                Go to Milestones <ChevronRight size={12} />
              </button>
            )}
            {item.kind === "mention" && (
              <button onClick={() => eventLink("messages")} className="px-3 py-1.5 rounded-md bg-sage text-white text-xs hover:bg-sage-dark inline-flex items-center gap-1">
                Go to Conversation <ChevronRight size={12} />
              </button>
            )}
            {item.kind === "handoff" && (
              <button onClick={() => navigate(`/admin/events/${item.event_id}`)} className="px-3 py-1.5 rounded-md bg-sage text-white text-xs hover:bg-sage-dark inline-flex items-center gap-1">
                Open Wedding <ChevronRight size={12} />
              </button>
            )}
          </div>

          {/* Draft editor */}
          {item.kind === "message" && showDraft && (
            <div className="mt-3 rounded-lg border border-sage/30 bg-[#FAF8F4] p-3">
              <p className="font-body text-[11px] text-sage-dark uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={11} /> AI draft, grounded in their event details. Edit before sending.
              </p>
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder={drafting ? "Drafting..." : "Draft will appear here."}
                rows={6}
                disabled={drafting}
                className="w-full text-sm font-body bg-white border border-border rounded-md p-2.5 focus:outline-none focus:ring-2 focus:ring-sage/40 resize-y disabled:opacity-60"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  disabled={sending || !draft.trim()}
                  onClick={sendReply}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sage text-white text-xs font-medium hover:bg-sage-dark disabled:opacity-50"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Send
                </button>
                <button
                  disabled={drafting}
                  onClick={() => generateDraft(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-muted disabled:opacity-50"
                >
                  {drafting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
                </button>
                <button onClick={() => { setShowDraft(false); setDraft(""); }} className="text-xs text-muted-foreground hover:text-foreground ml-auto">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageContent({ item }: { item: MessageItem }) {
  return (
    <div className="space-y-1">
      <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">Last messages</p>
      {item.recent.map((m, i) => (
        <p key={i} className="font-body text-sm text-foreground">
          <span className="text-muted-foreground">{m.who}:</span> {m.body.slice(0, 200)}
          {m.body.length > 200 ? "…" : ""}
        </p>
      ))}
    </div>
  );
}

function KindIcon({ kind }: { kind: ItemKind }) {
  const base = "w-8 h-8 rounded-full flex items-center justify-center shrink-0";
  if (kind === "message") return <div className={`${base} bg-sage/15 text-sage-dark`}><MessageCircle size={15} /></div>;
  if (kind === "contract") return <div className={`${base} bg-amber-100 text-amber-700`}><FileSignature size={15} /></div>;
  if (kind === "form") return <div className={`${base} bg-blue-100 text-blue-700`}><ClipboardList size={15} /></div>;
  if (kind === "milestone") return <div className={`${base} bg-red-100 text-red-700`}><AlertCircle size={15} /></div>;
  if (kind === "handoff") return <div className={`${base} bg-sage/15 text-sage-dark`}><UserPlus size={15} /></div>;
  return <div className={`${base} bg-purple-100 text-purple-700`}><AtSign size={15} /></div>;
}
