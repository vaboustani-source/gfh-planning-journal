import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Save, Check, Loader2, Plus, Trash2, Lock, Unlock,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ProcessionalEntry { role: string; name: string; song: string }
interface DanceEntry { who: string; song: string }

function TextRow({ label, value, onChange, placeholder, readOnly }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-4 items-start">
      <p className="font-body text-sm text-muted-foreground pt-2.5">{label}</p>
      <div className="col-span-2">
        <input
          type="text"
          value={value}
          onChange={onChange ? e => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
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

export default function CeremonyTab({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locking, setLocking] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [officiantName, setOfficiantName] = useState("");
  const [officiantRelationship, setOfficiantRelationship] = useState("");
  const [officiantAttending, setOfficiantAttending] = useState(false);
  const [microphone, setMicrophone] = useState("");
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

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("ceremony_details")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRecordId(data.id);
          setLocked(data.locked_by_brandon ?? false);
          setOfficiantName(data.officiant_name ?? "");
          setOfficiantRelationship(data.officiant_relationship ?? "");
          setOfficiantAttending(data.officiant_attending_rehearsal ?? false);
          setMicrophone(data.microphone_type ?? "");
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
        }
        setLoading(false);
      });
  }, [eventId]);

  const buildPayload = () => ({
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
  });

  const handleSave = async () => {
    setSaving(true);
    const payload = buildPayload();
    if (recordId) {
      await supabase.from("ceremony_details").update(payload).eq("id", recordId);
    } else {
      const { data } = await supabase.from("ceremony_details").insert(payload).select("id").single();
      if (data) setRecordId(data.id);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const toggleLock = async () => {
    if (!recordId) {
      // Save first to ensure record exists
      await handleSave();
    }
    setLocking(true);
    const next = !locked;
    const id = recordId;
    if (id) {
      await supabase.from("ceremony_details").update({ locked_by_brandon: next }).eq("id", id);
    } else {
      const { data } = await supabase.from("ceremony_details")
        .insert({ ...buildPayload(), locked_by_brandon: next })
        .select("id").single();
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl bg-card border border-border p-5 space-y-4">
      <p className="font-display text-lg font-light text-foreground border-b border-border pb-2">{title}</p>
      {children}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-up">
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
          <button
            onClick={toggleLock}
            disabled={locking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-sage/30 text-sage font-body text-sm hover:bg-sage/10 transition-colors disabled:opacity-50"
          >
            {locking ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
            Unlock
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-muted/40 border border-border px-5 py-4">
          <div>
            <p className="font-body text-sm text-foreground">Ceremony details are editable</p>
            <p className="font-body text-xs text-muted-foreground">Lock to prevent further couple edits once finalized.</p>
          </div>
          <button
            onClick={toggleLock}
            disabled={locking}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {locking ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
            Lock Details
          </button>
        </div>
      )}

      {/* Officiant */}
      <Section title="Officiant">
        <TextRow label="Name" value={officiantName} onChange={setOfficiantName} placeholder="Officiant's full name" />
        <TextRow label="Relationship" value={officiantRelationship} onChange={setOfficiantRelationship} placeholder="e.g. Family friend, pastor" />
        <div className="grid grid-cols-3 gap-4 items-center">
          <p className="font-body text-sm text-muted-foreground">Attending rehearsal?</p>
          <div className="col-span-2 flex rounded-lg border border-border overflow-hidden w-fit text-xs font-body">
            <button onClick={() => setOfficiantAttending(false)} className={`px-4 py-2 transition-colors ${!officiantAttending ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>No</button>
            <button onClick={() => setOfficiantAttending(true)} className={`px-4 py-2 transition-colors ${officiantAttending ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>Yes</button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 items-center">
          <p className="font-body text-sm text-muted-foreground">Script sent to Brandon?</p>
          <div className="col-span-2 flex rounded-lg border border-border overflow-hidden w-fit text-xs font-body">
            <button onClick={() => setScriptSent(false)} className={`px-4 py-2 transition-colors ${!scriptSent ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>No</button>
            <button onClick={() => setScriptSent(true)} className={`px-4 py-2 transition-colors ${scriptSent ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>Yes</button>
          </div>
        </div>
      </Section>

      {/* Vendors */}
      <Section title="Audio & Music Vendors">
        <TextRow label="Microphone type" value={microphone} onChange={setMicrophone} placeholder="e.g. Lapel, handheld" />
        <TextRow label="Ceremony music" value={ceremonyMusicVendor} onChange={setCeremonyMusicVendor} placeholder="Vendor / performer name" />
        <TextRow label="DJ / Band" value={djBandVendor} onChange={setDjBandVendor} placeholder="Vendor name" />
      </Section>

      {/* Processional */}
      <Section title="Processional Order">
        <div className="space-y-3">
          {processional.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">Nothing added yet by the couple.</p>
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
      </Section>

      {/* Music */}
      <Section title="Music Selections">
        <TextRow label="First dance" value={firstDance} onChange={setFirstDance} placeholder="Song & artist" />
        <TextRow label="Recessional" value={recessionalSong} onChange={setRecessionalSong} placeholder="Song & artist" />
        <TextRow label="Last dance" value={lastDanceSong} onChange={setLastDanceSong} placeholder="Song & artist" />
        <TextRow label="Cake cutting" value={cakeCuttingSong} onChange={setCakeCuttingSong} placeholder="Song & artist" />
      </Section>

      {/* Parent dances */}
      <Section title="Parent Dances">
        <div className="space-y-3">
          {parentDances.length === 0 && (
            <p className="font-body text-sm text-muted-foreground italic">Nothing added yet by the couple.</p>
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

      {/* Special notes */}
      <Section title="Special Notes">
        <textarea
          value={specialNotes}
          onChange={e => setSpecialNotes(e.target.value)}
          placeholder="Ceremony notes, cues, timing instructions…"
          rows={4}
          className="w-full rounded-lg border border-border px-3.5 py-3 font-body text-sm bg-background resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/40"
        />
      </Section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-body text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> :
         saved ? <><Check size={15} /> Saved!</> :
         <><Save size={15} /> Save Ceremony Details</>}
      </button>
    </div>
  );
}
