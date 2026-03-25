import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Save, Check, Loader2, Plus, Trash2, Lock } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface ProcessionalEntry {
  role: string;
  name: string;
  song: string;
}

interface DanceEntry {
  who: string;
  song: string;
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="font-body text-[10px] tracking-widest uppercase text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        maxLength={200}
        className={`w-full rounded-lg border px-3.5 py-2.5 font-body text-sm transition-colors focus:outline-none ${
          readOnly
            ? "border-border bg-muted/30 text-muted-foreground cursor-default"
            : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        }`}
      />
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-lg font-light text-foreground border-b border-border pb-2 mb-4">{children}</p>
  );
}

export function CeremonyMusic() {
  const { eventId } = usePortalData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const [officiantName, setOfficiantName] = useState("");
  const [officiantRelationship, setOfficiantRelationship] = useState("");
  const [officiantAttending, setOfficiantAttending] = useState(false);
  const [processional, setProcessional] = useState<ProcessionalEntry[]>([]);
  const [firstDance, setFirstDance] = useState("");
  const [parentDances, setParentDances] = useState<DanceEntry[]>([]);
  const [recessionalSong, setRecessionalSong] = useState("");
  const [lastDanceSong, setLastDanceSong] = useState("");
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
          setProcessional((data.processional_order as ProcessionalEntry[] | null) ?? []);
          setFirstDance(data.first_dance_song ?? "");
          setParentDances((data.parent_dances as DanceEntry[] | null) ?? []);
          setRecessionalSong(data.recessional_song ?? "");
          setLastDanceSong(data.last_dance_song ?? "");
          setSpecialNotes(data.special_notes ?? "");
        }
        setLoading(false);
      });
  }, [eventId]);

  const addProcessionalRow = () =>
    setProcessional((p) => [...p, { role: "", name: "", song: "" }]);

  const updateProcessional = (i: number, field: keyof ProcessionalEntry, value: string) =>
    setProcessional((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const removeProcessional = (i: number) =>
    setProcessional((p) => p.filter((_, idx) => idx !== i));

  const addDanceRow = () => setParentDances((d) => [...d, { who: "", song: "" }]);

  const updateDance = (i: number, field: keyof DanceEntry, value: string) =>
    setParentDances((d) => d.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const removeDance = (i: number) =>
    setParentDances((d) => d.filter((_, idx) => idx !== i));

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
    };

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

      {/* Officiant */}
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

      {/* Processional order */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <SectionHeading>Processional Order</SectionHeading>
        <div className="space-y-3">
          {processional.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No entries yet.</p>
          )}
          {processional.map((entry, i) => (
            <div key={i} className="rounded-lg border border-border p-3.5 space-y-2.5 relative">
              {!locked && (
                <button onClick={() => removeProcessional(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5 pr-5">
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Role</label>
                  <input
                    value={entry.role}
                    onChange={(e) => updateProcessional(i, "role", e.target.value)}
                    readOnly={locked}
                    placeholder="e.g. Flower Girl"
                    maxLength={80}
                    className={`w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"}`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Name</label>
                  <input
                    value={entry.name}
                    onChange={(e) => updateProcessional(i, "name", e.target.value)}
                    readOnly={locked}
                    placeholder="Full name"
                    maxLength={100}
                    className={`w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"}`}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Walking In To</label>
                <input
                  value={entry.song}
                  onChange={(e) => updateProcessional(i, "song", e.target.value)}
                  readOnly={locked}
                  placeholder="Song name"
                  maxLength={150}
                  className={`w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"}`}
                />
              </div>
            </div>
          ))}
          {!locked && (
            <button onClick={addProcessionalRow} className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors mt-2">
              <Plus size={14} /> Add person
            </button>
          )}
        </div>
      </div>

      {/* Songs */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-4">
        <SectionHeading>Music Selections</SectionHeading>
        <TextInput label="First Dance" value={firstDance} onChange={locked ? undefined : setFirstDance} placeholder="Song name & artist" readOnly={locked} />
        <TextInput label="Recessional" value={recessionalSong} onChange={locked ? undefined : setRecessionalSong} placeholder="Song name & artist" readOnly={locked} />
        <TextInput label="Last Dance" value={lastDanceSong} onChange={locked ? undefined : setLastDanceSong} placeholder="Song name & artist" readOnly={locked} />
      </div>

      {/* Parent dances */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5">
        <SectionHeading>Parent Dances</SectionHeading>
        <div className="space-y-3">
          {parentDances.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">No parent dances added yet.</p>
          )}
          {parentDances.map((d, i) => (
            <div key={i} className="rounded-lg border border-border p-3.5 space-y-2.5 relative">
              {!locked && (
                <button onClick={() => removeDance(i)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={13} />
                </button>
              )}
              <div className="space-y-1 pr-5">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Who is dancing</label>
                <input value={d.who} onChange={(e) => updateDance(i, "who", e.target.value)} readOnly={locked} placeholder="e.g. Father of the Bride & Bride" maxLength={120}
                  className={`w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"}`} />
              </div>
              <div className="space-y-1">
                <label className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Song</label>
                <input value={d.song} onChange={(e) => updateDance(i, "song", e.target.value)} readOnly={locked} placeholder="Song name & artist" maxLength={150}
                  className={`w-full rounded border px-2.5 py-2 font-body text-sm focus:outline-none transition-colors ${locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50"}`} />
              </div>
            </div>
          ))}
          {!locked && (
            <button onClick={addDanceRow} className="flex items-center gap-2 font-body text-sm text-primary hover:text-sage-dark transition-colors mt-2">
              <Plus size={14} /> Add dance
            </button>
          )}
        </div>
      </div>

      {/* Special notes */}
      <div className="rounded-xl bg-card border border-border shadow-soft p-5 space-y-3">
        <SectionHeading>Special Notes</SectionHeading>
        <textarea
          value={specialNotes}
          onChange={locked ? undefined : (e) => setSpecialNotes(e.target.value)}
          readOnly={locked}
          placeholder="Anything else Brandon should know about your ceremony…"
          rows={4}
          maxLength={1000}
          className={`w-full rounded-lg border px-3.5 py-3 font-body text-sm resize-none focus:outline-none transition-colors ${
            locked ? "border-border bg-muted/30 text-muted-foreground" : "border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          }`}
        />
      </div>

      {!locked && (
        <button onClick={handleSave} disabled={saving}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-body text-sm font-medium text-primary-foreground hover:bg-sage-dark transition-colors disabled:opacity-60">
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Ceremony Details</>}
        </button>
      )}
    </div>
  );
}
