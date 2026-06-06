import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, AlertCircle, Loader2, CalendarClock } from "lucide-react";
import PortalStickyFooter from "@/components/portal/PortalStickyFooter";
import { format, parseISO, differenceInDays } from "date-fns";
import WireInstructions from "@/components/financials/WireInstructions";

interface Payment {
  id: string;
  label: string;
  track: string;
  amount: number | null;
  due_date: string | null;
  paid: boolean | null;
  paid_date: string | null;
  payment_number: number | null;
}

interface LineItem {
  id: string;
  section: string;
  label: string;
  unit_price: number | null;
  total: number | null;
}

const CATEGORIES = [
  { key: "site_fee", label: "Site Fee & Experiences" },
  { key: "catering", label: "Food & Beverage" },
] as const;

function currency(n: number | null | undefined) {
  if (n == null) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(n));
}

function statusOf(p: Payment): "paid" | "overdue" | "due_soon" | "upcoming" {
  if (p.paid) return "paid";
  if (!p.due_date) return "upcoming";
  const days = differenceInDays(parseISO(p.due_date), new Date());
  if (days < 0) return "overdue";
  if (days <= 14) return "due_soon";
  return "upcoming";
}

export default function Financials() {
  const { eventId, loading: eventLoading } = usePortalData();
  const navigate = useNavigate();
  const [items, setItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      supabase.from("financial_line_items").select("id, section, label, unit_price, total").eq("event_id", eventId).order("section").order("sort_order"),
      supabase.from("payment_schedule").select("*").eq("event_id", eventId).order("payment_number", { ascending: true }),
    ]).then(([{ data: iData }, { data: pData }]) => {
      if (iData) setItems(iData as any);
      if (pData) setPayments(pData as any);
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

  const itemsByCategory = (cat: string) => {
    if (cat === "site_fee") {
      return [
        ...items.filter(i => i.section === "site_fee"),
        ...items.filter(i => i.section === "Décor Rentals"),
      ];
    }
    return items.filter(i => i.section === cat);
  };
  const categoryAmount = (i: LineItem) => i.section === "Décor Rentals" ? Number(i.total ?? 0) : Number(i.unit_price ?? 0);
  const categorySubtotal = (cat: string) => itemsByCategory(cat).reduce((s, i) => s + categoryAmount(i), 0);
  const categoryPaid = (cat: string) => payments.filter(p => p.track === cat && p.paid).reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const grandSubtotal = CATEGORIES.reduce((s, c) => s + categorySubtotal(c.key), 0);
  const grandPaid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const grandRemaining = grandSubtotal - grandPaid;

  const today = new Date().toISOString().split("T")[0];
  const overduePayments = payments.filter(p => statusOf(p) === "overdue");
  const upcoming = payments.filter(p => !p.paid && p.due_date).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const nextPayment = upcoming.find(p => (p.due_date ?? "") >= today) ?? upcoming[0];

  const hasAnyData = items.length > 0 || payments.length > 0;

  return (
    <>
      <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
        <div className="animate-fade-up">
          <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">Your investment</p>
          <h1 className="font-display text-4xl font-light text-foreground mb-8">Financials</h1>

          {!hasAnyData ? (
            <div className="text-center py-16">
              <DollarSign size={28} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-display text-xl italic text-foreground">Financial details coming soon</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Brandon will set up your line items and payment schedule.</p>
            </div>
          ) : (
            <>
              {/* Overdue warning */}
              {overduePayments.length > 0 && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 mb-6 flex items-start gap-3">
                  <AlertCircle size={16} className="text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="font-body text-sm font-medium text-destructive">
                      {overduePayments.length} overdue payment{overduePayments.length > 1 ? "s" : ""}
                    </p>
                    <p className="font-body text-xs text-destructive/80 mt-0.5">Please reach out to Brandon if you have questions.</p>
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
                      {currency(nextPayment.amount)} due {nextPayment.due_date ? format(parseISO(nextPayment.due_date), "MMMM d, yyyy") : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Category cards */}
              <div className="space-y-6 mb-8">
                {CATEGORIES.map(cat => {
                  const lineItems = itemsByCategory(cat.key);
                  const subtotal = categorySubtotal(cat.key);
                  const paid = categoryPaid(cat.key);
                  const catPayments = payments.filter(p => p.track === cat.key)
                    .sort((a, b) => (a.payment_number ?? 99) - (b.payment_number ?? 99) || (a.due_date ?? "").localeCompare(b.due_date ?? ""));
                  if (lineItems.length === 0 && catPayments.length === 0) return null;
                  return (
                    <div key={cat.key} className="rounded-xl bg-card border border-border shadow-soft overflow-hidden">
                      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                        <p className="font-display text-lg font-light text-foreground">{cat.label}</p>
                        <p className="font-body text-sm tabular-nums text-foreground">{currency(subtotal)}</p>
                      </div>

                      {lineItems.length > 0 && (
                        <div className="divide-y divide-border">
                          {lineItems.map(li => (
                            <div key={li.id} className="px-5 py-2.5 flex items-center justify-between">
                              <p className="font-body text-sm text-foreground">{li.label}</p>
                              <p className="font-body text-sm tabular-nums text-foreground">{currency(categoryAmount(li))}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {catPayments.length > 0 && (
                        <>
                          <p className="px-5 pt-3 pb-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground">Payment schedule</p>
                          <div className="divide-y divide-border">
                            {catPayments.map(p => {
                              const s = statusOf(p);
                              const overdue = s === "overdue";
                              return (
                                <div key={p.id} className={`px-5 py-3 flex items-center justify-between ${overdue ? "bg-destructive/5" : ""}`}>
                                  <div>
                                    <p className={`font-body text-sm ${p.paid ? "text-muted-foreground line-through" : overdue ? "text-destructive font-medium" : "text-foreground"}`}>
                                      {p.label}
                                    </p>
                                    {p.due_date && (
                                      <p className={`font-body text-[11px] ${overdue ? "text-destructive/80" : "text-muted-foreground"}`}>
                                        {p.paid ? `Paid ${p.paid_date ? format(parseISO(p.paid_date), "MMM d, yyyy") : ""}` : `Due ${format(parseISO(p.due_date), "MMM d, yyyy")}`}
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
                        </>
                      )}

                      <div className="px-5 py-3 border-t border-border bg-muted/10 grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Subtotal</p>
                          <p className="font-body text-sm font-medium text-foreground tabular-nums">{currency(subtotal)}</p>
                        </div>
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Paid</p>
                          <p className="font-body text-sm font-medium text-primary tabular-nums">{currency(paid)}</p>
                        </div>
                        <div>
                          <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">Remaining</p>
                          <p className="font-body text-sm font-medium text-foreground tabular-nums">{currency(subtotal - paid)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Grand total bar */}
              <div className="rounded-xl bg-forest text-white px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-soft">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Contract Value</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandSubtotal)}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Paid</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandPaid)}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Balance Remaining</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandRemaining)}</p>
                </div>
              </div>
              {/* Grand total bar */}
              <div className="rounded-xl bg-forest text-white px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3 shadow-soft">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Contract Value</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandSubtotal)}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Total Paid</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandPaid)}</p>
                </div>
                <div>
                  <p className="font-body text-[10px] uppercase tracking-widest text-white/70">Balance Remaining</p>
                  <p className="font-display text-2xl font-light tabular-nums">{currency(grandRemaining)}</p>
                </div>
              </div>
            </>
          )}

          <div className="mt-8">
            <WireInstructions />
          </div>
        </div>
      </div>
      <PortalStickyFooter onContinue={() => navigate("/portal/messages")} nextOnly />
    </>
  );
}
