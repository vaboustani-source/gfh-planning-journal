import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Heart, Minus, Plus, ChevronLeft, Check, Info } from "lucide-react";
import { toast } from "sonner";

// Nickname expansion for fuzzy guest matching
const NICKNAMES: Record<string, string[]> = {
  rob: ["robert", "bob", "bobby"], robert: ["rob", "bob", "bobby"], bob: ["robert", "rob"],
  liz: ["elizabeth", "beth", "lizzy"], elizabeth: ["liz", "beth", "lizzy", "betsy"], beth: ["elizabeth", "liz"],
  mike: ["michael", "mikey"], michael: ["mike", "mikey"],
  bill: ["william", "will", "billy"], will: ["william", "bill"], william: ["bill", "will", "billy"],
  jim: ["james", "jimmy"], james: ["jim", "jimmy"], jimmy: ["james", "jim"],
  kate: ["katherine", "katie", "kathy"], katherine: ["kate", "katie", "kathy"], katie: ["katherine", "kate"],
  chris: ["christopher", "christina", "christine"], christopher: ["chris"], christina: ["chris", "tina"],
  nick: ["nicholas"], nicholas: ["nick"],
  tom: ["thomas", "tommy"], thomas: ["tom", "tommy"],
  dan: ["daniel", "danny"], daniel: ["dan", "danny"],
  joe: ["joseph", "joey"], joseph: ["joe", "joey"],
  sam: ["samuel", "samantha"], samuel: ["sam"], samantha: ["sam"],
  alex: ["alexander", "alexandra"], alexander: ["alex"], alexandra: ["alex"],
  matt: ["matthew"], matthew: ["matt"],
  dave: ["david"], david: ["dave"],
  steve: ["steven", "stephen"], steven: ["steve"], stephen: ["steve"],
  tony: ["anthony"], anthony: ["tony"],
  ben: ["benjamin"], benjamin: ["ben"],
  jen: ["jennifer", "jenny"], jennifer: ["jen", "jenny"],
  meg: ["megan", "margaret"], megan: ["meg"], margaret: ["meg", "maggie", "peggy"],
  abby: ["abigail"], abigail: ["abby"],
};

function expandName(n: string): string[] {
  const k = n.toLowerCase().trim();
  return [k, ...(NICKNAMES[k] ?? [])];
}

function fuzzyScore(query: string, guest: { first_name: string; last_name: string }): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const full = `${guest.first_name} ${guest.last_name}`.toLowerCase();
  if (full.includes(q)) return 100;
  const parts = q.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const p of parts) {
    const variants = expandName(p);
    const first = guest.first_name.toLowerCase();
    const last = guest.last_name.toLowerCase();
    if (variants.some((v) => first.startsWith(v) || last.startsWith(v))) score += 40;
    else if (variants.some((v) => first.includes(v) || last.includes(v))) score += 20;
  }
  return score;
}

type Step =
  | "find"
  | "attending"
  | "party"
  | "lodging"
  | "meal"
  | "custom"
  | "review"
  | "done"
  | "declined";

type Guest = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  is_plus_one: boolean | null;
  lodging_preference: string | null;
  rsvp_status: string | null;
  party_size: number | null;
  meal_preference: string | null;
  dietary_restrictions: string[] | null;
  rsvp_responses: Record<string, any> | null;
  rsvp_lodging_details: Record<string, any> | null;
  rsvp_submitted_at: string | null;
};

type Config = {
  id: string;
  event_id: string;
  is_live: boolean;
  rsvp_deadline: string | null;
  public_token: string;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
  welcome_headline: string | null;
  welcome_message: string | null;
  ask_meal_preference: boolean | null;
  ask_dietary: boolean | null;
  ask_song_request: boolean | null;
  onsite_questions: any[] | null;
  offsite_questions: any[] | null;
  custom_questions: any[] | null;
  conditional_reminders: any[] | null;
  confirmation_message: string | null;
};

const DIETARY_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy", "Dairy-Free", "Shellfish Allergy", "Halal", "Kosher",
];

export default function PublicRsvp() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [eventInfo, setEventInfo] = useState<{
    event_id: string; event_title: string;
    partner1_name: string | null; partner2_name: string | null;
    wedding_date: string | null;
  } | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [mealEvents, setMealEvents] = useState<{ id: string; meal_type: string; location: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // wizard state
  const [step, setStep] = useState<Step>("find");
  const [query, setQuery] = useState("");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [unmatched, setUnmatched] = useState<{ first: string; last: string; email: string } | null>(null);
  const [attending, setAttending] = useState<"confirmed" | "declined" | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [lodgingAnswers, setLodgingAnswers] = useState<Record<string, any>>({});
  const [mealPreference, setMealPreference] = useState<string>("");
  const [dietary, setDietary] = useState<string[]>([]);
  const [dietaryOther, setDietaryOther] = useState("");
  const [songRequest, setSongRequest] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});
  const [declineNote, setDeclineNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: cfg, error: cfgErr } = await supabase
          .from("rsvp_config")
          .select("*")
          .eq("public_token", token)
          .maybeSingle();
        if (cfgErr) throw cfgErr;
        if (!alive) return;
        if (!cfg) { setError("not_found"); return; }
        if (!cfg.is_live) { setError("not_live"); return; }
        if (cfg.rsvp_deadline && new Date(cfg.rsvp_deadline) < new Date(new Date().toDateString())) {
          setError("closed"); setConfig(cfg as any); return;
        }
        setConfig(cfg as any);

        const [evt, gs, ms] = await Promise.all([
          supabase.rpc("lookup_rsvp_event", { p_token: token }),
          supabase.rpc("lookup_rsvp_guests", { p_token: token }),
          supabase.rpc("lookup_rsvp_meal_events", { p_token: token }),
        ]);
        if (!alive) return;
        if (evt.data && evt.data[0]) setEventInfo(evt.data[0] as any);
        setGuests((gs.data as any[]) ?? []);
        setMealEvents((ms.data as any[]) ?? []);
      } catch (e: any) {
        setError("error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  // Hydrate prior answers if guest already submitted
  useEffect(() => {
    if (!guest) return;
    setAttending((guest.rsvp_status as any) || null);
    setPartySize(guest.party_size || 1);
    setMealPreference(guest.meal_preference || "");
    setDietary(guest.dietary_restrictions || []);
    setLodgingAnswers((guest.rsvp_lodging_details as any) || {});
    const resp = (guest.rsvp_responses as any) || {};
    setCustomAnswers(resp.custom || {});
    setSongRequest(resp.song_request || "");
    setDietaryOther(resp.dietary_other || "");
  }, [guest]);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return guests
      .map((g) => ({ g, s: fuzzyScore(query, g) }))
      .filter((x) => x.s >= 20)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.g);
  }, [query, guests]);

  const coupleNames = useMemo(() => {
    if (!eventInfo) return "the couple";
    const parts = [eventInfo.partner1_name, eventInfo.partner2_name].filter(Boolean);
    return parts.length ? parts.join(" & ") : (eventInfo.event_title || "the couple");
  }, [eventInfo]);

  const primary = config?.color_primary || "#2C3E2D";
  const secondary = config?.color_secondary || "#C9A84C";
  const accent = config?.color_accent || "#FAF8F4";

  // conditional reminders matching current answers
  const triggeredReminders = useMemo(() => {
    if (!config?.conditional_reminders) return [];
    const allAnswers: Record<string, any> = { ...customAnswers, ...lodgingAnswers };
    return (config.conditional_reminders as any[]).filter((r) => {
      const v = allAnswers[r.trigger_question_id];
      if (v == null) return false;
      return String(v).toLowerCase() === String(r.trigger_value).toLowerCase();
    });
  }, [config, customAnswers, lodgingAnswers]);

  const lodgingQuestions: any[] = useMemo(() => {
    if (!guest || !config) return [];
    if (guest.lodging_preference === "on_site") return (config.onsite_questions as any[]) || [];
    if (guest.lodging_preference === "off_site") return (config.offsite_questions as any[]) || [];
    return [];
  }, [guest, config]);

  const customQuestions: any[] = (config?.custom_questions as any[]) || [];

  function totalSteps() {
    let n = 3; // find, attending, party
    if (lodgingQuestions.length) n++;
    if (config?.ask_meal_preference || config?.ask_dietary) n++;
    if (customQuestions.length || config?.ask_song_request) n++;
    n++; // review
    return n;
  }
  function currentStepIndex() {
    const order: Step[] = ["find", "attending", "party"];
    if (lodgingQuestions.length) order.push("lodging");
    if (config?.ask_meal_preference || config?.ask_dietary) order.push("meal");
    if (customQuestions.length || config?.ask_song_request) order.push("custom");
    order.push("review");
    return Math.max(0, order.indexOf(step));
  }

  async function handleSubmit() {
    if (!config) return;
    setSubmitting(true);
    try {
      const payload = {
        rsvp_status: attending,
        party_size: attending === "declined" ? 0 : partySize,
        meal_preference: mealPreference || null,
        dietary_restrictions: dietary,
        rsvp_responses: {
          custom: customAnswers,
          song_request: songRequest,
          dietary_other: dietaryOther,
          decline_note: declineNote,
        },
        rsvp_lodging_details: lodgingAnswers,
      };

      if (guest) {
        const { error: e } = await supabase.rpc("submit_rsvp", {
          p_token: token, p_guest_id: guest.id, p_payload: payload as any,
        });
        if (e) throw e;
      } else if (unmatched) {
        const { error: e } = await supabase.rpc("submit_rsvp_unmatched", {
          p_token: token,
          p_first_name: unmatched.first,
          p_last_name: unmatched.last,
          p_email: unmatched.email,
          p_payload: payload as any,
        });
        if (e) throw e;
      }
      setStep("done");
    } catch (e: any) {
      toast.error(e.message || "Could not submit your RSVP");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Render states ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: accent }}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error === "not_found" || error === "not_live") {
    return <MessagePage bg={accent} primary={primary} title="This RSVP isn't available yet"
      message="Please check back soon, or reach out to the couple if you think this is a mistake." />;
  }
  if (error === "closed") {
    return <MessagePage bg={accent} primary={primary} title="RSVPs have closed"
      message="The RSVP window has ended. Please contact the couple directly." />;
  }
  if (error === "error" || !config) {
    return <MessagePage bg={accent} primary={primary} title="Something went wrong"
      message="We couldn't load this RSVP. Please try again in a moment." />;
  }

  return (
    <div className="min-h-screen font-jost" style={{ background: accent, color: "#1A1A1A" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@300;400;500;600&display=swap');
        .font-cormorant { font-family: 'Cormorant Garamond', serif; }
        .font-jost { font-family: 'Jost', ui-sans-serif, system-ui, sans-serif; }`}</style>

      {/* Header */}
      <header className="px-5 pt-10 pb-6 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase mb-4"
          style={{ color: secondary }}>
          <span>You're invited</span>
        </div>
        <h1 className="font-cormorant text-4xl sm:text-5xl leading-tight" style={{ color: primary }}>
          {config.welcome_headline || `${coupleNames}`}
        </h1>
        {config.welcome_message && (
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-700 max-w-md mx-auto">
            {config.welcome_message}
          </p>
        )}
        {/* Progress */}
        {step !== "done" && step !== "declined" && (
          <div className="mt-7 flex items-center justify-center gap-1.5">
            {Array.from({ length: totalSteps() }).map((_, i) => (
              <span key={i} className="h-1 w-6 rounded-full transition-all"
                style={{ background: i <= currentStepIndex() ? primary : "rgba(0,0,0,0.08)" }} />
            ))}
          </div>
        )}
      </header>

      <main className="px-5 pb-24 max-w-xl mx-auto">
        <Card className="rounded-2xl border-0 shadow-sm bg-white p-6 sm:p-8 animate-in fade-in duration-300" key={step}>
          {step === "find" && (
            <StepFind
              query={query} setQuery={setQuery} matches={matches}
              onPick={(g) => { setGuest(g); setUnmatched(null); setStep("attending"); }}
              onUnmatched={(first, last, email) => { setUnmatched({ first, last, email }); setGuest(null); setStep("attending"); }}
              primary={primary} secondary={secondary}
            />
          )}

          {step === "attending" && (
            <StepAttending
              coupleNames={coupleNames} primary={primary}
              alreadySubmitted={!!guest?.rsvp_submitted_at}
              onAccept={() => { setAttending("confirmed"); setStep("party"); }}
              onDecline={() => { setAttending("declined"); setStep("declined"); }}
              onBack={() => setStep("find")}
            />
          )}

          {step === "declined" && (
            <StepDeclined
              primary={primary} note={declineNote} setNote={setDeclineNote}
              submitting={submitting} onSubmit={handleSubmit} onBack={() => setStep("attending")}
            />
          )}

          {step === "party" && (
            <StepParty
              partySize={partySize} setPartySize={setPartySize}
              maxAllowed={guest?.is_plus_one ? 2 : 4}
              primary={primary}
              onBack={() => setStep("attending")}
              onNext={() => setStep(lodgingQuestions.length ? "lodging"
                : (config.ask_meal_preference || config.ask_dietary) ? "meal"
                : (customQuestions.length || config.ask_song_request) ? "custom" : "review")}
            />
          )}

          {step === "lodging" && (
            <StepQuestions
              title={guest?.lodging_preference === "on_site" ? "Your stay on the estate" : "Travel & lodging"}
              subtitle={guest?.lodging_preference === "on_site"
                ? "A few details so we can prepare your accommodations."
                : "Help us coordinate your weekend logistics."}
              questions={lodgingQuestions}
              answers={lodgingAnswers}
              setAnswers={setLodgingAnswers}
              reminders={triggeredReminders}
              primary={primary} secondary={secondary}
              onBack={() => setStep("party")}
              onNext={() => setStep((config.ask_meal_preference || config.ask_dietary) ? "meal"
                : (customQuestions.length || config.ask_song_request) ? "custom" : "review")}
            />
          )}

          {step === "meal" && (
            <StepMeal
              config={config} mealEvents={mealEvents}
              mealPreference={mealPreference} setMealPreference={setMealPreference}
              dietary={dietary} setDietary={setDietary}
              dietaryOther={dietaryOther} setDietaryOther={setDietaryOther}
              primary={primary} secondary={secondary}
              onBack={() => setStep(lodgingQuestions.length ? "lodging" : "party")}
              onNext={() => setStep((customQuestions.length || config.ask_song_request) ? "custom" : "review")}
            />
          )}

          {step === "custom" && (
            <StepQuestions
              title="A few more things"
              subtitle="Just to make the day feel like yours."
              questions={[
                ...customQuestions,
                ...(config.ask_song_request ? [{
                  id: "__song", type: "short_text",
                  label: "Any song that'll get you on the dance floor?", required: false,
                }] : []),
              ]}
              answers={{ ...customAnswers, ...(config.ask_song_request ? { __song: songRequest } : {}) }}
              setAnswers={(updater) => {
                const next = typeof updater === "function" ? updater({ ...customAnswers, __song: songRequest }) : updater;
                const { __song, ...rest } = next as any;
                setCustomAnswers(rest);
                if (config.ask_song_request) setSongRequest(__song ?? "");
              }}
              reminders={triggeredReminders}
              primary={primary} secondary={secondary}
              onBack={() => setStep((config.ask_meal_preference || config.ask_dietary) ? "meal"
                : lodgingQuestions.length ? "lodging" : "party")}
              onNext={() => setStep("review")}
            />
          )}

          {step === "review" && (
            <StepReview
              primary={primary} secondary={secondary}
              guest={guest} unmatched={unmatched}
              attending={attending} partySize={partySize}
              lodgingAnswers={lodgingAnswers} lodgingQuestions={lodgingQuestions}
              mealPreference={mealPreference} dietary={dietary} dietaryOther={dietaryOther}
              songRequest={songRequest} customAnswers={customAnswers} customQuestions={customQuestions}
              submitting={submitting}
              onBack={() => setStep((customQuestions.length || config.ask_song_request) ? "custom"
                : (config.ask_meal_preference || config.ask_dietary) ? "meal"
                : lodgingQuestions.length ? "lodging" : "party")}
              onSubmit={handleSubmit}
            />
          )}

          {step === "done" && (
            <StepDone
              primary={primary} secondary={secondary}
              message={config.confirmation_message}
              deadline={config.rsvp_deadline}
              canEdit
            />
          )}
        </Card>
      </main>

      <footer className="pb-10 text-center">
        <div className="font-cormorant italic text-sm" style={{ color: primary, opacity: 0.6 }}>
          Gilbertsville Farmhouse
        </div>
      </footer>
    </div>
  );
}

// ----------------- Sub-components -----------------

function MessagePage({ bg, primary, title, message }: { bg: string; primary: string; title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 font-jost" style={{ background: bg }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500&display=swap');
        .font-cormorant { font-family: 'Cormorant Garamond', serif; }
        .font-jost { font-family: 'Jost', ui-sans-serif, system-ui, sans-serif; }`}</style>
      <div className="max-w-md text-center">
        <Heart className="w-7 h-7 mx-auto mb-5" style={{ color: primary }} />
        <h1 className="font-cormorant text-3xl sm:text-4xl mb-3" style={{ color: primary }}>{title}</h1>
        <p className="text-neutral-700 leading-relaxed">{message}</p>
        <div className="mt-10 font-cormorant italic text-sm" style={{ color: primary, opacity: 0.6 }}>
          Gilbertsville Farmhouse
        </div>
      </div>
    </div>
  );
}

function StepFind({ query, setQuery, matches, onPick, onUnmatched, primary, secondary }: any) {
  const [showManual, setShowManual] = useState(false);
  const [first, setFirst] = useState(""); const [last, setLast] = useState(""); const [email, setEmail] = useState("");
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>Let's find your invitation</h2>
        <p className="text-sm text-neutral-600 mt-1">Start typing your name.</p>
      </div>
      <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Your name" className="h-12 text-base" />
      {query.trim() && (
        <div className="space-y-2">
          {matches.length === 0 && !showManual && (
            <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(0,0,0,0.03)" }}>
              We couldn't find your name. Try a different spelling, or{" "}
              <button onClick={() => setShowManual(true)} className="underline" style={{ color: primary }}>
                enter it manually
              </button>.
            </div>
          )}
          {matches.map((g: Guest) => (
            <button key={g.id} onClick={() => onPick(g)}
              className="w-full text-left rounded-xl border bg-white p-4 hover:shadow-sm transition flex items-center justify-between"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <div>
                <div className="font-medium">{g.first_name} {g.last_name}</div>
                {g.email && <div className="text-xs text-neutral-500">{g.email}</div>}
              </div>
              <Check className="w-4 h-4" style={{ color: secondary }} />
            </button>
          ))}
        </div>
      )}
      {showManual && (
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <p className="text-xs text-neutral-600">We'll let the couple know to add you.</p>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <Input placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <Input placeholder="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button className="w-full h-11" style={{ background: primary, color: "white" }}
            disabled={!first.trim()}
            onClick={() => onUnmatched(first, last, email)}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

function StepAttending({ coupleNames, primary, onAccept, onDecline, onBack, alreadySubmitted }: any) {
  return (
    <div className="space-y-6">
      <BackBtn onClick={onBack} />
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>
          Will you be joining {coupleNames}?
        </h2>
        {alreadySubmitted && (
          <p className="text-xs text-neutral-500 mt-2">You've responded before. Updating now will replace your previous reply.</p>
        )}
      </div>
      <div className="grid gap-3">
        <Button onClick={onAccept} className="h-14 text-base rounded-xl" style={{ background: primary, color: "white" }}>
          Joyfully accept
        </Button>
        <Button onClick={onDecline} variant="outline" className="h-14 text-base rounded-xl"
          style={{ borderColor: primary, color: primary }}>
          Regretfully decline
        </Button>
      </div>
    </div>
  );
}

function StepDeclined({ primary, note, setNote, submitting, onSubmit, onBack }: any) {
  return (
    <div className="space-y-5">
      <BackBtn onClick={onBack} />
      <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>We'll miss you</h2>
      <p className="text-sm text-neutral-600">If you'd like to leave a note for the couple, you can here.</p>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
        placeholder="A short message (optional)" />
      <Button onClick={onSubmit} disabled={submitting}
        className="w-full h-12 rounded-xl" style={{ background: primary, color: "white" }}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send my reply"}
      </Button>
    </div>
  );
}

function StepParty({ partySize, setPartySize, maxAllowed, primary, onBack, onNext }: any) {
  return (
    <div className="space-y-6">
      <BackBtn onClick={onBack} />
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>How many in your party?</h2>
        <p className="text-sm text-neutral-600 mt-1">Include yourself.</p>
      </div>
      <div className="flex items-center justify-center gap-5 py-4">
        <button onClick={() => setPartySize(Math.max(1, partySize - 1))}
          className="w-11 h-11 rounded-full border flex items-center justify-center"
          style={{ borderColor: primary, color: primary }}>
          <Minus className="w-4 h-4" />
        </button>
        <div className="font-cormorant text-5xl w-16 text-center" style={{ color: primary }}>{partySize}</div>
        <button onClick={() => setPartySize(Math.min(maxAllowed, partySize + 1))}
          className="w-11 h-11 rounded-full border flex items-center justify-center"
          style={{ borderColor: primary, color: primary }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <Button onClick={onNext} className="w-full h-12 rounded-xl" style={{ background: primary, color: "white" }}>
        Continue
      </Button>
    </div>
  );
}

function StepQuestions({ title, subtitle, questions, answers, setAnswers, reminders, primary, secondary, onBack, onNext }: any) {
  const setVal = (id: string, v: any) => setAnswers((prev: any) => ({ ...prev, [id]: v }));
  return (
    <div className="space-y-5">
      <BackBtn onClick={onBack} />
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>{title}</h2>
        {subtitle && <p className="text-sm text-neutral-600 mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-5">
        {questions.map((q: any) => (
          <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => setVal(q.id, v)} primary={primary} />
        ))}
      </div>
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((r: any, i: number) => (
            <div key={i} className="flex gap-3 rounded-xl p-4 text-sm"
              style={{ background: `${secondary}1A`, color: "#1A1A1A" }}>
              <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: secondary }} />
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      )}
      <Button onClick={onNext} className="w-full h-12 rounded-xl" style={{ background: primary, color: "white" }}>
        Continue
      </Button>
    </div>
  );
}

function QuestionField({ q, value, onChange, primary }: any) {
  const label = q.label || q.question || q.id;
  const type = q.type || "short_text";
  if (type === "long_text") {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <Textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  if (type === "yes_no") {
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className="grid grid-cols-2 gap-2">
          {["Yes", "No"].map((opt) => (
            <button key={opt} onClick={() => onChange(opt)}
              className="h-11 rounded-xl border text-sm transition"
              style={{
                borderColor: value === opt ? primary : "rgba(0,0,0,0.12)",
                background: value === opt ? primary : "white",
                color: value === opt ? "white" : "#1A1A1A",
              }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (type === "multiple_choice") {
    const options: string[] = q.options || [];
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <div className="grid gap-2">
          {options.map((opt) => (
            <button key={opt} onClick={() => onChange(opt)}
              className="h-11 rounded-xl border text-sm text-left px-4 transition"
              style={{
                borderColor: value === opt ? primary : "rgba(0,0,0,0.12)",
                background: value === opt ? primary : "white",
                color: value === opt ? "white" : "#1A1A1A",
              }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (type === "dropdown") {
    const options: string[] = q.options || [];
    return (
      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-11" />
    </div>
  );
}

function StepMeal({ config, mealEvents, mealPreference, setMealPreference, dietary, setDietary, dietaryOther, setDietaryOther, primary, secondary, onBack, onNext }: any) {
  const toggle = (opt: string) =>
    setDietary(dietary.includes(opt) ? dietary.filter((d: string) => d !== opt) : [...dietary, opt]);
  return (
    <div className="space-y-6">
      <BackBtn onClick={onBack} />
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>Meal & dietary</h2>
        <p className="text-sm text-neutral-600 mt-1">So the kitchen can take great care of you.</p>
      </div>

      {config.ask_meal_preference && mealEvents.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm">Which meals will you attend?</Label>
          <Select value={mealPreference} onValueChange={setMealPreference}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {mealEvents.map((m: any) => (
                <SelectItem key={m.id} value={m.meal_type}>{prettyMeal(m.meal_type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.ask_dietary && (
        <div className="space-y-3">
          <Label className="text-sm">Any dietary needs?</Label>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_OPTIONS.map((opt) => {
              const active = dietary.includes(opt);
              return (
                <button key={opt} onClick={() => toggle(opt)}
                  className="h-11 rounded-xl border text-sm px-3 text-left transition flex items-center gap-2"
                  style={{
                    borderColor: active ? primary : "rgba(0,0,0,0.12)",
                    background: active ? `${primary}10` : "white",
                  }}>
                  <span className="w-4 h-4 rounded border flex items-center justify-center"
                    style={{ borderColor: primary, background: active ? primary : "transparent" }}>
                    {active && <Check className="w-3 h-3 text-white" />}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
          <Textarea rows={2} value={dietaryOther} onChange={(e) => setDietaryOther(e.target.value)}
            placeholder="Anything else we should know?" />
        </div>
      )}

      <Button onClick={onNext} className="w-full h-12 rounded-xl" style={{ background: primary, color: "white" }}>
        Continue
      </Button>
    </div>
  );
}

function StepReview({ primary, secondary, guest, unmatched, attending, partySize, lodgingAnswers, lodgingQuestions, mealPreference, dietary, dietaryOther, songRequest, customAnswers, customQuestions, submitting, onBack, onSubmit }: any) {
  const name = guest ? `${guest.first_name} ${guest.last_name}` : unmatched ? `${unmatched.first} ${unmatched.last}` : "";
  const Row = ({ k, v }: any) => (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <span className="text-sm text-neutral-600">{k}</span>
      <span className="text-sm text-right">{v || "—"}</span>
    </div>
  );
  return (
    <div className="space-y-5">
      <BackBtn onClick={onBack} />
      <div>
        <h2 className="font-cormorant text-2xl sm:text-3xl" style={{ color: primary }}>Almost there</h2>
        <p className="text-sm text-neutral-600 mt-1">A quick look before you send.</p>
      </div>
      <div className="rounded-xl bg-neutral-50 p-4">
        <Row k="Name" v={name} />
        <Row k="Attending" v={attending === "confirmed" ? "Joyfully accepts" : "Regretfully declines"} />
        <Row k="Party size" v={String(partySize)} />
        {lodgingQuestions.map((q: any) => (
          <Row key={q.id} k={q.label || q.question} v={lodgingAnswers[q.id]} />
        ))}
        {mealPreference && <Row k="Meal" v={prettyMeal(mealPreference)} />}
        {dietary.length > 0 && <Row k="Dietary" v={dietary.join(", ")} />}
        {dietaryOther && <Row k="Notes" v={dietaryOther} />}
        {customQuestions.map((q: any) => (
          <Row key={q.id} k={q.label || q.question} v={customAnswers[q.id]} />
        ))}
        {songRequest && <Row k="Song request" v={songRequest} />}
      </div>
      <Button onClick={onSubmit} disabled={submitting}
        className="w-full h-12 rounded-xl" style={{ background: primary, color: "white" }}>
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit RSVP"}
      </Button>
    </div>
  );
}

function StepDone({ primary, secondary, message, deadline, canEdit }: any) {
  return (
    <div className="text-center py-6 space-y-4">
      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
        style={{ background: `${secondary}25` }}>
        <Check className="w-7 h-7" style={{ color: secondary }} />
      </div>
      <h2 className="font-cormorant text-3xl" style={{ color: primary }}>Thank you</h2>
      <p className="text-neutral-700 leading-relaxed max-w-sm mx-auto">
        {message || "Your reply has been received. We can't wait to celebrate with you."}
      </p>
      {canEdit && deadline && (
        <p className="text-xs text-neutral-500 pt-2">
          Need to change something? Use this same link before {new Date(deadline).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.
        </p>
      )}
    </div>
  );
}

function BackBtn({ onClick }: any) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800">
      <ChevronLeft className="w-3.5 h-3.5" /> Back
    </button>
  );
}

function prettyMeal(t: string) {
  return t.split("_").map((p) => p[0]?.toUpperCase() + p.slice(1)).join(" ");
}
