import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAutosaveStatus } from "@/hooks/useAutosaveStatus";

interface PaymentSettings {
  id: string;
  bank_name: string | null;
  account_name: string | null;
  routing_number: string | null;
  account_number: string | null;
  additional_instructions: string | null;
}

interface Props {
  editable?: boolean;
}

const EMPTY: PaymentSettings = {
  id: "",
  bank_name: "",
  account_name: "",
  routing_number: "",
  account_number: "",
  additional_instructions: "",
};

export default function WireInstructions({ editable = false }: Props) {
  const [settings, setSettings] = useState<PaymentSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const { status, debouncedSave } = useAutosaveStatus();
  const firstLoad = useRef(true);

  useEffect(() => {
    (supabase as any)
      .from("payment_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setSettings(data);
        setLoading(false);
        firstLoad.current = false;
      });
  }, []);

  const update = (field: keyof PaymentSettings, value: string) => {
    setSettings((s) => ({ ...s, [field]: value }));
    if (!settings.id) return;
    debouncedSave(`payment_settings:${field}`, async () => {
      const { error } = await (supabase as any)
        .from("payment_settings")
        .update({ [field]: value })
        .eq("id", settings.id);
      if (error) toast.error("Couldn't save — " + error.message);
    });
  };

  const copy = async (label: string, value: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value.replace(/\s+/g, ""));
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 1500);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Row = ({ label, field, mono }: { label: string; field: keyof PaymentSettings; mono?: boolean }) => {
    const value = (settings[field] as string) || "";
    const isCopied = copied === label;
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
        <div className="w-32 shrink-0">
          <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
        </div>
        <div className="flex-1 min-w-0">
          {editable ? (
            <input
              value={value}
              onChange={(e) => update(field, e.target.value)}
              className={`w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-sage focus:outline-none text-sm py-1 text-foreground ${mono ? "font-mono tracking-wider tabular-nums" : "font-body"}`}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          ) : (
            <p className={`text-sm text-foreground truncate ${mono ? "font-mono tracking-wider tabular-nums" : "font-body"}`}>
              {value || <span className="text-muted-foreground italic">Not provided</span>}
            </p>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={() => copy(label, value)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-sage transition-colors px-2 py-1 rounded-md hover:bg-sage/10"
            title={`Copy ${label}`}
          >
            {isCopied ? <Check size={12} className="text-sage" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{isCopied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-sage/8 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-full bg-sage/15">
            <Shield size={14} className="text-sage" />
          </div>
          <div>
            <p className="font-display text-lg font-light text-foreground">Wire Transfer Instructions</p>
            <p className="font-body text-xs text-muted-foreground mt-0.5">
              {editable
                ? "These details are shared with every couple. Changes save automatically."
                : "Use these details when wiring payment from your bank."}
            </p>
          </div>
        </div>
        {editable && status === "saving" && (
          <span className="text-[11px] text-muted-foreground italic">Saving…</span>
        )}
        {editable && status === "saved" && (
          <span className="text-[11px] text-sage italic">Saved</span>
        )}
      </div>

      <div>
        <Row label="Bank Name" field="bank_name" />
        <Row label="Account Name" field="account_name" />
        <div className="bg-cream/40">
          <Row label="Routing Number" field="routing_number" mono />
          <Row label="Account Number" field="account_number" mono />
        </div>
      </div>

      <div className="px-5 py-4 border-t border-border">
        <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Additional Instructions
        </p>
        {editable ? (
          <textarea
            value={settings.additional_instructions || ""}
            onChange={(e) => update("additional_instructions", e.target.value)}
            rows={3}
            placeholder="Optional notes (SWIFT code, bank address, etc.)"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-body text-foreground focus:outline-none focus:border-sage resize-y"
          />
        ) : settings.additional_instructions ? (
          <p className="text-sm font-body text-foreground whitespace-pre-wrap">{settings.additional_instructions}</p>
        ) : (
          <p className="text-sm font-body text-muted-foreground italic">No additional instructions.</p>
        )}
      </div>

      {!editable && (
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="font-body text-xs text-muted-foreground">
            Please include your names and wedding date as the payment reference.
          </p>
        </div>
      )}
    </div>
  );
}
