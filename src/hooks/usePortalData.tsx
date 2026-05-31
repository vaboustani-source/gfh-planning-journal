import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TabAccess, normalizeTabAccess, DEFAULT_TAB_ACCESS, hasFullAccess } from "@/lib/tabAccess";

interface PortalEvent {
  id: string;
  title: string;
  wedding_date: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  ceremony_location: string | null;
  cocktail_hour_location: string | null;
  rehearsal_dinner_location: string | null;
  status: string;
  package_tier: string | null;
  estimated_guest_count: number | null;
}

interface ChecklistProgress {
  total: number;
  completed: number;
  percentage: number;
}

interface NextTask {
  id: string;
  label: string;
  section: string;
  paced_send_date: string | null;
}

interface PortalDataContextType {
  event: PortalEvent | null;
  eventId: string | null;
  accessTier: number;
  roleInEvent: string | null;
  tabAccess: TabAccess;
  hasTabAccess: (tab: keyof TabAccess) => boolean;
  checklistProgress: ChecklistProgress;
  nextTask: NextTask | null;
  daysUntilArrival: number | null;
  loading: boolean;
  refreshChecklist: () => void;
  isPreviewMode: boolean;
}

const CHECKLIST_SECTIONS = ["arrival", "ceremony", "reception", "attire", "decor", "logistics"] as const;
const EMPTY_CHECKLIST_PROGRESS: ChecklistProgress = { total: 0, completed: 0, percentage: 0 };

const PortalDataContext = createContext<PortalDataContextType | undefined>(undefined);

const isChecklistSection = (section: string) =>
  CHECKLIST_SECTIONS.includes(section as (typeof CHECKLIST_SECTIONS)[number]);

export function PortalDataProvider({ children, previewEventId }: { children: ReactNode; previewEventId?: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const { eventId: routeEventId } = useParams<{ eventId?: string }>();
  const isPreviewMode = location.pathname.startsWith("/admin/preview/");
  const previewEventIdFromRoute = isPreviewMode ? (previewEventId ?? routeEventId ?? null) : null;

  const [event, setEvent] = useState<PortalEvent | null>(null);
  const [eventId, setEventId] = useState<string | null>(previewEventIdFromRoute);
  const [accessTier, setAccessTier] = useState<number>(3);
  const [roleInEvent, setRoleInEvent] = useState<string | null>(null);
  const [tabAccess, setTabAccess] = useState<TabAccess>(DEFAULT_TAB_ACCESS);
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress>(EMPTY_CHECKLIST_PROGRESS);
  const [nextTask, setNextTask] = useState<NextTask | null>(null);
  const [loading, setLoading] = useState(true);

  const resetChecklistState = () => {
    setChecklistProgress(EMPTY_CHECKLIST_PROGRESS);
    setNextTask(null);
  };

  const fetchChecklist = async (targetEventId: string) => {
    const { data: allItems } = await supabase
      .from("checklist_items")
      .select("id, status, label, section, paced_send_date, owner, sort_order")
      .eq("event_id", targetEventId)
      .order("sort_order", { ascending: true });

    if (!allItems) {
      resetChecklistState();
      return;
    }

    const checklistItems = allItems.filter((item) => isChecklistSection(item.section));
    const total = checklistItems.length;
    const completed = checklistItems.filter((item) => item.status === "complete").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    setChecklistProgress({ total, completed, percentage });

    const incomplete = checklistItems.filter((item) => item.status !== "complete");
    setNextTask(incomplete[0] ?? null);
  };

  const fetchEventData = async () => {
    if (!user && !previewEventIdFromRoute) {
      setEvent(null);
      setEventId(null);
      setRoleInEvent(null);
      resetChecklistState();
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let activeEventId: string | null = previewEventIdFromRoute;

      if (activeEventId) {
        setAccessTier(3);
        setRoleInEvent("preview");
        setTabAccess({
          overview: true, vendors: true, ceremony: true, timeline: true,
          menus: true, lodging: true, financials: true, messages: true,
          notes: true, forms: true, documents: true, experiences: true, seating: true, rsvp: true,
        });
      } else if (user) {
        const { data: eu } = await supabase
          .from("event_users")
          .select("event_id, access_tier, role_in_event, tab_access")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!eu?.event_id) {
          setEvent(null);
          setEventId(null);
          setRoleInEvent(null);
          resetChecklistState();
          return;
        }

        activeEventId = eu.event_id;
        const tier = eu.access_tier ?? 3;
        setAccessTier(tier);
        setRoleInEvent(eu.role_in_event);
        // Couples / partners / coordinator / tier 4 → all tabs on
        if (hasFullAccess(eu.role_in_event, tier)) {
          setTabAccess({
            overview: true, vendors: true, ceremony: true, timeline: true,
            menus: true, lodging: true, financials: tier !== 4, messages: true,
            notes: true, forms: true, documents: true, experiences: true, seating: true,
          });
        } else {
          setTabAccess(normalizeTabAccess(eu.tab_access));
        }
      }

      if (!activeEventId) {
        setEvent(null);
        setEventId(null);
        resetChecklistState();
        return;
      }

      setEventId(activeEventId);

      const { data: eventData } = await supabase
        .from("events")
        .select("id, title, wedding_date, arrival_date, departure_date, ceremony_location, cocktail_hour_location, rehearsal_dinner_location, status, package_tier, estimated_guest_count")
        .eq("id", activeEventId)
        .maybeSingle();

      setEvent(eventData ?? null);
      await fetchChecklist(activeEventId);
    } catch (err) {
      console.error("Portal data error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventData();
  }, [user, previewEventIdFromRoute]);

  const daysUntilArrival = (() => {
    if (!event?.arrival_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const arrival = new Date(event.arrival_date); arrival.setHours(0, 0, 0, 0);
    return Math.round((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const refreshChecklist = () => {
    if (eventId) void fetchChecklist(eventId);
  };

  return (
    <PortalDataContext.Provider value={{
      event,
      eventId,
      accessTier,
      roleInEvent,
      tabAccess,
      hasTabAccess: (tab) => tabAccess[tab],
      checklistProgress,
      nextTask,
      daysUntilArrival,
      loading,
      refreshChecklist,
      isPreviewMode,
    }}>
      {children}
    </PortalDataContext.Provider>
  );
}

export function usePortalData() {
  const ctx = useContext(PortalDataContext);
  if (!ctx) throw new Error("usePortalData must be used within PortalDataProvider");
  return ctx;
}
