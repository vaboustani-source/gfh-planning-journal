import {
  Home, CalendarHeart, CheckSquare, Users, Music, UtensilsCrossed, DollarSign, MessageCircle, StickyNote,
  Briefcase, Sparkles, FileText, Clock, ClipboardList, MailCheck, Shield, ShieldCheck, Wallet,
  History as HistoryIcon, Compass, Gift, Landmark, Map as MapIcon, BookMarked, Video, Palette, Images, PartyPopper,
} from "lucide-react";
import type { TabKey } from "@/lib/tabAccess";

// Couple portal navigation. Shared by the real portal (PortalLayout) and the admin
// "preview as couple" view (PreviewPortalLayout) so the two can't drift apart.
// `slug` is the path under /portal/ (or /admin/preview/:eventId/).

export type PortalNavItem = {
  slug: string;
  label: string;
  icon: React.ElementType;
  tiers: number[];
  tab: TabKey;
};

export type PortalNavGroup = {
  id: string;
  label: string;
  icon: React.ElementType;
  items: PortalNavItem[];
};

const T = [1, 3, 4];

/** Always visible at the top, outside any group. */
export const PORTAL_TOP_ITEMS: PortalNavItem[] = [
  { slug: "start",    label: "Start Here", icon: Compass,       tiers: T,            tab: "overview" },
  { slug: "today",    label: "Home",       icon: Home,          tiers: [1, 2, 3, 4], tab: "overview" },
  { slug: "messages", label: "Messages",   icon: MessageCircle, tiers: [1, 2, 3, 4], tab: "messages" },
];

export const PORTAL_NAV_GROUPS: PortalNavGroup[] = [
  {
    id: "planning", label: "Planning", icon: CheckSquare,
    items: [
      { slug: "planning", label: "Checklist",      icon: CheckSquare,   tiers: T, tab: "overview" },
      { slug: "calls",    label: "Planning Calls", icon: Video,         tiers: T, tab: "overview" },
      { slug: "timeline", label: "Timeline",       icon: Clock,         tiers: T, tab: "timeline" },
      { slug: "forms",    label: "Forms",          icon: ClipboardList, tiers: T, tab: "forms" },
      { slug: "notes",    label: "Notes",          icon: StickyNote,    tiers: T, tab: "notes" },
      { slug: "history",  label: "History",        icon: HistoryIcon,   tiers: T, tab: "overview" },
    ],
  },
  {
    id: "weekend", label: "Our Weekend", icon: CalendarHeart,
    items: [
      { slug: "our-wedding", label: "Overview", icon: CalendarHeart,   tiers: T, tab: "overview" },
      { slug: "ceremony",    label: "Ceremony & Music", icon: Music,           tiers: T, tab: "ceremony" },
      { slug: "menus-meals", label: "Menus & Meals",    icon: UtensilsCrossed, tiers: T, tab: "menus" },
      { slug: "experiences", label: "Experiences",      icon: PartyPopper,     tiers: T, tab: "experiences" },
    ],
  },
  {
    id: "style", label: "Style & Décor", icon: Palette,
    items: [
      { slug: "mood-board", label: "Mood Board", icon: Images,   tiers: T, tab: "moodboard" },
      { slug: "decor",      label: "Décor",      icon: Sparkles, tiers: T, tab: "ceremony" },
    ],
  },
  {
    id: "guests", label: "Guests", icon: Users,
    items: [
      { slug: "our-people", label: "Our People", icon: Users,     tiers: T, tab: "lodging" },
      { slug: "rsvp",       label: "RSVP",       icon: MailCheck, tiers: T, tab: "rsvp" },
    ],
  },
  {
    id: "vendors", label: "Vendors & Docs", icon: Briefcase,
    items: [
      { slug: "vendors",   label: "Vendors",    icon: Briefcase,   tiers: T, tab: "vendors" },
      { slug: "documents", label: "Documents",  icon: FileText,    tiers: T, tab: "documents" },
      { slug: "contracts", label: "Agreements", icon: ShieldCheck, tiers: T, tab: "documents" },
    ],
  },
  {
    id: "money", label: "Money", icon: Wallet,
    items: [
      { slug: "financials", label: "Financials", icon: DollarSign, tiers: T, tab: "financials" },
      { slug: "budget",     label: "Budget",              icon: Wallet,     tiers: T, tab: "overview" },
    ],
  },
  {
    id: "resources", label: "Helpful resources", icon: BookMarked,
    items: [
      { slug: "tipping",          label: "Tipping Guide",         icon: Gift,     tiers: T, tab: "overview" },
      { slug: "insurance",        label: "Wedding Insurance",     icon: Shield,   tiers: T, tab: "overview" },
      { slug: "marriage-license", label: "Marriage License",      icon: Landmark, tiers: T, tab: "overview" },
      { slug: "floor-layouts",    label: "Floor Layouts & Tents", icon: MapIcon,  tiers: T, tab: "overview" },
    ],
  },
];

/** Shortcuts in the phone bottom bar (the rest live in the menu drawer). */
export const PORTAL_MOBILE_SLUGS = ["today", "planning", "mood-board", "messages"];

export const ALL_PORTAL_ITEMS: PortalNavItem[] = [
  ...PORTAL_TOP_ITEMS,
  ...PORTAL_NAV_GROUPS.flatMap(g => g.items),
];
