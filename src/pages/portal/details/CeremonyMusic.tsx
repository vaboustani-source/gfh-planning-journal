import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Save, Check, Loader2, Plus, Trash2, Lock } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
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

/* ── UI Helpers ── */
function TextInput({ label, value, onChange, placeholder, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">{label}</label>
      <input
        type="text" value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly} placeholder={placeholder} maxLength={200}
        className={`w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${
          readOnly
            ? "border-border bg-muted/30 text-muted-foreground cursor-default"
            : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        }`}
      />
    </div>
  );
}

function CheckRow({ label, checked, onChange, readOnly }: {
  label: string; checked: boolean; onChange?: (v: boolean) => void; readOnly?: boolean;
}) {
  return (
    <label className={`flex items-center gap-3 py-1 ${readOnly ? "" : "cursor-pointer"}`}>
      <div
        onClick={readOnly ? undefined : () => onChange?.(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          readOnly ? "cursor-default" : "cursor-pointer"
        } ${checked ? "bg-primary border-primary" : "border-border bg-background"}`}
      >
        {checked && <Check size={9} className="text-primary-foreground" />}
      </div>
      <span className="font-body text-sm text-foreground">{label}</span>
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-lg font-light text-foreground border-b border-border pb-2 mb-4">{children}</p>
  );
}

const inputClass = (locked: boolean) =>
  `w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${
    locked
      ? "border-border bg-muted/30 text-muted-foreground cursor-default"
      : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"
  }`;

export function CeremonyMusic() {
  const { eventId } = usePortalData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  // Existing fields
  const [officiantName, setOfficiantName] = useState("");
  const [officiantRelationship, setOfficiantRelationship] = useState("");
  const [officiantAttending, setOfficiantAttending] = useState(false);
  const [processional, setProcessional] = useState<ProcessionalEntry[]>([]);
  const [firstDance, setFirstDance] = useState("");
  const [parentDances, setParentDances] = useState<DanceEntry[]>([]);
  const [recessionalSong, setRecessionalSong] = useState("");
  const [lastDanceSong, setLastDanceSong] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");

  // New fields matching admin
  const [musicianSinger, setMusicianSinger] = useState<MusicianSinger>({ booked: false, name: "" });
  const [micSpeakers, setMicSpeakers] = useState(false);
  const [microphone, setMicrophone] = useState("Clip-on");
  const [ceremonyMusicVendor, setCeremonyMusicVendor] = useState("");
  const [couplePhotos, setCouplePhotos] = useState(false);
  const [coupleCocktail, setCoupleCocktail] = useState(false);
  const [altarChoice, setAltarChoice] = useState("not_chosen");
  const [altarNotes, setAltarNotes] = useState("");
  const [cakeCuttingSong, setCakeCuttingSong] = useState("");
  const [introductions, setIntroductions] = useState<IntroEntry[]>([]);
  const [welcomeToast, setWelcomeToast] = useState("");
  const [djBandVendor, setDjBandVendor] = useState("");
  const [djAfterParty, setDjAfterParty] = useState(false);
  const [djPlaylist, setDjPlaylist] = useState("");
  const [djEvents, setDjEvents] = useState<string[]>([]);
  const [speechesRehearsal, setSpeechesRehearsal] = useState<SpeechEntry[]>([]);
  const [speechesReception, setSpeechesReception] = useState<SpeechEntry[]>([]);
  const [miscNotes, setMiscNotes] = useState("");

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("ceremony_details")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as Record<string, unknown>;
          setRecordId(data.id);
          setLocked(data.locked_by_brandon ?? false);
          setOfficiantName(data.officiant_name ?? "");
          setOfficiantRelationship(data.officiant_relationship ?? "");
          setOfficiantAttending(data.officiant_attending_rehearsal ?? false);
          setProcessional((data.processional_order as unknown as ProcessionalEntry[] | null) ?? []);
          setFirstDance(data.first_dance_song ?? "");
          setParentDances((data.parent_dances as unknown as DanceEntry[] | null) ?? []);
          setRecessionalSong(data.recessional_song ?? "");
          setLastDanceSong(data.last_dance_song ?? "");
          setSpecialNotes(data.special_notes ?? "");
          // New fields
          setMusicianSinger((d.musician_singer as MusicianSinger) ?? { booked: false, name: "" });
          setMicSpeakers((d.microphone_speakers as boolean) ?? false);
          setMicrophone((d.microphone_type as string) ?? "Clip-on");
          setCeremonyMusicVendor((d.ceremony_music_vendor as string) ?? "");
          setCouplePhotos((d.couple_staying_for_photos as boolean) ?? false);
          setCoupleCocktail((d.couple_leading_to_cocktail as boolean) ?? false);
          setAltarChoice((d.wedding_party_altar_choice as string) ?? "not_chosen");
          setAltarNotes((d.wedding_party_altar_notes as string) ?? "");
          setCakeCuttingSong((d.cake_cutting_song as string) ?? "");
          setIntroductions((d.formal_introductions as IntroEntry[]) ?? []);
          setWelcomeToast((d.welcome_toast_person as string) ?? "");
          setDjBandVendor((d.dj_band_vendor as string) ?? "");
          setDjAfterParty((d.dj_staying_for_afterparty as boolean) ?? false);
          setDjPlaylist((d.dj_playlist_name as string) ?? "");
          setDjEvents((d.dj_events_performing as string[]) ?? []);
          setSpeechesRehearsal((d.speeches_rehearsal as SpeechEntry[]) ?? []);
          setSpeechesReception((d.speeches_reception as SpeechEntry[]) ?? []);
          setMiscNotes((d.misc_notes as string) ?? "");
        }
        setLoading(false);
      });
  }, [eventId]);

  const handleSave = async () => {
    if (!eventId) return;
    setSaving(true);
    const payload = {
      event_id: eventId,
      officiant_name: officiantName || null,
      officiant_relationship: officiantRelationship || null,
      officiant_attending_rehearsal: officiantAttending,
      processional_order: processional as unknown as Json,
      first_dance_song: firstDance || null,
      parent_dances: parentDances as unknown as Json,
      recessional_song: recessionalSong || null,
      last_dance_song: lastDanceSong || null,
      special_notes: specialNotes || null,
      updated_at: new Date().toISOString(),
      // New columns
      musician_singer: musicianSinger as unknown as Json,
      microphone_speakers: micSpeakers,
      microphone_type: microphone || null,
      ceremony_music_vendor: ceremonyMusicVendor || null,
      couple_staying_for_photos: couplePhotos,
      couple_leading_to_cocktail: coupleCocktail,
      wedding_party_altar_choice: altarChoice,
      wedding_party_altar_notes: altarNotes || null,
      cake_cutting_song: cakeCuttingSong || null,
      formal_introductions: introductions as unknown as Json,
      welcome_toast_person: welcomeToast || null,
      dj_band_vendor: djBandVendor || null,
      dj_staying_for_afterparty: djAfterParty,
      dj_playlist_name: djPlaylist || null,
      dj_events_performing: djEvents as unknown as Json,
      speeches_rehearsal: speechesRehearsal as unknown as Json,
      speeches_reception: speechesReception as unknown as Json,
      misc_notes: miscNotes || null,
    } as Record<string, unknown>;

    if (recordId) {
      await supabase.from("ceremony_details").update(payload as never).eq("id", recordId);
    } else {
      const { data } = await supabase.from("ceremony_details").insert(payload as never).select("id").single();
      if (data) setRecordId(data.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-7">
      {/* Locked banner */}
      {locked && (
        <div className="flex items-start gap-3 rounded-xl bg-sage/8 border border-sage/20 px-4 py-4">
          <Lock size={15} className="text-sage mt-0.5 shrink-0" />
          <p className="font-body text-sm text-foreground">
            Your ceremony details have been finalized by Brandon. Please message him if you need any changes.
          </p>
        </div>
      )}

      {/* ── Officiant ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Officiant</SectionHeading>
        <TextInput label="Officiant Name" value={officiantName} onChange={locked ? undefined : setOfficiantName} placeholder="Name" readOnly={locked} />
        <TextInput label="Relationship to Couple" value={officiantRelationship} onChange={locked ? undefined : setOfficiantRelationship} placeholder="e.g. Family friend, pastor" readOnly={locked} />
        <div className="flex items-center justify-between py-1">
          <p className="font-body text-sm text-foreground">Attending rehearsal?</p>
          {locked ? (
            <span className="font-body text-sm text-muted-foreground">{officiantAttending ? "Yes" : "No"}</span>
          ) : (
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-body">
              <button onClick={() => setOfficiantAttending(false)} className={`px-3 py-1.5 transition-colors ${!officiantAttending ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>No</button>
              <button onClick={() => setOfficiantAttending(true)} className={`px-3 py-1.5 transition-colors ${officiantAttending ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>Yes</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Ceremony Music Provider ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Ceremony Music Provider</SectionHeading>
        <CheckRow label="Musician / Singer / Acoustic booked" checked={musicianSinger.booked}
          onChange={locked ? undefined : v => setMusicianSinger(prev => ({ ...prev, booked: v }))} readOnly={locked} />
        <TextInput label="Musician Name" value={musicianSinger.name}
          onChange={locked ? undefined : v => setMusicianSinger(prev => ({ ...prev, name: v }))} placeholder="Performer name" readOnly={locked} />
        <CheckRow label="Microphone & Speakers needed" checked={micSpeakers}
          onChange={locked ? undefined : setMicSpeakers} readOnly={locked} />
        <div className="space-y-1.5">
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Microphone Type</label>
          {locked ? (
            <p className="font-body text-sm text-muted-foreground">{microphone}</p>
          ) : (
            <select value={microphone} onChange={e => setMicrophone(e.target.value)}
              className="rounded-lg border border-border px-3.5 py-2.5 font-body text-sm bg-background text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20">
              {MIC_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>
        <TextInput label="Ceremony Music Vendor" value={ceremonyMusicVendor}
          onChange={locked ? undefined : setCeremonyMusicVendor} placeholder="Vendor / performer name" readOnly={locked} />
      </div>

      {/* ── Processional Order ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <SectionHeading>Processional Order</SectionHeading>
        {!locked && <InstructionBlock {...PROCESSIONAL_INSTRUCTIONS} />}
        <div className="space-y-3 mt-4">
          {processional.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No entries yet.</p>
          )}
          {processional.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border p-3.5 space-y-2.5 relative">
              {!locked && (
                <button onClick={() => setProcessional(p => p.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5 pr-5">
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Role</label>
                  <input value={entry.role} onChange={(e) => setProcessional(p => p.map((r, idx) => idx === i ? { ...r, role: e.target.value } : r))}
                    readOnly={locked} placeholder="e.g. Flower Girl" maxLength={80} className={inputClass(locked)} />
                </div>
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
                  <input value={entry.name} onChange={(e) => setProcessional(p => p.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                    readOnly={locked} placeholder="Full name" maxLength={100} className={inputClass(locked)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Walking In To</label>
                <input value={entry.song} onChange={(e) => setProcessional(p => p.map((r, idx) => idx === i ? { ...r, song: e.target.value } : r))}
                  readOnly={locked} placeholder="Song name" maxLength={150} className={inputClass(locked)} />
              </div>
            </div>
          ))}
          {!locked && (
            <button onClick={() => setProcessional(p => [...p, { role: "", name: "", song: "" }])}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors mt-2">
              <Plus size={14} /> Add person
            </button>
          )}
        </div>

        {/* Post-processional checkboxes */}
        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <CheckRow label="Couple staying at ceremony site for family photos" checked={couplePhotos}
            onChange={locked ? undefined : setCouplePhotos} readOnly={locked} />
          <CheckRow label="Couple leading guests to cocktail hour" checked={coupleCocktail}
            onChange={locked ? undefined : setCoupleCocktail} readOnly={locked} />
        </div>
      </div>

      {/* ── Wedding Party at Altar ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Wedding Party at Altar</SectionHeading>
        <div className="space-y-1.5">
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Family & Wedding Party</label>
          {locked ? (
            <p className="font-body text-sm text-muted-foreground">
              {ALTAR_OPTIONS.find(o => o.value === altarChoice)?.label ?? "Have not chosen yet"}
            </p>
          ) : (
            <select value={altarChoice} onChange={e => setAltarChoice(e.target.value)}
              className="rounded-lg border border-border px-3.5 py-2.5 font-body text-sm bg-background text-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20">
              {ALTAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>
        <TextInput label="Additional Notes" value={altarNotes} onChange={locked ? undefined : setAltarNotes} placeholder="Notes about altar arrangement…" readOnly={locked} />
      </div>

      {/* ── Music Selections ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Music Selections</SectionHeading>
        <TextInput label="First Dance" value={firstDance} onChange={locked ? undefined : setFirstDance} placeholder="Song name & artist" readOnly={locked} />
        <TextInput label="Recessional" value={recessionalSong} onChange={locked ? undefined : setRecessionalSong} placeholder="Song name & artist" readOnly={locked} />
        <TextInput label="Last Dance" value={lastDanceSong} onChange={locked ? undefined : setLastDanceSong} placeholder="Song name & artist" readOnly={locked} />
        <TextInput label="Cake Cutting" value={cakeCuttingSong} onChange={locked ? undefined : setCakeCuttingSong} placeholder="Song name & artist" readOnly={locked} />
      </div>

      {/* ── Parent Dances ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <SectionHeading>Parent Dances</SectionHeading>
        {!locked && <InstructionBlock {...PARENT_DANCES_INSTRUCTIONS} />}
        <div className="space-y-3 mt-4">
          {parentDances.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No parent dances added yet.</p>
          )}
          {parentDances.map((d, i) => (
            <div key={i} className="rounded-lg border border-border p-3.5 space-y-2.5 relative">
              {!locked && (
                <button onClick={() => setParentDances(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <div className="space-y-1 pr-5">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Who is dancing</label>
                <input value={d.who} onChange={(e) => setParentDances(prev => prev.map((r, idx) => idx === i ? { ...r, who: e.target.value } : r))}
                  readOnly={locked} placeholder="e.g. Father of the Bride & Bride" maxLength={120} className={inputClass(locked)} />
              </div>
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Song</label>
                <input value={d.song} onChange={(e) => setParentDances(prev => prev.map((r, idx) => idx === i ? { ...r, song: e.target.value } : r))}
                  readOnly={locked} placeholder="Song name & artist" maxLength={150} className={inputClass(locked)} />
              </div>
            </div>
          ))}
          {!locked && (
            <button onClick={() => setParentDances(d => [...d, { who: "", song: "" }])}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors mt-2">
              <Plus size={14} /> Add dance
            </button>
          )}
        </div>
      </div>

      {/* ── Formal Introductions ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <SectionHeading>Reception — Formal Introductions</SectionHeading>
        <div className="space-y-3">
          {introductions.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No introductions added yet.</p>
          )}
          {introductions.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border p-3.5 space-y-2.5 relative">
              {!locked && (
                <button onClick={() => setIntroductions(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5 pr-5">
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
                  <input value={entry.name} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
                    readOnly={locked} placeholder="Full name" className={inputClass(locked)} />
                </div>
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Role / Relationship</label>
                  <input value={entry.role} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, role: e.target.value } : r))}
                    readOnly={locked} placeholder="e.g. Best Man" className={inputClass(locked)} />
                </div>
              </div>
              <CheckRow label="Unescorted" checked={entry.unescorted}
                onChange={locked ? undefined : v => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, unescorted: v } : r))} readOnly={locked} />
              {!entry.unescorted && (
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Escorted by</label>
                  <input value={entry.escorted_by} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, escorted_by: e.target.value } : r))}
                    readOnly={locked} placeholder="Name of escort" className={inputClass(locked)} />
                </div>
              )}
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Song Selection</label>
                <input value={entry.song} onChange={e => setIntroductions(p => p.map((r, idx) => idx === i ? { ...r, song: e.target.value } : r))}
                  readOnly={locked} placeholder="Song & artist" className={inputClass(locked)} />
              </div>
            </div>
          ))}
          {!locked && (
            <button onClick={() => setIntroductions(p => [...p, { name: "", unescorted: false, escorted_by: "", role: "", song: "" }])}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors mt-2">
              <Plus size={14} /> Add introduction
            </button>
          )}
        </div>
      </div>

      {/* ── Welcome Toast ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Welcome Toast</SectionHeading>
        <TextInput label="Given by" value={welcomeToast} onChange={locked ? undefined : setWelcomeToast} placeholder="Name of person giving the welcome toast" readOnly={locked} />
      </div>

      {/* ── DJ / Band ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>DJ / Band</SectionHeading>
        <TextInput label="DJ / Band Name" value={djBandVendor} onChange={locked ? undefined : setDjBandVendor} placeholder="Vendor name" readOnly={locked} />
        <CheckRow label="DJ staying for after-party?" checked={djAfterParty}
          onChange={locked ? undefined : setDjAfterParty} readOnly={locked} />
        <TextInput label="Playlist Name" value={djPlaylist} onChange={locked ? undefined : setDjPlaylist} placeholder="After-party playlist name" readOnly={locked} />
        <div className="space-y-2">
          <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Events DJ/Band is Performing</label>
          <div className="flex flex-wrap gap-3">
            {DJ_EVENT_OPTIONS.map(ev => (
              <CheckRow key={ev} label={ev} checked={djEvents.includes(ev)}
                onChange={locked ? undefined : v => setDjEvents(prev => v ? [...prev, ev] : prev.filter(e => e !== ev))} readOnly={locked} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Speeches ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Speeches</SectionHeading>

        {/* Rehearsal Dinner */}
        <div className="space-y-3">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Rehearsal Dinner</p>
          {speechesRehearsal.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No speakers added yet.</p>
          )}
          {speechesRehearsal.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input value={s.speaker} onChange={e => setSpeechesRehearsal(p => p.map((r, idx) => idx === i ? { ...r, speaker: e.target.value } : r))}
                readOnly={locked} placeholder="Speaker name" className={`flex-1 ${inputClass(locked)}`} />
              <input value={s.time} onChange={e => setSpeechesRehearsal(p => p.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                readOnly={locked} placeholder="e.g. 5 minutes" className={`w-28 ${inputClass(locked)}`} />
              {!locked && (
                <button onClick={() => setSpeechesRehearsal(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <button onClick={() => setSpeechesRehearsal(p => [...p, { speaker: "", time: "" }])}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
              <Plus size={14} /> Add speaker
            </button>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Reception */}
        <div className="space-y-3">
          <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">Reception</p>
          {speechesReception.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No speakers added yet.</p>
          )}
          {speechesReception.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input value={s.speaker} onChange={e => setSpeechesReception(p => p.map((r, idx) => idx === i ? { ...r, speaker: e.target.value } : r))}
                readOnly={locked} placeholder="Speaker name" className={`flex-1 ${inputClass(locked)}`} />
              <input value={s.time} onChange={e => setSpeechesReception(p => p.map((r, idx) => idx === i ? { ...r, time: e.target.value } : r))}
                readOnly={locked} placeholder="e.g. 5 minutes" className={`w-28 ${inputClass(locked)}`} />
              {!locked && (
                <button onClick={() => setSpeechesReception(p => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          {!locked && (
            <button onClick={() => setSpeechesReception(p => [...p, { speaker: "", time: "" }])}
              className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors">
              <Plus size={14} /> Add speaker
            </button>
          )}
        </div>
      </div>

      {/* ── Miscellaneous ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-3">
        <SectionHeading>Miscellaneous</SectionHeading>
        <textarea
          value={miscNotes}
          onChange={locked ? undefined : (e) => setMiscNotes(e.target.value)}
          readOnly={locked}
          placeholder="Any additional notes…"
          rows={4} maxLength={1000}
          className={`w-full rounded-lg border px-3.5 py-3 font-body text-sm resize-none focus:outline-none transition-colors ${
            locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          }`}
        />
        <p className="font-body text-[11px] text-muted-foreground">
          Email any speeches, vows, or prayers to Brandon as backup so he can print copies if needed.
        </p>
      </div>

      {/* ── Special Notes ── */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-3">
        <SectionHeading>Special Notes</SectionHeading>
        <textarea
          value={specialNotes}
          onChange={locked ? undefined : (e) => setSpecialNotes(e.target.value)}
          readOnly={locked}
          placeholder="Anything else Brandon should know about your ceremony…"
          rows={4} maxLength={1000}
          className={`w-full rounded-lg border px-3.5 py-3 font-body text-sm resize-none focus:outline-none transition-colors ${
            locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          }`}
        />
      </div>

      {/* Save button */}
      {!locked && (
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-body text-sm font-medium text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Ceremony Details</>}
        </button>
      )}
    </div>
  );
}
