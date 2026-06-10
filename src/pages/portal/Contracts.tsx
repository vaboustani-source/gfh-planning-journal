import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePortalData } from "@/hooks/usePortalData";
import { toast } from "sonner";
import { FileText, ShieldCheck, Lock, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  renderContract, sha256Hex, statusLabel, statusPillClass, docTypeLabel,
  type ContractContext,
} from "@/lib/contractTemplate";

type Contract = {
  id: string;
  event_id: string;
  title: string;
  document_type: string;
  content: string;
  rendered_content: string | null;
  content_hash: string | null;
  status: string;
  requires_both_partners: boolean;
  sent_at: string | null;
  created_at: string;
};

type Signature = {
  id: string;
  contract_id: string;
  signer_name: string;
  signer_email: string;
  signer_user_id: string | null;
  typed_name: string;
  signed_at: string;
  content_version_hash: string;
};

export default function PortalContracts() {
  const { user } = useAuth();
  const { eventId } = usePortalData();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Contract | null>(null);
  const [ctx, setCtx] = useState<ContractContext>({});

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    const { data: cs } = await (supabase as any)
      .from("contracts").select("*").eq("event_id", eventId)
      .neq("status", "draft").order("created_at", { ascending: false });
    const list = (cs ?? []) as Contract[];
    setContracts(list);
    if (list.length) {
      const { data: sigs } = await (supabase as any)
        .from("contract_signatures").select("*")
        .in("contract_id", list.map(c => c.id));
      setSignatures((sigs ?? []) as Signature[]);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
    if (!eventId) return;
    (async () => {
      const { data: ev } = await supabase
        .from("events")
        .select("title, partner1_name, partner2_name, wedding_date, estimated_guest_count, package_tier")
        .eq("id", eventId).maybeSingle();
      const { data: fin } = await (supabase as any)
        .from("financials").select("site_fee_total, catering_estimate").eq("event_id", eventId).maybeSingle();
      if (ev) {
        const couple = [ev.partner1_name, ev.partner2_name].filter(Boolean).join(" & ") || ev.title;
        const total = (Number(fin?.site_fee_total) || 0) + (Number(fin?.catering_estimate) || 0);
        setCtx({
          couple_names: couple,
          wedding_date: ev.wedding_date,
          venue_name: "Gilbertsville Farmhouse",
          guest_count: ev.estimated_guest_count,
          package_tier: ev.package_tier,
          total_amount: total || null,
        });
      }
    })();
  }, [eventId, load]);

  const signedByMe = (cid: string) => signatures.some(s => s.contract_id === cid && s.signer_user_id === user?.id);
  const sigsFor = (cid: string) => signatures.filter(s => s.contract_id === cid);

  if (active) {
    return <ContractDetail
      contract={active}
      ctx={ctx}
      mySigs={sigsFor(active.id)}
      onBack={() => { setActive(null); void load(); }}
    />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32 space-y-6">
      <header>
        <h1 className="font-display text-3xl text-foreground">Agreements</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Review and sign your wedding agreements. Each signature is permanently recorded for your records.
        </p>
      </header>

      {loading ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText size={28} className="mx-auto text-muted-foreground mb-3" strokeWidth={1.5} />
          <p className="font-display text-lg text-foreground">Nothing to sign just yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">When Brandon sends you an agreement, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const signed = signedByMe(c.id);
            const needsAction = !signed && c.status !== "fully_signed" && c.status !== "voided";
            return (
              <button key={c.id} onClick={() => setActive(c)}
                className={`w-full text-left rounded-xl border bg-white p-5 transition hover:border-sage/40 ${needsAction ? "border-amber-300 ring-1 ring-amber-100" : "border-border"}`}>
                <div className="flex items-start gap-4">
                  <FileText size={20} className="text-sage shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display text-lg text-foreground">{c.title}</p>
                      <span className={`font-body text-[11px] rounded-full px-2 py-0.5 border ${statusPillClass(c.status)}`}>{statusLabel(c.status)}</span>
                      {c.status === "fully_signed" && <Lock size={12} className="text-sage" />}
                    </div>
                    {needsAction ? (
                      <p className="font-body text-sm text-amber-800 mt-1">
                        Action needed — awaits your signature
                      </p>
                    ) : signed ? (
                      <p className="font-body text-sm text-sage-dark mt-1 inline-flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> Signed
                      </p>
                    ) : (
                      <p className="font-body text-xs text-muted-foreground mt-1">{docTypeLabel(c.document_type)}</p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============== Detail / Signing ============== */
function ContractDetail({ contract, ctx, mySigs, onBack }: {
  contract: Contract; ctx: ContractContext; mySigs: Signature[]; onBack: () => void;
}) {
  const { user } = useAuth();
  const [accountName, setAccountName] = useState<string>("");
  const [agreed, setAgreed] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [allSigs, setAllSigs] = useState<Signature[]>(mySigs);
  // Show the frozen rendered_content verbatim when present (sent or later).
  // Drafts have no rendered_content, but couples never see drafts.
  const rendered = contract.rendered_content ?? renderContract(contract.content, ctx);
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const alreadySigned = allSigs.some(s => s.signer_user_id === user?.id);
  const locked = contract.status === "fully_signed" || contract.status === "voided";

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data: u } = await supabase
        .from("users").select("first_name, last_name, email").eq("id", user.id).maybeSingle();
      let name = [u?.first_name, u?.last_name].filter(Boolean).join(" ");
      if (!name) {
        const { data: eu } = await supabase
          .from("event_users").select("display_name").eq("user_id", user.id).eq("event_id", contract.event_id).maybeSingle();
        name = eu?.display_name || (user.email?.split("@")[0] ?? "");
      }
      setAccountName(name);
    })();
    (async () => {
      const { data } = await (supabase as any)
        .from("contract_signatures").select("*").eq("contract_id", contract.id)
        .order("signed_at", { ascending: true });
      setAllSigs((data ?? []) as Signature[]);
    })();
  }, [user?.id, contract.id, contract.event_id]);

  const namesReasonablyMatch = (a: string, b: string) => {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
    const A = norm(a), B = norm(b);
    if (!A.length || !B.length) return false;
    // share at least 2 name tokens, or full set match
    const overlap = A.filter(t => B.includes(t)).length;
    return overlap >= Math.min(2, A.length);
  };

  const canSign = !alreadySigned && !locked && agreed && typed.trim().length >= 3 &&
    (accountName ? namesReasonablyMatch(typed, accountName) : true);

  const sign = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("sign-contract", {
        body: {
          contract_id: contract.id,
          typed_name: typed.trim(),
          agreed_to_terms: true,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Refetch signatures to update the receipt UI
      const { data: latestSigs } = await (supabase as any)
        .from("contract_signatures").select("*").eq("contract_id", contract.id);
      setAllSigs((latestSigs ?? []) as Signature[]);

      toast.success("Signed. A confirmation has been sent to your email.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={14} /> Back to agreements
      </button>

      <article className="bg-white rounded-xl border border-border p-8 md:p-12 shadow-sm">
        <header className="border-b border-border pb-6 mb-6">
          <p className="font-body text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{docTypeLabel(contract.document_type)}</p>
          <h1 className="font-display text-3xl text-foreground mt-2">{contract.title}</h1>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={`font-body text-[11px] rounded-full px-2 py-0.5 border ${statusPillClass(contract.status)}`}>{statusLabel(contract.status)}</span>
            {contract.status === "fully_signed" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-sage-dark"><Lock size={11} /> Signed & Locked</span>
            )}
          </div>
        </header>

        <div className="font-body text-[15px] text-foreground whitespace-pre-wrap leading-[1.75]">
          {rendered}
        </div>

        <div className="mt-10 pt-6 border-t border-border">
          {alreadySigned ? (
            <SignedReceipt sigs={allSigs.filter(s => s.signer_user_id === user?.id)} />
          ) : locked ? (
            <p className="font-body text-sm text-muted-foreground">This document is no longer accepting signatures.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-sage" />
                <p className="font-display text-lg text-foreground">Sign this agreement</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                  className="mt-1 rounded border-border" />
                <span className="font-body text-sm text-foreground">
                  I have read and agree to the terms of this agreement.
                </span>
              </label>

              <div>
                <label className="font-body text-[11px] uppercase tracking-wider text-muted-foreground">
                  Type your full legal name to sign
                </label>
                <input value={typed} onChange={e => setTyped(e.target.value)}
                  placeholder={accountName || "Your full name"}
                  className="w-full mt-1 border-b-2 border-border bg-transparent py-2 px-1 text-2xl italic focus:outline-none focus:border-sage"
                  style={{ fontFamily: "Cormorant Garamond, serif" }} />
                {accountName && typed && !canSign && agreed && (
                  <p className="font-body text-xs text-amber-700 mt-1 inline-flex items-center gap-1">
                    <AlertTriangle size={12} /> Please type your full legal name as it appears on your account ({accountName}).
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="font-body text-xs text-muted-foreground">Today: {today}</p>
                <button onClick={sign} disabled={!canSign || busy}
                  className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-6 py-3 font-body text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                  <ShieldCheck size={15} /> {busy ? "Recording…" : "Sign Agreement"}
                </button>
              </div>

              <p className="font-body text-[11px] text-muted-foreground">
                By signing you confirm that your typed name is your electronic signature, binding under the federal E-SIGN Act.
                We record the time, IP address, browser, and a hash of this document for legal verification.
              </p>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

function SignedReceipt({ sigs }: { sigs: Signature[] }) {
  if (!sigs.length) return null;
  const s = sigs[sigs.length - 1];
  return (
    <div className="rounded-lg border border-sage/30 bg-sage/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={18} className="text-sage" />
        <p className="font-display text-lg text-foreground">Signed on {new Date(s.signed_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
      <p className="font-body text-sm text-muted-foreground">
        Signed as <span className="italic" style={{ fontFamily: "Cormorant Garamond, serif" }}>{s.typed_name}</span>.
        A copy is saved in your portal for your records.
      </p>
      <button onClick={() => window.print()}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-body text-xs hover:border-sage/40">
        Download / Print
      </button>
    </div>
  );
}
