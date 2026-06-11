import { useEffect, useMemo, useState } from "react";
import { usePortalData } from "@/hooks/usePortalData";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronRight, User, Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  formatAuditField,
  formatAuditValue,
  TABLE_LABELS,
  HIDDEN_AUDIT_FIELDS,
  COUPLE_ALLOWED_TABLES,
  hasFriendlyAuditField,
} from "@/lib/auditLabels";

interface AuditEntry {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[] | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  created_at: string;
}

const ACTION_CONFIG = {
  INSERT: { label: "Added", Icon: Plus, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  UPDATE: { label: "Updated", Icon: Pencil, color: "text-amber-700 bg-amber-50 border-amber-200" },
  DELETE: { label: "Removed", Icon: Trash2, color: "text-rose-700 bg-rose-50 border-rose-200" },
} as const;

/**
 * Apply the couple-safe filter to a raw audit entry.
 * Returns null if the entry should be hidden entirely.
 * Otherwise returns the entry plus the trimmed list of visible field names.
 */
function applyCoupleFilter(entry: AuditEntry): { entry: AuditEntry; visibleFields: string[] } | null {
  // 1. Allowlist by table
  if (!COUPLE_ALLOWED_TABLES.has(entry.table_name)) return null;

  // 2. Trim fields to those with a friendly label (fail toward hiding).
  //    Skip universal HIDDEN_AUDIT_FIELDS as well.
  const raw = entry.changed_fields ?? [];
  const visible = raw.filter(
    (f) => !HIDDEN_AUDIT_FIELDS.has(f) && hasFriendlyAuditField(entry.table_name, f),
  );

  // 3. For UPDATEs with nothing left to show, drop the entry.
  if (entry.action === "UPDATE" && visible.length === 0) return null;

  return { entry, visibleFields: visible };
}

export default function PortalHistory() {
  const { eventId } = usePortalData();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    supabase
      .from("audit_log")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (data) setEntries(data as unknown as AuditEntry[]);
        setLoading(false);
      });
  }, [eventId]);

  // Couple-safe filtered list: each item has the trimmed visibleFields baked in.
  const safeEntries = useMemo(
    () =>
      entries
        .map(applyCoupleFilter)
        .filter((x): x is { entry: AuditEntry; visibleFields: string[] } => x !== null),
    [entries],
  );

  // Tables present after the couple-safe filter, for the dropdown.
  const visibleTables = useMemo(() => {
    const set = new Set<string>();
    for (const s of safeEntries) set.add(s.entry.table_name);
    return Array.from(set).sort((a, b) =>
      (TABLE_LABELS[a] || a).localeCompare(TABLE_LABELS[b] || b),
    );
  }, [safeEntries]);

  const filtered = safeEntries.filter(({ entry }) => {
    if (tableFilter !== "all" && entry.table_name !== tableFilter) return false;
    if (actionFilter !== "all" && entry.action !== actionFilter) return false;
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        <p className="font-body text-xs tracking-widest uppercase text-muted-foreground mb-2">
          Your planning journal
        </p>
        <h1 className="font-display text-4xl font-light text-foreground mb-2">History</h1>
        <p className="font-body text-sm text-muted-foreground mb-8">
          A gentle record of changes made to your planning details over time, so you can always see what shifted and when.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-sage/50"
          >
            <option value="all">All sections</option>
            {visibleTables.map((t) => (
              <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-border bg-white px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-sage/50"
          >
            <option value="all">All actions</option>
            <option value="INSERT">Added</option>
            <option value="UPDATE">Updated</option>
            <option value="DELETE">Removed</option>
          </select>
          <span className="font-body text-sm text-muted-foreground self-center ml-auto">
            {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-border bg-white">
            <p className="font-display text-lg italic text-muted-foreground">No changes yet</p>
            <p className="font-body text-sm text-muted-foreground mt-1">
              As planning details are updated, they will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(({ entry, visibleFields }) => {
              const config = ACTION_CONFIG[entry.action];
              const ActionIcon = config.Icon;
              const isOpen = expanded.has(entry.id);
              const isStaff = !!entry.user_role && entry.user_role !== "couple" && entry.user_role !== "participant";
              const isSelf = entry.user_id === currentUserId;
              const userLabel = isSelf ? "You" : isStaff ? "Gilbertsville Farmhouse team" : (entry.user_email || "Unknown");
              const tableLabel = TABLE_LABELS[entry.table_name] || entry.table_name;
              const canExpand = entry.action === "UPDATE" && visibleFields.length > 0;

              return (
                <div key={entry.id} className="rounded-xl border border-border bg-white overflow-hidden">
                  <button
                    onClick={() => canExpand && toggleExpand(entry.id)}
                    className={`w-full px-4 py-3 flex items-start gap-3 transition-colors text-left ${canExpand ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}
                  >
                    <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[11px] font-medium ${config.color}`}>
                      <ActionIcon size={11} />
                      {config.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-foreground">
                        <span className="font-medium">{tableLabel}</span>
                        {entry.action === "UPDATE" && visibleFields.length > 0 && (
                          <span className="text-muted-foreground">
                            {" — "}
                            {visibleFields.slice(0, 3).map((f) => formatAuditField(entry.table_name, f)).join(", ")}
                            {visibleFields.length > 3 && ` +${visibleFields.length - 3} more`}
                          </span>
                        )}
                      </p>
                      <p className="font-body text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          {isSelf ? <User size={11} /> : isStaff ? <Shield size={11} /> : <User size={11} />}
                          {userLabel}
                        </span>
                        <span>·</span>
                        <span title={format(new Date(entry.created_at), "PPpp")}>
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </p>
                    </div>

                    {canExpand && (
                      isOpen ? <ChevronDown size={16} className="text-muted-foreground shrink-0 mt-1" />
                             : <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                    )}
                  </button>

                  {isOpen && canExpand && (
                    <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                      {visibleFields.map((field) => {
                        const oldVal = formatAuditValue(entry.table_name, field, entry.old_values?.[field]);
                        const newVal = formatAuditValue(entry.table_name, field, entry.new_values?.[field]);
                        return (
                          <div key={field} className="grid grid-cols-[160px_1fr] gap-3 font-body text-xs">
                            <span className="text-muted-foreground">{formatAuditField(entry.table_name, field)}</span>
                            <div className="space-y-0.5">
                              <div className="text-rose-700 line-through truncate" title={oldVal}>{oldVal}</div>
                              <div className="text-emerald-700 truncate" title={newVal}>{newVal}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
