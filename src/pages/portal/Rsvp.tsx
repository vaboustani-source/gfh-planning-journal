import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { toast } from "sonner";
import {
  Copy, Plus, Trash2, GripVertical, AlertTriangle, ExternalLink,
  Eye, Lock, Calendar as CalendarIcon, MessageSquare, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const db = supabase as any;

type QType = "short_text" | "long_text" | "yes_no" | "multiple_choice" | "dropdown";
interface Question { id: string; label: string; type: QType; options: string[]; required: boolean; }
interface Reminder { id: string; trigger_question_id: string; trigger_value: string; message: string; }

interface RsvpConfig {
  id?: string;
  event_id: string;
  is_live: boolean;
  rsvp_deadline: string | null;
  public_token: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  welcome_headline: string;
  welcome_message: string | null;
  ask_meal_preference: boolean;
  ask_dietary: boolean;
  ask_song_request: boolean;
  onsite_questions: Question[];
  offsite_questions: Question[];
  custom_questions: Question[];
  conditional_reminders: Reminder[];
  confirmation_message: string;
}

const DEFAULT_ONSITE: Question[] = [
  { id: crypto.randomUUID(), label: "Which nights will you be staying?", type: "multiple_choice", options: ["Thursday", "Friday", "Saturday"], required: true },
  { id: crypto.randomUUID(), label: "How many guests in your room?", type: "short_text", options: [], required: true },
  { id: crypto.randomUUID(), label: "Estimated arrival time?", type: "short_text", options: [], required: false },
  { id: crypto.randomUUID(), label: "Any accommodation needs?", type: "long_text", options: [], required: false },
];
const DEFAULT_OFFSITE: Question[] = [
  { id: crypto.randomUUID(), label: "Will you be using one of our hotel blocks?", type: "dropdown", options: ["Hotel Block 1", "Hotel Block 2", "Hotel Block 3", "Hotel Block 4", "Booking elsewhere"], required: true },
  { id: crypto.randomUUID(), label: "Will you need shuttle service?", type: "yes_no", options: [], required: true },
];
const DEFAULT_REMINDER_ID = crypto.randomUUID();

function defaultConfig(eventId: string): RsvpConfig {
  return {
    event_id: eventId,
    is_live: false,
    rsvp_deadline: null,
    public_token: null,
    color_primary: "#2C3E2D",
    color_secondary: "#C9A84C",
    color_accent: "#FAF8F4",
    welcome_headline: "We can't wait to celebrate with you",
    welcome_message: "",
    ask_meal_preference: true,
    ask_dietary: true,
    ask_song_request: false,
    onsite_questions: DEFAULT_ONSITE,
    offsite_questions: DEFAULT_OFFSITE,
    custom_questions: [],
    conditional_reminders: [],
    confirmation_message: "Thank you for your RSVP. We look forward to celebrating with you.",
  };
}

const QTYPE_LABEL: Record<QType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  yes_no: "Yes / No",
  multiple_choice: "Multiple choice",
  dropdown: "Dropdown",
};

export default function Rsvp(props: { eventId?: string } = {}) {
  if (props.eventId) return <RsvpInner eventId={props.eventId} portalLoading={false} />;
  return <RsvpFromPortal />;
}

function RsvpFromPortal() {
  const { eventId, loading } = usePortalData();
  return <RsvpInner eventId={eventId} portalLoading={loading} />;
}

function RsvpInner({ eventId, portalLoading }: { eventId: string | null; portalLoading: boolean }) {
  const [cfg, setCfg] = useState<RsvpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { counts: guestCounts } = useEventGuestCounts(eventId);
  const saveTimer = useRef<number | null>(null);
  const isFirstLoad = useRef(true);

  // Load or create config
  useEffect(() => {
    if (!eventId) return;
    (async () => {
      setLoading(true);
      const { data } = await db.from("rsvp_config").select("*").eq("event_id", eventId).maybeSingle();
      if (data) {
        setCfg({
          ...defaultConfig(eventId),
          ...data,
          onsite_questions: Array.isArray(data.onsite_questions) ? data.onsite_questions : DEFAULT_ONSITE,
          offsite_questions: Array.isArray(data.offsite_questions) ? data.offsite_questions : DEFAULT_OFFSITE,
          custom_questions: Array.isArray(data.custom_questions) ? data.custom_questions : [],
          conditional_reminders: Array.isArray(data.conditional_reminders) ? data.conditional_reminders : [],
        });
      } else {
        const fresh = defaultConfig(eventId);
        fresh.conditional_reminders = [{
          id: DEFAULT_REMINDER_ID,
          trigger_question_id: DEFAULT_OFFSITE[1].id,
          trigger_value: "Yes",
          message: "Wonderful! Shuttle service departs from your hotel at 3:30 PM on the wedding day. We'll send exact details closer to the date.",
        }];
        const { data: inserted, error } = await db.from("rsvp_config").insert(fresh).select().single();
        if (error) toast.error("Could not create RSVP config");
        else setCfg({ ...fresh, ...inserted });
      }
      setLoading(false);
      isFirstLoad.current = true;
    })();
  }, [eventId]);

  // Guest stats now come from useEventGuestCounts (single source of truth)

  // Debounced autosave (800ms)
  useEffect(() => {
    if (!cfg || !cfg.id) return;
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      const { id, public_token, ...patch } = cfg;
      const { error } = await db.from("rsvp_config").update(patch).eq("id", id);
      setSaving(false);
      if (error) toast.error("Save failed");
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [cfg]);

  const update = useCallback((patch: Partial<RsvpConfig>) => {
    setCfg(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  const updateQuestionList = (key: "onsite_questions" | "offsite_questions" | "custom_questions", list: Question[]) => update({ [key]: list } as any);

  const addQuestion = (key: "onsite_questions" | "offsite_questions" | "custom_questions") => {
    if (!cfg) return;
    const q: Question = { id: crypto.randomUUID(), label: "New question", type: "short_text", options: [], required: false };
    updateQuestionList(key, [...cfg[key], q]);
  };
  const editQuestion = (key: "onsite_questions" | "offsite_questions" | "custom_questions", id: string, patch: Partial<Question>) => {
    if (!cfg) return;
    updateQuestionList(key, cfg[key].map(q => q.id === id ? { ...q, ...patch } : q));
  };
  const removeQuestion = (key: "onsite_questions" | "offsite_questions" | "custom_questions", id: string) => {
    if (!cfg) return;
    updateQuestionList(key, cfg[key].filter(q => q.id !== id));
  };
  const reorder = (key: "onsite_questions" | "offsite_questions" | "custom_questions", from: number, to: number) => {
    if (!cfg) return;
    const list = [...cfg[key]];
    const [m] = list.splice(from, 1);
    list.splice(to, 0, m);
    updateQuestionList(key, list);
  };

  const publicUrl = useMemo(() => {
    if (!cfg?.public_token) return "";
    return `${window.location.origin}/rsvp/${cfg.public_token}`;
  }, [cfg?.public_token]);

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copied");
  };

  if (portalLoading || loading || !cfg) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-sage/30 border-t-sage animate-spin" />
      </div>
    );
  }

  const allTriggerQuestions: Question[] = [...cfg.onsite_questions, ...cfg.offsite_questions, ...cfg.custom_questions];

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8 space-y-10">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-light text-foreground">RSVP Builder</h1>
          <p className="font-body text-sm text-muted-foreground mt-2 max-w-2xl">
            Design the RSVP page your guests will see. This is your control panel — when you go live, the public link below
            becomes active and starts collecting responses.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-body">
          {saving ? <span className="text-sage">Saving…</span> : <span>Saved</span>}
        </div>
      </header>

      {/* Section 1 — Branding */}
      <Section title="Page Branding" subtitle="Choose colors and welcome text. The preview updates as you go.">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ColorRow label="Primary (headers & buttons)" value={cfg.color_primary} onChange={v => update({ color_primary: v })} />
            <ColorRow label="Secondary (accents)" value={cfg.color_secondary} onChange={v => update({ color_secondary: v })} />
            <ColorRow label="Background tint" value={cfg.color_accent} onChange={v => update({ color_accent: v })} />
            <div className="space-y-2 pt-2">
              <Label>Welcome headline</Label>
              <Input value={cfg.welcome_headline} onChange={e => update({ welcome_headline: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Welcome message</Label>
              <Textarea rows={3} value={cfg.welcome_message ?? ""} onChange={e => update({ welcome_message: e.target.value })} />
            </div>
          </div>
          <LivePreview cfg={cfg} />
        </div>
      </Section>

      {/* Section 2 — Standard Questions */}
      <Section title="Standard Questions" subtitle="Required basics plus optional toggles.">
        <div className="space-y-3">
          <LockedRow label="Guest name" />
          <LockedRow label="Attending (Yes / No)" />
          <LockedRow label="Number in party" />
          <ToggleRow label="Meal preference" checked={cfg.ask_meal_preference} onChange={v => update({ ask_meal_preference: v })} />
          <ToggleRow label="Dietary restrictions" checked={cfg.ask_dietary} onChange={v => update({ ask_dietary: v })} />
          <ToggleRow label="Song request" checked={cfg.ask_song_request} onChange={v => update({ ask_song_request: v })} />
        </div>
        <HelperNote>
          Name, attendance, and party size are always asked. Lodging questions are shown automatically to the right guests based on where you've placed them.
        </HelperNote>
      </Section>

      {/* Section 3 — On-Site */}
      <QuestionSection
        title="Questions for guests staying on the property"
        helper="Only guests you've marked as staying on-site will see these."
        questions={cfg.onsite_questions}
        onAdd={() => addQuestion("onsite_questions")}
        onEdit={(id, p) => editQuestion("onsite_questions", id, p)}
        onRemove={id => removeQuestion("onsite_questions", id)}
        onReorder={(f, t) => reorder("onsite_questions", f, t)}
        addLabel="+ Add On-Site Question"
      />

      {/* Section 4 — Off-Site */}
      <QuestionSection
        title="Questions for guests staying off the property"
        helper="Only guests you've marked as staying off-site will see these."
        questions={cfg.offsite_questions}
        onAdd={() => addQuestion("offsite_questions")}
        onEdit={(id, p) => editQuestion("offsite_questions", id, p)}
        onRemove={id => removeQuestion("offsite_questions", id)}
        onReorder={(f, t) => reorder("offsite_questions", f, t)}
        addLabel="+ Add Off-Site Question"
      />

      {/* Section 5 — Custom */}
      <QuestionSection
        title="Your Custom Questions"
        helper="These are shown to every guest who RSVPs."
        questions={cfg.custom_questions}
        onAdd={() => addQuestion("custom_questions")}
        onEdit={(id, p) => editQuestion("custom_questions", id, p)}
        onRemove={id => removeQuestion("custom_questions", id)}
        onReorder={(f, t) => reorder("custom_questions", f, t)}
        addLabel="+ Add Question"
      />

      {/* Section 6 — Reminders */}
      <Section title="Smart Reminders" subtitle="Show a friendly info card after a guest gives a specific answer.">
        <div className="space-y-3">
          {cfg.conditional_reminders.map((r, idx) => (
            <div key={r.id} className="bg-white border border-border rounded-lg p-4 space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">When this question</Label>
                  <Select value={r.trigger_question_id} onValueChange={v => {
                    update({ conditional_reminders: cfg.conditional_reminders.map(x => x.id === r.id ? { ...x, trigger_question_id: v } : x) });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Pick a question" /></SelectTrigger>
                    <SelectContent>
                      {allTriggerQuestions.map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.label || "(untitled)"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Is answered with</Label>
                  <Input value={r.trigger_value} onChange={e => {
                    update({ conditional_reminders: cfg.conditional_reminders.map(x => x.id === r.id ? { ...x, trigger_value: e.target.value } : x) });
                  }} placeholder="e.g. Yes" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Show this message</Label>
                <Textarea rows={2} value={r.message} onChange={e => {
                  update({ conditional_reminders: cfg.conditional_reminders.map(x => x.id === r.id ? { ...x, message: e.target.value } : x) });
                }} />
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => update({ conditional_reminders: cfg.conditional_reminders.filter(x => x.id !== r.id) })}>
                  <Trash2 size={14} className="mr-1" /> Remove
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={() => update({
            conditional_reminders: [...cfg.conditional_reminders, { id: crypto.randomUUID(), trigger_question_id: allTriggerQuestions[0]?.id ?? "", trigger_value: "", message: "" }],
          })}>
            <Plus size={14} className="mr-1" /> Add Reminder
          </Button>
        </div>
      </Section>

      {/* Section 7 — Settings */}
      <Section title="Settings" subtitle="Set your deadline, confirmation message, and go live when you're ready.">
        <div className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CalendarIcon size={14}/> RSVP deadline</Label>
              <Input type="date" value={cfg.rsvp_deadline ?? ""} onChange={e => update({ rsvp_deadline: e.target.value || null })} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><MessageSquare size={14}/> Confirmation message</Label>
              <Textarea rows={2} value={cfg.confirmation_message} onChange={e => update({ confirmation_message: e.target.value })} />
            </div>
          </div>

          <div className="bg-cream/50 border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-body text-sm font-medium text-foreground">Go Live</p>
                <p className="font-body text-xs text-muted-foreground mt-0.5">When on, your RSVP link is active and accepting responses.</p>
              </div>
              <Switch checked={cfg.is_live} onCheckedChange={v => update({ is_live: v })} />
            </div>

            <div className="border-t border-border pt-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Shareable link</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 truncate bg-white border border-border rounded px-3 py-2 font-body text-xs text-foreground">{publicUrl || "—"}</code>
                <Button variant="outline" size="sm" onClick={copyLink} disabled={!publicUrl}><Copy size={14} className="mr-1"/> Copy</Button>
                <Button variant="outline" size="sm" asChild disabled={!publicUrl}>
                  <a href={publicUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicUrl)}` : "#"} target="_blank" rel="noreferrer">QR</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Section 8 — Responses */}
      <Section title="Responses" subtitle="Live counts pulled from your guest list.">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Invited" value={guestCounts.invited} />
          <Stat label="Confirmed" value={guestCounts.confirmed} />
          <Stat label="Declined" value={guestCounts.declined} />
          <Stat label="Awaiting" value={guestCounts.awaiting} />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <a href="/portal/our-people?tab=guests" className="inline-flex items-center gap-1.5 text-sm text-sage hover:underline font-body">
            View full responses in Guest List <ExternalLink size={12}/>
          </a>
          {guestCounts.undecidedLodging > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 mt-2">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-body text-sm text-amber-900 font-medium">
                  {guestCounts.undecidedLodging} confirmed guest{guestCounts.undecidedLodging === 1 ? "" : "s"} need lodging status set
                </p>
                <a href="/portal/our-people?tab=lodging" className="text-xs text-amber-700 hover:underline font-body">
                  Set their lodging status →
                </a>
              </div>
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-foreground">{title}</h2>
        {subtitle && <p className="font-body text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="bg-cream/30 border border-border rounded-xl p-5">
        {children}
      </div>
    </section>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="flex-1">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-10 w-12 rounded cursor-pointer border border-border" />
        <Input value={value} onChange={e => onChange(e.target.value)} className="w-28 font-mono text-xs uppercase" />
      </div>
    </div>
  );
}

function LockedRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-3">
      <Lock size={14} className="text-muted-foreground" />
      <span className="font-body text-sm text-foreground flex-1">{label}</span>
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Always asked</span>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-border rounded-lg px-4 py-3">
      <span className="font-body text-sm text-foreground flex-1">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function HelperNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs text-muted-foreground font-body italic">{children}</p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 text-center">
      <p className="font-display text-3xl text-foreground">{value}</p>
      <p className="font-body text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</p>
    </div>
  );
}

function QuestionSection({
  title, helper, questions, onAdd, onEdit, onRemove, onReorder, addLabel,
}: {
  title: string;
  helper: string;
  questions: Question[];
  onAdd: () => void;
  onEdit: (id: string, p: Partial<Question>) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  addLabel: string;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  return (
    <Section title={title} subtitle={helper}>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div
            key={q.id}
            draggable
            onDragStart={() => setDragIdx(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i); setDragIdx(null); }}
            className="bg-white border border-border rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <button className="text-muted-foreground cursor-grab mt-2"><GripVertical size={14}/></button>
              <Input value={q.label} onChange={e => onEdit(q.id, { label: e.target.value })} placeholder="Question text" className="flex-1" />
              <Select value={q.type} onValueChange={v => onEdit(q.id, { type: v as QType })}>
                <SelectTrigger className="w-40"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(Object.keys(QTYPE_LABEL) as QType[]).map(t => (
                    <SelectItem key={t} value={t}>{QTYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => onRemove(q.id)}><Trash2 size={14}/></Button>
            </div>
            {(q.type === "multiple_choice" || q.type === "dropdown") && (
              <div className="pl-6 space-y-1.5">
                <Label className="text-xs">Options (one per line)</Label>
                <Textarea
                  rows={3}
                  value={q.options.join("\n")}
                  onChange={e => onEdit(q.id, { options: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })}
                />
              </div>
            )}
            <div className="flex items-center gap-2 pl-6">
              <Switch checked={q.required} onCheckedChange={v => onEdit(q.id, { required: v })} />
              <span className="text-xs text-muted-foreground font-body">Required</span>
            </div>
          </div>
        ))}
        <Button variant="outline" onClick={onAdd}><Plus size={14} className="mr-1"/> {addLabel.replace(/^\+\s*/, "")}</Button>
      </div>
    </Section>
  );
}

function LivePreview({ cfg }: { cfg: RsvpConfig }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ backgroundColor: cfg.color_accent }}>
      <div className="px-6 py-5" style={{ backgroundColor: cfg.color_primary }}>
        <p className="font-body text-xs uppercase tracking-widest" style={{ color: cfg.color_accent, opacity: 0.85 }}>
          <Eye size={12} className="inline mr-1" /> Live preview
        </p>
      </div>
      <div className="p-6 space-y-4">
        <h3 className="font-display text-2xl leading-tight" style={{ color: cfg.color_primary }}>{cfg.welcome_headline || "Welcome"}</h3>
        {cfg.welcome_message && <p className="font-body text-sm" style={{ color: cfg.color_primary, opacity: 0.85 }}>{cfg.welcome_message}</p>}
        <div className="h-px" style={{ backgroundColor: cfg.color_secondary, opacity: 0.5 }} />
        <div className="space-y-2">
          <div className="rounded-md px-3 py-2 text-sm font-body" style={{ backgroundColor: "rgba(255,255,255,0.6)", color: cfg.color_primary }}>Your name</div>
          <div className="rounded-md px-3 py-2 text-sm font-body" style={{ backgroundColor: "rgba(255,255,255,0.6)", color: cfg.color_primary }}>Will you attend?</div>
        </div>
        <button className="w-full rounded-md py-2.5 text-sm font-medium font-body" style={{ backgroundColor: cfg.color_primary, color: cfg.color_accent }}>
          <Sparkles size={12} className="inline mr-1.5"/> Send RSVP
        </button>
      </div>
    </div>
  );
}
