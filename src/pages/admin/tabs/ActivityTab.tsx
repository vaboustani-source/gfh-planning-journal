import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronRight, User, Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  formatAuditField,
  formatAuditValue,
  TABLE_LABELS,
  HIDDEN_AUDIT_FIELDS,
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
  INSERT: { label: "Created", Icon: Plus, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  UPDATE: { label: "Updated", Icon: Pencil, color: "text-amber-700 bg-amber-50 border-amber-200" },
  DELETE: { label: "Deleted", Icon: Trash2, color: "text-rose-700 bg-rose-50 border-rose-200" },
} as const;

interface Props {
  eventId: string;
}

export default function ActivityTab({ eventId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    supabase
      .from("audit_log")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (data) setEntries(data as unknown as AuditEntry[]);
        setLoading(false);
      });
  }, [eventId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = entries.filter((e) => {
    if (tableFilter !== "all" && e.table_name !== tableFilter) return false;
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-light text-foreground">Activity</h2>
        <p className="font-body text-sm text-muted-foreground mt-1">
          A complete history of every change made to this event — by you and by the couple.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-primary/50"
        >
          <option value="all">All sections</option>
          {Object.entries(TABLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:border-primary/50"
        >
          <option value="all">All actions</option>
          <option value="INSERT">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
        <span className="font-body text-sm text-muted-foreground self-center ml-auto">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
          {entries.length === 500 && " (showing latest 500)"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border">
          <p className="font-display text-lg italic text-muted-foreground">No activity yet</p>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Changes will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const config = ACTION_CONFIG[entry.action];
            const ActionIcon = config.Icon;
            const isOpen = expanded.has(entry.id);
            const isAdmin = entry.user_role === "admin";
            const userLabel = entry.user_email || "System";
            const tableLabel = TABLE_LABELS[entry.table_name] || entry.table_name;

            const visibleFields = (entry.changed_fields || []).filter((f) => !HIDDEN_AUDIT_FIELDS.has(f));

            return (
              <div key={entry.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors text-left"
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
                        {isAdmin ? <Shield size={11} /> : <User size={11} />}
                        {userLabel}
                      </span>
                      <span>·</span>
                      <span title={format(new Date(entry.created_at), "PPpp")}>
                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                      </span>
                    </p>
                  </div>

                  {entry.action === "UPDATE" && visibleFields.length > 0 && (
                    isOpen ? <ChevronDown size={16} className="text-muted-foreground shrink-0 mt-1" />
                           : <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" />
                  )}
                </button>

                {isOpen && entry.action === "UPDATE" && visibleFields.length > 0 && (
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
  );
}
