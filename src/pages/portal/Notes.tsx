import { useEffect, useState, useRef } from "react";
import { usePortalData } from "@/hooks/usePortalData";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Lock, Eye, Loader2, Trash2 } from "lucide-react";

interface Note {
  id: string;
  title: string;
  body: string;
  shared_with_brandon: boolean;
  created_at: string | null;
}

export default function Notes() {
  const { eventId } = usePortalData();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("couple_notes")
      .select("id, title, body, shared_with_brandon, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setNotes(data.map(n => ({ ...n, title: n.title ?? "", body: n.body ?? "", shared_with_brandon: n.shared_with_brandon ?? false })));
        setLoading(false);
      });
  }, [eventId]);

  const addNote = async () => {
    if (!eventId || !user) return;
    const { data } = await supabase
      .from("couple_notes")
      .insert({ event_id: eventId, created_by: user.id, title: "", body: "", shared_with_brandon: false })
      .select("id, title, body, shared_with_brandon, created_at")
      .single();
    if (data) setNotes(prev => [{ ...data, title: data.title ?? "", body: data.body ?? "", shared_with_brandon: data.shared_with_brandon ?? false }, ...prev]);
  };

  const updateNote = (id: string, field: string, value: string | boolean) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id]);
    debounceTimers.current[id] = setTimeout(() => {
      supabase.from("couple_notes").update({ [field]: value, updated_at: new Date().toISOString() } as any).eq("id", id).then(() => {});
    }, 800);
  };

  const deleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    await supabase.from("couple_notes").delete().eq("id", id);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Your thoughts
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-2">Notes</h1>
        <p className="font-body text-sm text-muted-foreground mb-8">
          Jot down ideas, questions, or reminders. Notes are private unless you choose to share them with Brandon.
        </p>

        <button
          onClick={addNote}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-body text-sm text-primary-foreground hover:bg-primary/90 transition-colors mb-6"
        >
          <Plus size={15} />
          Add Note
        </button>

        {notes.length === 0 ? (
          <div className="text-center py-16">
            <Lock size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">No notes yet</p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Tap "Add Note" to start writing. Everything stays private until you share it.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map(note => (
              <div key={note.id} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                <div className="px-5 pt-4 pb-2">
                  <input
                    type="text"
                    value={note.title}
                    onChange={e => updateNote(note.id, "title", e.target.value)}
                    placeholder="Note title…"
                    className="w-full font-display text-lg font-light text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="px-5 pb-4">
                  <textarea
                    value={note.body}
                    onChange={e => updateNote(note.id, "body", e.target.value)}
                    placeholder="Write your thoughts here…"
                    rows={3}
                    className="w-full font-body text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground/40 resize-none leading-relaxed"
                  />
                </div>
                <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                  <button
                    onClick={() => updateNote(note.id, "shared_with_brandon", !note.shared_with_brandon)}
                    className={`flex items-center gap-1.5 font-body text-xs transition-colors ${
                      note.shared_with_brandon ? "text-sage" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {note.shared_with_brandon ? (
                      <>
                        <Eye size={13} />
                        Shared with Brandon
                      </>
                    ) : (
                      <>
                        <Lock size={13} />
                        Private — only you can see this
                      </>
                    )}
                  </button>
                  <div className="flex items-center gap-3">
                    {note.created_at && (
                      <span className="font-body text-[10px] text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
