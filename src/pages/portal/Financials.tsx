import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, AlertCircle, Loader2, CalendarClock } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";

interface Financial {
  site_fee_total: number | null;
  site_fee_paid: number | null;
  catering_estimate: number | null;
  catering_paid: number | null;
}

interface Payment {
  id: string;
  label: string;
  track: string;
  amount: number | null;
  due_date: string | null;
  paid: boolean | null;
  paid_date: string | null;
  method: string | null;
}

function currency(n: number | null) {
  if (n == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);
}

export default function Financials() {
  const { eventId, loading: eventLoading } = usePortalData();
  const navigate = useNavigate();
  const [fin, setFin] = useState<Financial | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [decorTotal, setDecorTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      supabase.from("financials").select("site_fee_total, site_fee_paid, catering_estimate, catering_paid").eq("event_id", eventId).maybeSingle(),
      supabase.from("payment_schedule").select("*").eq("event_id", eventId).order("due_date", { ascending: true }),
      supabase.from("financial_line_items").select("total").eq("event_id", eventId).eq("section", "Décor Rentals"),
    ]).then(([{ data: fData }, { data: pData }, { data: dData }]) => {
      if (fData) setFin(fData);
      if (pData) setPayments(pData);
      if (dData) setDecorTotal((dData as any[]).reduce((s, x) => s + Number(x.total ?? 0), 0));
      setLoading(false);
    });
  }, [eventId]);

  if (loading || eventLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalDue = (fin?.site_fee_total ?? 0) + (fin?.catering_estimate ?? 0);
  const totalPaid = (fin?.site_fee_paid ?? 0) + (fin?.catering_paid ?? 0);
  const remaining = totalDue - totalPaid;
  const today = new Date().toISOString().split("T")[0];
  const nextPayment = payments.find(p => !p.paid && p.due_date && p.due_date >= today);
  const overduePayments = payments.filter(p => !p.paid && p.due_date && p.due_date < today);

  return (
    <>
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Your investment
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-8">Financials</h1>

        {!fin ? (
          <div className="text-center py-16">
            <DollarSign size={28} className="text-muted-foreground mx-auto mb-3" />
            <p className="font-display text-xl italic text-foreground">Financial details coming soon</p>
            <p className="font-body text-sm text-muted-foreground mt-1">Brandon will set up your payment schedule.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="rounded-xl bg-card border border-border p-4 shadow-soft">
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Total</p>
                <p className="font-display text-2xl font-light text-foreground">{currency(totalDue)}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 shadow-soft">
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Paid</p>
                <p className="font-display text-2xl font-light text-primary">{currency(totalPaid)}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 shadow-soft">
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Remaining</p>
                <p className="font-display text-2xl font-light text-foreground">{currency(remaining)}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-4 shadow-soft">
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Site Fee</p>
                <p className="font-display text-2xl font-light text-foreground">{currency(fin.site_fee_total)}</p>
              </div>
            </div>

            {/* Décor Rentals */}
            {decorTotal > 0 && (
              <div className="rounded-xl bg-card border border-border p-4 shadow-soft mb-6 flex items-center justify-between">
                <div>
                  <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-1">Décor Rentals</p>
                  <p className="font-body text-xs text-muted-foreground">From your selections on the Décor page</p>
                </div>
                <p className="font-display text-2xl font-light text-foreground tabular-nums">{currency(decorTotal)}</p>
              </div>
            )}

            {/* Overdue warning */}
            {overduePayments.length > 0 && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 mb-6 flex items-start gap-3">
                <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-body text-sm font-medium text-destructive">
                    {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}
                  </p>
                  <p className="font-body text-xs text-destructive/80 mt-0.5">
                    Please reach out to Brandon if you have questions.
                  </p>
                </div>
              </div>
            )}

            {/* Next upcoming */}
            {nextPayment && (
              <div className="rounded-xl bg-sage/8 border border-sage/20 p-4 mb-6 flex items-start gap-3">
                <CalendarClock size={16} className="text-sage mt-0.5 shrink-0" />
                <div>
                  <p className="font-body text-sm font-medium text-foreground">Next payment: {nextPayment.label}</p>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">
                    {currency(nextPayment.amount)} due {new Date(nextPayment.due_date!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}

            {/* Payment schedule */}
            {payments.length > 0 && (
              <div>
                <p className="font-body text-[10px] tracking-widest uppercase text-muted-foreground mb-3">Payment schedule</p>
                <div className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                  {payments.map((p, i) => {
                    const overdue = !p.paid && p.due_date && p.due_date < today;
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between px-5 py-3.5 ${i < payments.length - 1 ? "border-b border-border" : ""} ${overdue ? "bg-destructive/5" : ""}`}
                      >
                        <div>
                          <p className={`font-body text-sm ${p.paid ? "text-muted-foreground line-through" : overdue ? "text-destructive font-medium" : "text-foreground"}`}>
                            {p.label}
                          </p>
                          {p.due_date && (
                            <p className={`font-body text-[11px] ${overdue ? "text-destructive/70" : "text-muted-foreground"}`}>
                              {p.paid ? `Paid ${p.paid_date ? new Date(p.paid_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}` : `Due ${new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                            </p>
                          )}
                        </div>
                        <p className={`font-body text-sm tabular-nums ${p.paid ? "text-primary" : overdue ? "text-destructive font-medium" : "text-foreground"}`}>
                          {currency(p.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
    <PortalStickyFooter onContinue={() => navigate("/portal/messages")} nextOnly />
    </>
  );
}
