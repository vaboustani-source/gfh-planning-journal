import { useEffect, useState } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  TabAccess, TAB_ORDER, TAB_LABELS, TabKey,
  normalizeTabAccess, defaultsForRole,
} from "@/lib/tabAccess";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  participantId: string;
  participantName: string;
  role: string;
  initial: TabAccess | null | undefined;
  onClose: () => void;
  onSaved: (next: TabAccess) => void;
}

export default function TabAccessDrawer({
  participantId, participantName, role, initial, onClose, onSaved,
}: Props) {
  const [access, setAccess] = useState<TabAccess>(() => normalizeTabAccess(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setAccess(normalizeTabAccess(initial)); }, [initial, participantId]);

  const toggle = (k: TabKey) => setAccess(a => ({ ...a, [k]: !a[k] }));

  const applyDefaults = () => setAccess(defaultsForRole(role));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("event_users")
        .update({ tab_access: access })
        .eq("id", participantId);
      if (error) throw error;
      toast.success("Access updated");
      onSaved(access);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-forest/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-md bg-card border-l border-border shadow-elevated flex flex-col h-full animate-fade-up">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-display text-lg font-light text-foreground">Tab Access</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5 truncate">{participantName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={applyDefaults}
            className="inline-flex items-center gap-1.5 rounded-full border border-sage/30 bg-sage/5 px-3 py-1 font-body text-[12px] text-sage-dark hover:bg-sage/10 transition-colors"
          >
            <Sparkles size={12} />
            Apply role defaults
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
          {TAB_ORDER.map(k => (
            <label
              key={k}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <Checkbox checked={access[k]} onCheckedChange={() => toggle(k)} />
              <span className="font-body text-sm text-foreground">{TAB_LABELS[k]}</span>
            </label>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </aside>
    </div>
  );
}
