import { Link } from "react-router-dom";
import {
  Compass,
  Clock,
  UtensilsCrossed,
  Users,
  DollarSign,
  MessageCircle,
  CalendarHeart,
  CheckSquare,
  Music,
  Sparkles,
  MailCheck,
  Wallet,
  ClipboardList,
  FileText,
  ShieldCheck,
  StickyNote,
  ArrowRight,
} from "lucide-react";
import { RSVP_ENABLED } from "@/lib/featureFlags";

/* ── Welcome video URL ─────────────────────────
   Paste a Loom or YouTube embed URL below to show a welcome video.
   Leave it as an empty string to hide the video block entirely.
   ──────────────────────────────────────────── */
const WELCOME_VIDEO_URL = "";

/* ── Types ──────────────────────────────────── */

interface ProminentCard {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

interface CompactLink {
  to: string;
  label: string;
  description: string;
}

interface StepLink {
  to: string;
  label: string;
}

/* ── Data ───────────────────────────────────── */

const PROMINENT_CARDS: ProminentCard[] = [
  {
    to: "/portal/timeline",
    label: "Timeline",
    description: "The shape of your weekend, hour by hour. We build it with you.",
    icon: Clock,
  },
  {
    to: "/portal/menus-meals",
    label: "Menus & Meals",
    description: "Choose your food and drink, share dietary needs, set headcounts.",
    icon: UtensilsCrossed,
  },
  {
    to: "/portal/our-people",
    label: "Our People",
    description: "Your guest list and who is staying on the estate.",
    icon: Users,
  },
  {
    to: "/portal/financials",
    label: "Financials",
    description: "Your payment schedule and what is due when.",
    icon: DollarSign,
  },
  {
    to: "/portal/messages",
    label: "Messages",
    description: "Talk to Brandon and the team anytime. The fastest way to reach us.",
    icon: MessageCircle,
  },
];

const COMPACT_LINKS: CompactLink[] = [
  { to: "/portal/our-wedding", label: "Our Wedding", description: "the big-picture view of your day." },
  { to: "/portal/planning", label: "Planning", description: "your running checklist." },
  { to: "/portal/ceremony", label: "Ceremony & Music", description: "ceremony details and music." },
  { to: "/portal/decor", label: "Decor", description: "the look and feel of your spaces." },
  { to: "/portal/experiences", label: "Experiences", description: "extras you can add to the weekend." },
  ...(RSVP_ENABLED ? [{ to: "/portal/rsvp", label: "RSVP", description: "collect replies from your guests." }] : []),
  { to: "/portal/budget", label: "Budget", description: "track your own spending alongside our costs." },
  { to: "/portal/forms", label: "Forms", description: "anything we need you to fill out." },
  { to: "/portal/documents", label: "Documents", description: "shared files and resources." },
  { to: "/portal/contracts", label: "Agreements", description: "your signed agreements." },
  { to: "/portal/insurance", label: "Wedding Insurance", description: "recommended in your contract, with two ways to buy." },
  { to: "/portal/notes", label: "Notes", description: "a place for your own notes." },
];

const FIRST_STEPS: StepLink[] = [
  { to: "/portal/messages", label: "Say hello in Messages so we have a thread going." },
  { to: "/portal/timeline", label: "Peek at your Timeline to see the shape of the weekend." },
  { to: "/portal/our-people", label: "Start your guest list in Our People whenever you're ready." },
  { to: "/portal/financials", label: "Look over your payment schedule in Financials." },
];

/* ── Sub-components ─────────────────────────── */

function ProminentCardItem({ to, label, description, icon: Icon }: ProminentCard) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-xl bg-card border border-border p-5 hover:border-sage/40 hover:shadow-card transition-all duration-200"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-sage/10 border border-sage/20 flex items-center justify-center mt-0.5">
        <Icon size={18} className="text-sage" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-light text-foreground">{label}</h3>
          <ArrowRight
            size={14}
            className="text-muted-foreground group-hover:text-sage group-hover:translate-x-0.5 transition-all shrink-0"
          />
        </div>
        <p className="font-body text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

function CompactLinkItem({ to, label, description }: CompactLink) {
  return (
    <Link
      to={to}
      className="group flex items-baseline gap-2 py-1.5 font-body text-sm text-foreground hover:text-sage transition-colors"
    >
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-sm">{description}</span>
      <ArrowRight
        size={12}
        className="text-muted-foreground group-hover:text-sage group-hover:translate-x-0.5 transition-all shrink-0 self-center"
      />
    </Link>
  );
}

function StepItem({ to, label }: StepLink) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-3 py-1.5 font-body text-sm text-foreground hover:text-sage transition-colors"
    >
      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sage/60 shrink-0" />
      <span className="leading-relaxed">{label}</span>
    </Link>
  );
}

/* ── Main component ─────────────────────────── */

export default function StartHere() {
  return (
    <div className="max-w-5xl mx-auto px-5 py-8 lg:px-8 lg:py-10 pb-32">
      <div className="animate-fade-up">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Compass size={16} className="text-sage" strokeWidth={1.75} />
            <p className="font-body text-xs tracking-widest uppercase text-muted-foreground">
              Getting oriented
            </p>
          </div>
          <h1 className="font-display text-4xl font-light text-foreground mb-4">Welcome</h1>
          <p className="font-body text-base text-muted-foreground leading-relaxed max-w-2xl">
            This is your private planning space for your wedding at Gilbertsville Farmhouse.
            Everything for the weekend lives in one place, and you can move through it at your own pace.
          </p>
        </div>

        {/* Optional welcome video */}
        {WELCOME_VIDEO_URL && (
          <section className="mb-12">
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={WELCOME_VIDEO_URL}
                title="Welcome video"
                className="absolute inset-0 w-full h-full rounded-xl border border-border"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        )}

        {/* Prominent cards */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-light text-foreground mb-5">
            The places you'll use most
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROMINENT_CARDS.map((card) => (
              <ProminentCardItem key={card.to} {...card} />
            ))}
          </div>
        </section>

        {/* Compact links */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-light text-foreground mb-4">
            Everything else in here
          </h2>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
              {COMPACT_LINKS.map((link) => (
                <CompactLinkItem key={link.to} {...link} />
              ))}
            </div>
          </div>
        </section>

        {/* First steps */}
        <section className="mb-12">
          <h2 className="font-display text-xl font-light text-foreground mb-3">
            Your first few steps
          </h2>
          <p className="font-body text-sm text-muted-foreground mb-4 leading-relaxed">
            Nothing here is due today. You are welcome to go at your own pace.
          </p>
          <div className="rounded-xl border border-border bg-card p-5 md:p-6">
            <div className="space-y-1">
              {FIRST_STEPS.map((step) => (
                <StepItem key={step.to} {...step} />
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <div className="text-center py-6">
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            The team is here whenever you need us. Messages is the best way to reach us.
          </p>
        </div>
      </div>
    </div>
  );
}
