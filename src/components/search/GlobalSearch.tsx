import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isValid } from "date-fns";
import {
  Search, Home, CalendarHeart, CheckSquare, Users, Music, UtensilsCrossed,
  DollarSign, MessageCircle, StickyNote, Briefcase, Sparkles, FileText, Clock,
  ClipboardList, MailCheck, ShieldCheck, Inbox, LayoutGrid, BookOpen, Wand2,
  Settings, Calendar, MapPin,
} from "lucide-react";

type Scope = "couple" | "admin-dashboard" | "admin-event";

interface Props {
  scope: Scope;
  eventId?: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type NavDest = { label: string; to: string; icon: any; synonyms: string };

/* ────────────────────── Nav indexes ────────────────────── */
const COUPLE_NAV: NavDest[] = [
  { label: "Home",             to: "/portal/today",        icon: Home,             synonyms: "today dashboard overview" },
  { label: "Our Wedding",      to: "/portal/our-wedding",  icon: CalendarHeart,    synonyms: "wedding details event" },
  { label: "Timeline",         to: "/portal/timeline",     icon: Clock,            synonyms: "schedule run of show" },
  { label: "Planning",         to: "/portal/planning",     icon: CheckSquare,      synonyms: "checklist tasks todo to-do" },
  { label: "Vendors",          to: "/portal/vendors",      icon: Briefcase,        synonyms: "photographer florist dj band team" },
  { label: "Ceremony & Music", to: "/portal/ceremony",     icon: Music,            synonyms: "ceremony music song processional vows" },
  { label: "Décor",            to: "/portal/decor",        icon: Sparkles,         synonyms: "decor rental flowers styling" },
  { label: "Experiences",      to: "/portal/experiences",  icon: Sparkles,         synonyms: "goat yoga fireworks activities add-ons" },
  { label: "Menus & Meals",    to: "/portal/menus-meals",  icon: UtensilsCrossed,  synonyms: "menu food bar drinks dinner brunch" },
  { label: "Our People",       to: "/portal/our-people",   icon: Users,            synonyms: "guest list rsvp people lodging room" },
  { label: "Lodging",          to: "/portal/our-people",   icon: Users,            synonyms: "room hotel sleeping accommodations" },
  { label: "Seating",          to: "/portal/seating",      icon: Users,            synonyms: "seat table assignment" },
  { label: "RSVP",             to: "/portal/rsvp",         icon: MailCheck,        synonyms: "rsvp invitation reply" },
  { label: "Financials",       to: "/portal/financials",   icon: DollarSign,       synonyms: "payment balance cost invoice money" },
  { label: "Messages",         to: "/portal/messages",     icon: MessageCircle,    synonyms: "message chat brandon coordinator" },
  { label: "Notes",            to: "/portal/notes",        icon: StickyNote,       synonyms: "note journal" },
  { label: "Forms",            to: "/portal/forms",        icon: ClipboardList,    synonyms: "form questionnaire" },
  { label: "Documents",        to: "/portal/documents",    icon: FileText,         synonyms: "document file upload" },
  { label: "Agreements",       to: "/portal/contracts",    icon: ShieldCheck,      synonyms: "contract agreement signature" },
];

const ADMIN_NAV: NavDest[] = [
  { label: "Dashboard",          to: "/admin",                          icon: Home,         synonyms: "dashboard home season events" },
  { label: "Inbox",              to: "/admin/inbox",                    icon: Inbox,        synonyms: "inbox gmail email" },
  { label: "All Messages",       to: "/admin/messages",                 icon: MessageCircle,synonyms: "messages chat" },
  { label: "Preferred Vendors",  to: "/admin/preferred-vendors",        icon: Briefcase,    synonyms: "preferred vendors network" },
  { label: "Experiences Catalog",to: "/admin/experiences",              icon: Sparkles,     synonyms: "experiences catalog" },
  { label: "Décor Catalog",      to: "/admin/decor",                    icon: Wand2,        synonyms: "decor catalog rentals" },
  { label: "Layout Library",     to: "/admin/layouts",                  icon: LayoutGrid,   synonyms: "layout library floor plan" },
  { label: "Resources",          to: "/admin/resources",                icon: BookOpen,     synonyms: "resources guides docs" },
  { label: "Forms",              to: "/admin/forms",                    icon: ClipboardList,synonyms: "forms templates" },
  { label: "Settings",           to: "/admin/settings",                 icon: Settings,     synonyms: "settings integrations" },
];

const EVENT_TABS: { id: string; label: string; icon: any; synonyms: string }[] = [
  { id: "overview",    label: "Overview",         icon: Home,             synonyms: "overview details" },
  { id: "milestones",  label: "Milestones",       icon: CalendarHeart,    synonyms: "milestones journey" },
  { id: "activity",    label: "Activity",         icon: Clock,            synonyms: "activity log audit" },
  { id: "our-people",  label: "Our People",       icon: Users,            synonyms: "guests lodging people rooms" },
  { id: "rsvp",        label: "RSVP",             icon: MailCheck,        synonyms: "rsvp" },
  { id: "checklist",   label: "Checklist",        icon: CheckSquare,      synonyms: "checklist tasks" },
  { id: "forms",       label: "Forms",            icon: ClipboardList,    synonyms: "forms" },
  { id: "documents",   label: "Documents",        icon: FileText,         synonyms: "documents files" },
  { id: "contracts",   label: "Contracts",        icon: ShieldCheck,      synonyms: "contracts agreements" },
  { id: "vendors",     label: "Vendors",          icon: Briefcase,        synonyms: "vendors photographer florist" },
  { id: "experiences", label: "Experiences",      icon: Sparkles,         synonyms: "experiences activities" },
  { id: "decor",       label: "Décor",            icon: Sparkles,         synonyms: "decor rentals" },
  { id: "ceremony",    label: "Ceremony & Music", icon: Music,            synonyms: "ceremony music song" },
  { id: "timeline",    label: "Timeline",         icon: Clock,            synonyms: "timeline schedule" },
  { id: "menus-bar",   label: "Menus & Bar",      icon: UtensilsCrossed,  synonyms: "menu food bar" },
  { id: "dietary",     label: "Dietary & Kids",   icon: UtensilsCrossed,  synonyms: "dietary allergy kids" },
  { id: "financials",  label: "Financials",       icon: DollarSign,       synonyms: "financials payments" },
  { id: "messages",    label: "Messages",         icon: MessageCircle,    synonyms: "messages" },
  { id: "emails",      label: "Emails",           icon: MailCheck,        synonyms: "emails gmail" },
  { id: "notes",       label: "Notes",            icon: StickyNote,       synonyms: "notes" },
];

const fmtDate = (d: string | null) => {
  if (!d) return "Date TBD";
  const p = parseISO(d);
  return isValid(p) ? format(p, "MMM d, yyyy") : "Date TBD";
};

/* ────────────────────── Component ────────────────────── */
export default function GlobalSearch({ scope, eventId, open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [adminMode, setAdminMode] = useState<"event" | "all">(scope === "admin-event" ? "event" : "all");

  // Reset adminMode when scope changes
  useEffect(() => {
    setAdminMode(scope === "admin-event" ? "event" : "all");
  }, [scope, open]);

  // Data buckets
  const [guests, setGuests] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [decor, setDecor] = useState<any[]>([]);
  const [timelineBlocks, setTimelineBlocks] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Determine which event to scope content queries to
  const contentEventId = useMemo(() => {
    if (scope === "couple") return eventId ?? null;
    if (scope === "admin-event" && adminMode === "event") return eventId ?? null;
    return null;
  }, [scope, eventId, adminMode]);

  // Fetch content
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (contentEventId) {
        const [g, v, ex, dc, tl] = await Promise.all([
          supabase.from("guests").select("id, first_name, last_name").eq("event_id", contentEventId).limit(200),
          supabase.from("vendors").select("id, name, role").eq("event_id", contentEventId).limit(200),
          supabase.from("experience_requests").select("id, title").eq("event_id", contentEventId).limit(100),
          supabase.from("decor_selections").select("id, item_name").eq("event_id", contentEventId).limit(100),
          supabase.from("working_timeline").select("id, title").eq("event_id", contentEventId).limit(100),
        ]);
        if (cancelled) return;
        setGuests(g.data ?? []);
        setVendors(v.data ?? []);
        setExperiences(ex.data ?? []);
        setDecor(dc.data ?? []);
        setTimelineBlocks(tl.data ?? []);
        if (scope !== "couple") setEvents([]);
      }
      // Admin all-events search
      if (scope !== "couple" && (scope === "admin-dashboard" || adminMode === "all")) {
        const { data: evs } = await supabase
          .from("events")
          .select("id, title, wedding_date, arrival_date, couples(partner1_first_name, partner1_last_name, partner2_first_name, partner2_last_name)")
          .order("wedding_date", { ascending: false })
          .limit(500);
        if (cancelled) return;
        const mapped = (evs ?? []).map((e: any) => {
          const c = Array.isArray(e.couples) ? e.couples[0] : e.couples;
          const p1 = [c?.partner1_first_name, c?.partner1_last_name].filter(Boolean).join(" ");
          const p2 = [c?.partner2_first_name, c?.partner2_last_name].filter(Boolean).join(" ");
          const coupleNames = [p1, p2].filter(Boolean).join(" & ") || e.title;
          return { id: e.id, title: e.title, wedding_date: e.wedding_date, arrival_date: e.arrival_date, coupleNames };
        });
        setEvents(mapped);

        const [allGuests, allVendors] = await Promise.all([
          supabase.from("guests").select("id, first_name, last_name, event_id").limit(2000),
          supabase.from("vendors").select("id, name, role, event_id").limit(2000),
        ]);
        if (cancelled) return;
        setGuests(allGuests.data ?? []);
        setVendors(allVendors.data ?? []);
        setExperiences([]); setDecor([]); setTimelineBlocks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, scope, contentEventId, adminMode]);

  const eventTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    events.forEach(e => { m[e.id] = e.coupleNames; });
    return m;
  }, [events]);

  const go = useCallback((to: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(to);
  }, [navigate, onOpenChange]);

  // Decide nav list
  const navList: NavDest[] = scope === "couple"
    ? COUPLE_NAV
    : (scope === "admin-event" && adminMode === "event"
        ? EVENT_TABS.map(t => ({
            label: t.label, icon: t.icon, synonyms: t.synonyms,
            to: `/admin/event/${eventId}?tab=${t.id}`,
          }))
        : ADMIN_NAV);

  const placeholder = scope === "couple"
    ? "Search your wedding…"
    : scope === "admin-event" && adminMode === "event"
      ? "Search this wedding…"
      : "Search weddings, guests, vendors…";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
      {scope === "admin-event" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <button
            onClick={() => setAdminMode("event")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-body transition-colors ${
              adminMode === "event" ? "bg-sage/20 text-sage-dark" : "text-muted-foreground hover:text-foreground"
            }`}
          >This wedding</button>
          <button
            onClick={() => setAdminMode("all")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-body transition-colors ${
              adminMode === "all" ? "bg-sage/20 text-sage-dark" : "text-muted-foreground hover:text-foreground"
            }`}
          >All weddings</button>
        </div>
      )}
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          <div className="py-6 text-center">
            <p className="font-body text-sm text-foreground">Nothing found{query ? ` for "${query}"` : ""}.</p>
            <p className="font-body text-xs text-muted-foreground mt-1">Try a name or a section.</p>
          </div>
        </CommandEmpty>

        {/* Jump to (navigation) */}
        <CommandGroup heading="Jump to">
          {navList.slice(0, 30).map((n) => {
            const Icon = n.icon;
            return (
              <CommandItem
                key={n.to + n.label}
                value={`${n.label} ${n.synonyms}`}
                onSelect={() => go(n.to)}
              >
                <Icon size={14} className="mr-2 text-sage shrink-0" />
                <span>{n.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Admin: Events */}
        {scope !== "couple" && (scope === "admin-dashboard" || adminMode === "all") && events.length > 0 && (
          <CommandGroup heading="Weddings">
            {events.slice(0, 8).map((e) => (
              <CommandItem
                key={e.id}
                value={`${e.coupleNames} ${e.title}`}
                onSelect={() => go(`/admin/event/${e.id}`)}
              >
                <CalendarHeart size={14} className="mr-2 text-sage shrink-0" />
                <span className="flex-1 truncate">{e.coupleNames}</span>
                <span className="ml-2 text-[10px] text-muted-foreground shrink-0">
                  {fmtDate(e.wedding_date ?? e.arrival_date)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Guests */}
        {guests.length > 0 && (
          <CommandGroup heading="Guests">
            {guests.slice(0, 8).map((g) => {
              const name = [g.first_name, g.last_name].filter(Boolean).join(" ") || "Unnamed guest";
              const evCtx = scope !== "couple" && adminMode === "all" && g.event_id
                ? eventTitleMap[g.event_id] : null;
              const to = scope === "couple"
                ? "/portal/our-people"
                : `/admin/event/${g.event_id ?? eventId}?tab=our-people`;
              return (
                <CommandItem key={g.id} value={`guest ${name} ${evCtx ?? ""}`} onSelect={() => go(to)}>
                  <Users size={14} className="mr-2 text-sage shrink-0" />
                  <span className="flex-1 truncate">{name}</span>
                  {evCtx && <span className="ml-2 text-[10px] text-muted-foreground shrink-0">{evCtx}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Vendors */}
        {vendors.length > 0 && (
          <CommandGroup heading="Vendors">
            {vendors.slice(0, 8).map((v) => {
              const evCtx = scope !== "couple" && adminMode === "all" && v.event_id
                ? eventTitleMap[v.event_id] : null;
              const to = scope === "couple"
                ? "/portal/vendors"
                : `/admin/event/${v.event_id ?? eventId}?tab=vendors`;
              return (
                <CommandItem key={v.id} value={`vendor ${v.name} ${v.role ?? ""} ${evCtx ?? ""}`} onSelect={() => go(to)}>
                  <Briefcase size={14} className="mr-2 text-sage shrink-0" />
                  <span className="flex-1 truncate">{v.name}</span>
                  {v.role && <span className="ml-2 text-[10px] text-muted-foreground shrink-0">{v.role}</span>}
                  {evCtx && <span className="ml-2 text-[10px] text-muted-foreground shrink-0">· {evCtx}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Experiences (event-scoped only) */}
        {experiences.length > 0 && (
          <CommandGroup heading="Experiences">
            {experiences.slice(0, 6).map((x) => {
              const to = scope === "couple"
                ? "/portal/experiences"
                : `/admin/event/${eventId}?tab=experiences`;
              return (
                <CommandItem key={x.id} value={`experience ${x.title}`} onSelect={() => go(to)}>
                  <Sparkles size={14} className="mr-2 text-sage shrink-0" />
                  <span className="flex-1 truncate">{x.title || "Experience"}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Decor */}
        {decor.length > 0 && (
          <CommandGroup heading="Décor">
            {decor.slice(0, 6).map((d) => {
              const to = scope === "couple"
                ? "/portal/decor"
                : `/admin/event/${eventId}?tab=decor`;
              return (
                <CommandItem key={d.id} value={`decor ${d.item_name ?? ""}`} onSelect={() => go(to)}>
                  <Wand2 size={14} className="mr-2 text-sage shrink-0" />
                  <span className="flex-1 truncate">{d.item_name || "Décor item"}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* Timeline blocks */}
        {timelineBlocks.length > 0 && (
          <CommandGroup heading="Timeline">
            {timelineBlocks.slice(0, 6).map((t) => {
              const to = scope === "couple"
                ? "/portal/timeline"
                : `/admin/event/${eventId}?tab=timeline`;
              return (
                <CommandItem key={t.id} value={`timeline ${t.title ?? ""}`} onSelect={() => go(to)}>
                  <Clock size={14} className="mr-2 text-sage shrink-0" />
                  <span className="flex-1 truncate">{t.title || "Timeline block"}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/* ────────────────────── Trigger button ────────────────────── */
export function GlobalSearchTrigger({
  scope, eventId, variant = "bar",
}: {
  scope: Scope;
  eventId?: string | null;
  variant?: "bar" | "icon";
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {variant === "bar" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 h-9 min-w-[180px] rounded-full border border-border bg-background/60 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open search"
        >
          <Search size={14} />
          <span className="font-body text-xs">Search…</span>
          <span className="ml-auto font-body text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground/70">⌘K</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open search"
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search size={18} />
        </button>
      )}
      <GlobalSearch scope={scope} eventId={eventId} open={open} onOpenChange={setOpen} />
    </>
  );
}
