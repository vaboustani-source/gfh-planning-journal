import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import RichTextEditor from "./RichTextEditor";

export default function EmailSignatureCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [html, setHtml] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("email_signatures")
        .select("html")
        .eq("user_id", user.id)
        .maybeSingle();
      setHtml((data?.html as string) ?? "");
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("email_signatures")
        .upsert({ user_id: user.id, html, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Signature saved.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 mt-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h3 className="font-display text-xl font-light text-foreground">Email signature</h3>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Appended to your Gmail replies sent from the Emails tab.
          </p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground font-body text-sm">
          <Loader2 size={14} className="animate-spin" /> Loading
        </div>
      ) : (
        <>
          <RichTextEditor value={html} onChange={setHtml} placeholder="Your name, title, contact info..." minHeight={120} />
          <div className="flex justify-end mt-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sage text-white font-body text-sm hover:bg-sage-dark disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save signature
            </button>
          </div>
        </>
      )}
    </div>
  );
}
