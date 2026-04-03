import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Check, Loader2, Plus, Trash2, Lock, Unlock,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";
import AdminStickyFooter from "@/components/admin/AdminStickyFooter";
import InstructionBlock, { PROCESSIONAL_INSTRUCTIONS, PARENT_DANCES_INSTRUCTIONS } from "@/components/ceremony/InstructionBlock";

/* ── Types ── */
interface ProcessionalEntry { role: string; name: string; song: string }
interface DanceEntry { who: string; song: string }
interface IntroEntry { name: string; unescorted: boolean; escorted_by: string; role: string; song: string }
interface SpeechEntry { speaker: string; time: string }
interface MusicianSinger { booked: boolean; name: string }

const MIC_OPTIONS = ["Clip-on", "Stand", "Both"];
const ALTAR_OPTIONS = [
  { value: "not_chosen", label: "Have not chosen yet" },
  { value: "sit", label: "Sit" },
  { value: "stand", label: "Stand" },
];
const DJ_EVENT_OPTIONS = [
  "Rehearsal Dinner", "Welcome Party", "Ceremony",
  "Cocktail Hour", "Reception", "After Party",
];

/* ── Shared UI helpers ── */
function TextRow({ label, value, onChange, placeholder, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start">
      <p className="font-body text-sm text-muted-foreground pt-2.5">{label}</p>
      <div className="col-span-2">
        <input
          type="text" value={value}
          onChange={onChange ? e => onChange(e.target.value) : undefined}
          readOnly={readOnly} placeholder={placeholder}
          className={`w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${
            readOnly
              ? "border-border bg-muted/20 text-muted-foreground"
              : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          }`}
        />
      </div>
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
          checked ? "bg-sage border-sage" : "border-border bg-background"
        }`}
      >
        {checked && <Check size={9} className="text-white" />}
      </div>
      <span className="font-body text-sm text-foreground">{label}</span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-card border border-border p-5 space-y-4">
      <p className="font-display text-lg font-light text-foreground border-b border-border pb-2">{title}</p>
      {children}
    </div>
  );
}

/* ── Main Component ── */
export default function CeremonyTab({ eventId, onNavigateNext }: { eventId: string; onNavigateNext?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const { status, trackSave, markUnsaved } = useAutosaveStatus();

  // Existing fields
  const [officiantName, setOfficiantName] = useState("");
  const [officiantRelationship, setOfficiantRelationship] = useState("");
  const [officiantAttending, setOfficiantAttending] = useState(false);
  const [microphone, setMicrophone] = useState("Clip-on");
  const [ceremonyMusicVendor, setCeremonyMusicVendor] = useState("");
  const [djBandVendor, setDjBandVendor] = useState("");
  const [processional, setProcessional] = useState<ProcessionalEntry[]>([]);
  const [firstDance, setFirstDance] = useState("");
  const [parentDances, setParentDances] = useState<DanceEntry[]>([]);
  const [recessionalSong, setRecessionalSong] = useState("");
  const [lastDanceSong, setLastDanceSong] = useState("");
  const [cakeCuttingSong, setCakeCuttingSong] = useState("");
  const [scriptSent, setScriptSent] = useState(false);
  const [specialNotes, setSpecialNotes] = useState("");

  // New fields
  const [musicianSinger, setMusicianSinger] = useState<MusicianSinger>({ booked: false, name: "" });
  const [micSpeakers, setMicSpeakers] = useState(false);
  const [couplePhotos, setCouplePhotos] = useState(false);
  const [coupleCocktail, setCoupleCocktail] = useState(false);
  const [altarChoice, setAltarChoice] = useState("not_chosen");
  const [altarNotes, setAltarNotes] = useState("");
  const [introductions, setIntroductions] = useState<IntroEntry[]>([]);
  const [welcomeToast, setWelcomeToast] = useState("");
  const [djAfterParty, setDjAfterParty] = useState(false);
  const [djPlaylist, setDjPlaylist] = useState("");
  const [djEvents, setDjEvents] = useState<string[]>([]);
  const [speechesRehearsal, setSpeechesRehearsal] = useState<SpeechEntry[]>([]);
  const [speechesReception, setSpeechesReception] = useState<SpeechEntry[]>([]);
  const [miscNotes, setMiscNotes] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!eventId) return;
    supabase.from("ceremony_details").select("*").eq("event_id", eventId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRecordId(data.id);
          setLocked(data.locked_by_brandon ?? false);
          setOfficiantName(data.officiant_name ?? "");
          setOfficiantRelationship(data.officiant_relationship ?? "");
          setOfficiantAttending(data.officiant_attending_rehearsal ?? false);
          setMicrophone(data.microphone_type ?? "Clip-on");
          setCeremonyMusicVendor(data.ceremony_music_vendor ?? "");
          setDjBandVendor(data.dj_band_vendor ?? "");
          setProcessional((data.processional_order as unknown as ProcessionalEntry[]) ?? []);
          setFirstDance(data.first_dance_song ?? "");
          setParentDances((data.parent_dances as unknown as DanceEntry[]) ?? []);
          setRecessionalSong(data.recessional_song ?? "");
          setLastDanceSong(data.last_dance_song ?? "");
          setCakeCuttingSong(data.cake_cutting_song ?? "");
          setScriptSent(data.script_sent_to_brandon ?? false);
          setSpecialNotes(data.special_notes ?? "");
          // New
          setMusicianSinger((data as Record<string, unknown>).musician_singer as MusicianSinger ?? { booked: false, name: "" });
          setMicSpeakers((data as Record<string, unknown>).microphone_speakers as boolean ?? false);
          setCouplePhotos((data as Record<string, unknown>).couple_staying_for_photos as boolean ?? false);
          setCoupleCocktail((data as Record<string, unknown>).couple_leading_to_cocktail as boolean ?? false);
          setAltarChoice((data as Record<string, unknown>).wedding_party_altar_choice as string ?? "not_chosen");
          setAltarNotes((data as Record<string, unknown>).wedding_party_altar_notes as string ?? "");
          setIntroductions((data as Record<string, unknown>).formal_introductions as IntroEntry[] ?? []);
          setWelcomeToast((data as Record<string, unknown>).welcome_toast_person as string ?? "");
          setDjAfterParty((data as Record<string, unknown>).dj_staying_for_afterparty as boolean ?? false);
          setDjPlaylist((data as Record<string, unknown>).dj_playlist_name as string ?? "");
          setDjEvents((data as Record<string, unknown>).dj_events_performing as string[] ?? []);
          setSpeechesRehearsal((data as Record<string, unknown>).speeches_rehearsal as SpeechEntry[] ?? []);
          setSpeechesReception((data as Record<string, unknown>).speeches_reception as SpeechEntry[] ?? []);
          setMiscNotes((data as Record<string, unknown>).misc_notes as string ?? "");
        }
        setLoading(false);
        setTimeout(() => { initialLoad.current = false; }, 100);
      });
  }, [eventId]);

  const buildPayload = useCallback(() => ({
    event_id: eventId,
    officiant_name: officiantName || null,
    officiant_relationship: officiantRelationship || null,
    officiant_attending_rehearsal: officiantAttending,
    microphone_type: microphone || null,
    ceremony_music_vendor: ceremonyMusicVendor || null,
    dj_band_vendor: djBandVendor || null,
    processional_order: processional as unknown as Json,
    first_dance_song: firstDance || null,
    parent_dances: parentDances as unknown as Json,
    recessional_song: recessionalSong || null,
    last_dance_song: lastDanceSong || null,
    cake_cutting_song: cakeCuttingSong || null,
    script_sent_to_brandon: scriptSent,
    special_notes: specialNotes || null,
    updated_at: new Date().toISOString(),
    // New columns
    musician_singer: musicianSinger as unknown as Json,
    microphone_speakers: micSpeakers,
    couple_staying_for_photos: couplePhotos,
    couple_leading_to_cocktail: coupleCocktail,
    wedding_party_altar_choice: altarChoice,
    wedding_party_altar_notes: altarNotes || null,
    formal_introductions: introductions as unknown as Json,
    welcome_toast_person: welcomeToast || null,
    dj_staying_for_afterparty: djAfterParty,
    dj_playlist_name: djPlaylist || null,
    dj_events_performing: djEvents as unknown as Json,
    speeches_rehearsal: speechesRehearsal as unknown as Json,
    speeches_reception: speechesReception as unknown as Json,
    misc_notes: miscNotes || null,
  }), [eventId, officiantName, officiantRelationship, officiantAttending, microphone, ceremonyMusicVendor, djBandVendor, processional, firstDance, parentDances, recessionalSong, lastDanceSong, cakeCuttingSong, scriptSent, specialNotes, musicianSinger, micSpeakers, couplePhotos, coupleCocktail, altarChoice, altarNotes, introductions, welcomeToast, djAfterParty, djPlaylist, djEvents, speechesRehearsal, speechesReception, miscNotes]);

  // Autosave debounce
  useEffect(() => {
    if (loading || initialLoad.current) return;
    markUnsaved();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSave(), 800);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [officiantName, officiantRelationship, officiantAttending, microphone, ceremonyMusicVendor, djBandVendor, processional, firstDance, parentDances, recessionalSong, lastDanceSong, cakeCuttingSong, scriptSent, specialNotes, musicianSinger, micSpeakers, couplePhotos, coupleCocktail, altarChoice, altarNotes, introductions, welcomeToast, djAfterParty, djPlaylist, djEvents, speechesRehearsal, speechesReception, miscNotes]);

  const doSave = async () => {
    await trackSave(async () => {
      const payload = buildPayload() as Record<string, unknown>;
      if (recordId) {
        await supabase.from("ceremony_details").update(payload as never).eq("id", recordId);
      } else {
        const { data } = await supabase.from("ceremony_details").insert(payload as never).select("id").single();
        if (data) setRecordId(data.id);
      }
    });
  };

  const handleManualSave = async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await doSave();
  };

  const toggleLock = async () => {
    if (!recordId) await handleManualSave();
    setLocking(true);
    const next = !locked;
    if (recordId) {
      await supabase.from("ceremony_details").update({ locked_by_brandon: next }).eq("id", recordId);
    } else {
      const payload = { ...buildPayload(), locked_by_brandon: next } as Record<string, unknown>;
      const { data } = await supabase.from("ceremony_details")
        .insert(payload as never).select("id").single();
      if (data) setRecordId(data.id);
    }
    setLocked(next);
    setLocking(false);
  };

  if (loading) return (
    <div className="py-12 flex justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6 pb-24 animate-fade-up relative">

      {/* Lock banner */}
      {locked ? (
        <div className="flex items-center justify-between rounded-xl bg-sage/10 border border-sage/25 px-5 py-4">
          <div className="flex items-center gap-3">
            <Lock size={16} className="text-sage shrink-0" />
            <div>
              <p className="font-body text-sm font-medium text-foreground">Details are locked</p>
              <p className="font-body text-xs text-muted-foreground">The couple's form is read-only. Unlock to allow edits.</p>
            </div>
          </div>
          <button onClick={toggleLock} disabled={locking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sage/30 text-sage font-body text-sm hover:bg-sage/10 transition-colors disabled:opacity-50">
            {locking ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />} Unlock
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-muted/40 border border-border px-5 py-4">
          <div>
            <p className="font-body text-sm text-foreground">Ceremony details are editable</p>
            <p className="font-body text-xs text-muted-foreground">Lock to prevent further couple edits once finalized.</p>
          </div>
          <button onClick={toggleLock} disabled={locking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
            {locking ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />} Lock Details
          </button>
        </div>
      )}

      {/* ── Officiant ── */}
      <Section title="Officiant">
        <TextRow label="Name" value={officiantName} onChange={setOfficiantName} placeholder="Officiant's full name" />
        <TextRow label="Relationship" value={officiantRelationship} onChange={setOfficiantRelationship} placeholder="e.g. Family friend, pastor" />
        <CheckRow label="Attending rehearsal?" checked={officiantAttending} onChange={setOfficiantAttending} />
        <CheckRow label="Ceremony script sent to Brandon?" checked={scriptSent} onChange={setScriptSent} />
      </Section>

      {/* ── Ceremony Music Provider ── */}
      <Section title="Ceremony Music Provider">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <CheckRow label="Musician/Singer/Acoustic booked" checked={musicianSinger.booked}
              onChange={v => setMusicianSinger(prev => ({ ...prev, booked: v }))} />
          </div>
          <TextRow label="Musician name" value={musicianSinger.name}
            onChange={v => setMusicianSinger(prev => ({ ...prev, name: v }))} placeholder="Performer name" />
          <CheckRow label="Microphone & Speakers needed" checked={micSpeakers} onChange={setMicSpeakers} />
          <div className="grid grid-cols-3 gap-4 items-center">
            <p className="font-body text-sm text-muted-foreground">Microphone type</p>
            <div className="col-span-2">
              <select value={microphone} onChange={e => setMicrophone(e.target.value)}
                className="rounded-lg border border-border px-3.5 py-2.5 font-body text-sm bg-background text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20">
                {MIC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <TextRow label="Ceremony music vendor" value={ceremonyMusicVendor} onChange={setCeremonyMusicVendor} placeholder="Vendor / performer name" />
        </div>
      </Section>

      {/* ── Processional ── */}
      <Section title="Processional Order">
        <InstructionBlock {...PROCESSIONAL_INSTRUCTIONS} />
        <div className="space-y-3">
          {processional.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">Nothing added yet.</p>
          )}
          {processional.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3 relative">
              <button onClick={() => setProcessional(p => p.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
              <div className="grid grid-cols-2 gap-3 pr-5">
                {(["role", "name"] as const).map(f => (
                  <div key={f} className="space-y-1">
                    <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground capitalize">{f}</label>
                    <input value={entry[f]} onChange={e => setProcessional(p => p.map((r, idx) => idx === i ? { ...r, [f]: e.target.value } : r))}
                      placeholder={f === "role" ? "e.g. Flower Girl" : "Full name"}
                      className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Walking in to</label>
                <input value={entry.song} onChange={e => setProcessional(p => p.map((r, idx) => idx === i ? { ...r, song: e.target.value } : r))}
                  placeholder="Song name"
                  className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              </div>
            </div>
          ))}
          <button onClick={() => setProcessional(p => [...p, { role: "", name: "", song: "" }])}
            className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
            <Plus size={14} /> Add person
          </button>
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <CheckRow label="Couple staying at ceremony site for family photos" checked={couplePhotos} onChange={setCouplePhotos} />
          <CheckRow label="Couple leading guests to cocktail hour" checked={coupleCocktail} onChange={setCoupleCocktail} />
        </div>
      </Section>

      {/* ── Wedding Party at Altar ── */}
      <Section title="Wedding Party at Altar">
        <div className="grid grid-cols-3 gap-4 items-center">
          <p className="font-body text-sm text-muted-foreground">Family & wedding party</p>
          <div className="col-span-2">
            <select value={altarChoice} onChange={e => setAltarChoice(e.target.value)}
              className="rounded-lg border border-border px-3.5 py-2.5 font-body text-sm bg-background text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20">
              {ALTAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <TextRow label="Additional notes" value={altarNotes} onChange={setAltarNotes} placeholder="Notes about altar arrangement…" />
      </Section>

      {/* ── Music Selections ── */}
      <Section title="Music Selections">
        <TextRow label="First dance" value={firstDance} onChange={setFirstDance} placeholder="Song & artist" />
        <TextRow label="Recessional" value={recessionalSong} onChange={setRecessionalSong} placeholder="Song & artist" />
        <TextRow label="Last dance" value={lastDanceSong} onChange={setLastDanceSong} placeholder="Song & artist" />
        <TextRow label="Cake cutting" value={cakeCuttingSong} onChange={setCakeCuttingSong} placeholder="Song & artist" />
      </Section>

      {/* ── Parent Dances ── */}
      <Section title="Parent Dances">
        <div className="space-y-3">
          {parentDances.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">Nothing added yet.</p>
          )}
          {parentDances.map((d, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3 relative">
              <button onClick={() => setParentDances(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
              {(["who", "song"] as const).map(f => (
                <div key={f} className="space-y-1 pr-5">
                  <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">{f === "who" ? "Who is dancing" : "Song"}</label>
                  <input value={d[f]} onChange={e => setParentDances(prev => prev.map((r, idx) => idx === i ? { ...r, [f]: e.target.value } : r))}
                    placeholder={f === "who" ? "e.g. Father of the Bride & Bride" : "Song & artist"}
                    className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => setParentDances(d => [...d, { who: "", song: "" }])}
            className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
            <Plus size={14} /> Add dance
          </button>
        </div>
      </Section>

      {/* ── Reception — Formal Introductions ── */}
      <Section title="Reception — Formal Introductions">
        <div className="space-y-3">
          {introductions.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">No introductions added yet.</p>
          )}
          {introductions.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/10 p-4 space-y-3 relative">
              <button onClick={() => setIntroductions(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={13} />
              </button>
              <div className="grid grid-cols-2 gap-3 pr-5">
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Name</label>
                  <input value={entry.name} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                    placeholder="Full name"
                    className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
                </div>
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Role / Relationship</label>
                  <input value={entry.role} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, role: e.target.value } : r))}
                    placeholder="e.g. Best Man"
                    className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <CheckRow label="Unescorted" checked={entry.unescorted}
                  onChange={v => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, unescorted: v } : r))} />
              </div>
              {!entry.unescorted && (
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Escorted by</label>
                  <input value={entry.escorted_by} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, escorted_by: e.target.value } : r))}
                    placeholder="Name of escort"
                    className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
                </div>
              )}
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Song selection</label>
                <input value={entry.song} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, song: e.target.value } : r))}
                  placeholder="Song & artist"
                  className="w-full rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              </div>
            </div>
          ))}
          <button onClick={() => setIntroductions(p => [...p, { name: "", unescorted: false, escorted_by: "", role: "", song: "" }])}
            className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
            <Plus size={14} /> Add introduction
          </button>
        </div>
      </Section>

      {/* ── Welcome Toast ── */}
      <Section title="Welcome Toast">
        <TextRow label="Given by" value={welcomeToast} onChange={setWelcomeToast} placeholder="Name of person giving the welcome toast" />
      </Section>

      {/* ── DJ / Band ── */}
      <Section title="DJ / Band">
        <TextRow label="DJ / Band name" value={djBandVendor} onChange={setDjBandVendor} placeholder="Vendor name" />
        <CheckRow label="DJ staying for after-party?" checked={djAfterParty} onChange={setDjAfterParty} />
        <TextRow label="Playlist name" value={djPlaylist} onChange={setDjPlaylist} placeholder="After-party playlist name" />
        <div className="space-y-2">
          <p className="font-body text-sm text-muted-foreground">Events DJ/Band is performing</p>
          <div className="flex flex-wrap gap-3">
            {DJ_EVENT_OPTIONS.map(ev => (
              <CheckRow key={ev} label={ev} checked={djEvents.includes(ev)}
                onChange={v => setDjEvents(prev => v ? [...prev, ev] : prev.filter(e => e !== ev))} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── Speeches ── */}
      <Section title="Speeches">
        {/* Rehearsal Dinner */}
        <div className="space-y-3">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Rehearsal Dinner</p>
          {speechesRehearsal.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">No speakers added yet.</p>
          )}
          {speechesRehearsal.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input value={s.speaker} onChange={e => setSpeechesRehearsal(p => p.map((r, idx) => idx === i ? { ...r, speaker: e.target.value } : r))}
                placeholder="Speaker name"
                className="flex-1 rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              <input value={s.time} onChange={e => setSpeechesRehearsal(p => p.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                placeholder="e.g. 5 minutes"
                className="w-32 rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              <button onClick={() => setSpeechesRehearsal(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={() => setSpeechesRehearsal(p => [...p, { speaker: "", time: "" }])}
            className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
            <Plus size={14} /> Add speaker
          </button>
        </div>

        <div className="border-t border-border my-4" />

        {/* Reception Dinner */}
        <div className="space-y-3">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">Reception Dinner</p>
          {speechesReception.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">No speakers added yet.</p>
          )}
          {speechesReception.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input value={s.speaker} onChange={e => setSpeechesReception(p => p.map((r, idx) => idx === i ? { ...r, speaker: e.target.value } : r))}
                placeholder="Speaker name"
                className="flex-1 rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              <input value={s.time} onChange={e => setSpeechesReception(p => p.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                placeholder="e.g. 5 minutes"
                className="w-32 rounded border border-border px-2.5 py-2 font-body text-sm bg-background focus:outline-none focus:border-primary/50" />
              <button onClick={() => setSpeechesReception(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button onClick={() => setSpeechesReception(p => [...p, { speaker: "", time: "" }])}
            className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
            <Plus size={14} /> Add speaker
          </button>
        </div>
      </Section>

      {/* ── Miscellaneous ── */}
      <Section title="Miscellaneous">
        <textarea
          value={miscNotes} onChange={e => setMiscNotes(e.target.value)}
          placeholder="Any additional notes…"
          rows={4}
          className="w-full rounded-lg border border-border px-3.5 py-3 font-body text-sm bg-background resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/40"
        />
        <p className="font-body text-[11px] text-muted-foreground">
          Email any speeches, vows, or prayers to Brandon as backup so he can print copies if needed.
        </p>
      </Section>

      {/* ── Special Notes (original) ── */}
      <Section title="Special Notes">
        <textarea
          value={specialNotes} onChange={e => setSpecialNotes(e.target.value)}
          placeholder="Ceremony notes, cues, timing instructions…"
          rows={4}
          className="w-full rounded-lg border border-border px-3.5 py-3 font-body text-sm bg-background resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/40"
        />
      </Section>

      <AdminStickyFooter status={status} onSave={handleManualSave} onSaveAndContinue={() => { handleManualSave(); onNavigateNext?.(); }} />
    </div>
  );
}
