import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, CheckCircle2, AlertCircle, Send, Mail } from "lucide-react";
import { toast } from "sonner";

interface Template {
  key: string;
  name: string;
}

type RowStatus = "idle" | "sending" | "success" | "error";

interface RowState {
  status: RowStatus;
  error?: string;
}

export default function SettingsEmailTest() {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState("");
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkIndex, setBulkIndex] = useState(0);

  useEffect(() => {
    const email = profile?.email || user?.email || "";
    setRecipient(email);
  }, [user?.email, profile?.email]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("key, name")
        .order("name", { ascending: true });
      if (!error && data) setTemplates(data as Template[]);
      setLoading(false);
    })();
  }, []);

  const validRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());

  const sendOne = async (key: string): Promise<boolean> => {
    setRowStates((s) => ({ ...s, [key]: { status: "sending" } }));
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { key, recipient: recipient.trim() },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Send failed");
      setRowStates((s) => ({ ...s, [key]: { status: "success" } }));
      return true;
    } catch (e: any) {
      setRowStates((s) => ({ ...s, [key]: { status: "error", error: e?.message || "Send failed" } }));
      return false;
    }
  };

  const handleSendOne = async (key: string) => {
    if (!validRecipient) {
      toast.error("Enter a valid recipient email first");
      return;
    }
    const ok = await sendOne(key);
    if (ok) toast.success("Test sent");
  };

  const handleSendAll = async () => {
    if (!validRecipient) {
      toast.error("Enter a valid recipient email first");
      return;
    }
    setBulkRunning(true);
    setBulkIndex(0);
    let okCount = 0;
    for (let i = 0; i < templates.length; i++) {
      setBulkIndex(i + 1);
      const ok = await sendOne(templates[i].key);
      if (ok) okCount += 1;
    }
    setBulkRunning(false);
    toast.success(`Sent ${okCount} of ${templates.length} templates`);
  };

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-light" style={{ color: "#2C3E2D" }}>
          Email Test
        </h1>
        <p className="font-body text-sm mt-2" style={{ color: "#55615a" }}>
          Send a sample of any email to your inbox. Samples render through the
          same engine that powers the real sends, so if one arrives and looks
          right, the live version will too.
        </p>
      </header>

      <section className="rounded-xl bg-white border border-[#E8E2D9] p-5 mb-6">
        <label className="block font-body text-[11px] tracking-widest uppercase mb-2" style={{ color: "#6B6B6B" }}>
          Send To
        </label>
        <div className="flex items-center gap-2">
          <Mail size={16} className="text-[#9aa097] shrink-0" />
          <input
            type="email"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 font-body text-sm border border-[#E8E2D9] rounded-md px-3 py-2 bg-white focus:outline-none focus:border-[#2C3E2D]"
          />
          <button
            onClick={handleSendAll}
            disabled={!validRecipient || bulkRunning || templates.length === 0}
            className="px-4 py-2 rounded-md bg-[#2C3E2D] text-white font-body text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {bulkRunning
              ? <><Loader2 size={14} className="animate-spin" /> Sending {bulkIndex}/{templates.length}</>
              : <><Send size={14} /> Send all to me</>}
          </button>
        </div>
        <p className="font-body text-xs mt-2" style={{ color: "#9aa097" }}>
          Test subjects are prefixed with "[Test]" so they cannot be confused with real sends.
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-[#9aa097]" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 font-body text-sm text-[#9aa097]">
          No email templates found.
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-[#E8E2D9] overflow-hidden">
          {templates.map((t, i) => {
            const state = rowStates[t.key]?.status ?? "idle";
            const err = rowStates[t.key]?.error;
            return (
              <div
                key={t.key}
                className={`flex items-center gap-3 px-5 py-4 ${i < templates.length - 1 ? "border-b border-[#F0EDE6]" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium" style={{ color: "#2C3E2D" }}>{t.name}</p>
                  <p className="font-body text-[11px] mt-0.5" style={{ color: "#9aa097" }}>{t.key}</p>
                  {state === "error" && err && (
                    <p className="font-body text-[12px] mt-1 text-red-600">{err}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {state === "success" && <CheckCircle2 size={16} className="text-emerald-600" />}
                  {state === "error" && <AlertCircle size={16} className="text-red-600" />}
                  <button
                    onClick={() => handleSendOne(t.key)}
                    disabled={!validRecipient || state === "sending" || bulkRunning}
                    className="px-3 py-1.5 rounded-md border border-[#E8E2D9] font-body text-xs hover:bg-[#FAF8F4] disabled:opacity-50 flex items-center gap-1.5"
                    style={{ color: "#2C3E2D" }}
                  >
                    {state === "sending"
                      ? <><Loader2 size={12} className="animate-spin" /> Sending</>
                      : state === "success"
                        ? "Send again"
                        : "Send test"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
