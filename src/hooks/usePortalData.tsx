import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  checklistProgress: ChecklistProgress;
  nextTask: NextTask | null;
  daysUntilArrival: number | null;
  loading: boolean;
  refreshChecklist: () => void;
  isPreviewMode: boolean;
}

const PortalDataContext = createContext<PortalDataContextType | undefined>(undefined);

export function PortalDataProvider({ children, previewEventId }: { children: ReactNode; previewEventId?: string }) {
  const { user } = useAuth();
  const [event, setEvent] = useState<PortalEvent | null>(null);
  const [accessTier, setAccessTier] = useState<number>(3);
  const [roleInEvent, setRoleInEvent] = useState<string | null>(null);
  const [checklistProgress, setChecklistProgress] = useState<ChecklistProgress>({ total: 0, completed: 0, percentage: 0 });
  const [nextTask, setNextTask] = useState<NextTask | null>(null);
  const [loading, setLoading] = useState(true);
  const isPreviewMode = !!previewEventId;

  const fetchEventData = async () => {
    if (!user) return;
    try {
      let eventId: string;

      if (previewEventId) {
        eventId = previewEventId;
        setAccessTier(3);
        setRoleInEvent("preview");
      } else {
        const { data: eu } = await supabase
          .from("event_users")
          .select("event_id, access_tier, role_in_event")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!eu?.event_id) { setLoading(false); return; }
        setAccessTier(eu.access_tier ?? 3);
        setRoleInEvent(eu.role_in_event);
        eventId = eu.event_id;
      }

      const { data: eventData } = await supabase
        .from("events")
        .select("id, title, wedding_date, arrival_date, departure_date, ceremony_location, cocktail_hour_location, rehearsal_dinner_location, status, package_tier, estimated_guest_count")
        .eq("id", eventId)
        .single();

      if (eventData) setEvent(eventData);
      await fetchChecklist(eventId);
    } catch (err) {
      console.error("Portal data error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async (eventId: string) => {
    const { data: allItems } = await supabase
      .from("checklist_items")
      .select("id, status, label, section, paced_send_date, owner, sort_order")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (!allItems) return;

    // Only count couple-owned non-timeline items for progress
    const coupleItems = allItems.filter(i => i.owner === "couple" && !i.section.startsWith("timeline_"));
    const total = coupleItems.length;
    const completed = coupleItems.filter(i => i.status === "complete").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    setChecklistProgress({ total, completed, percentage });

    const incomplete = coupleItems
      .filter(i => i.status !== "complete");

    setNextTask(incomplete[0] ?? null);
  };

  useEffect(() => {
    fetchEventData();
  }, [user, previewEventId]);

  const daysUntilArrival = (() => {
    if (!event?.arrival_date) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const arrival = new Date(event.arrival_date); arrival.setHours(0, 0, 0, 0);
    return Math.round((arrival.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const refreshChecklist = () => {
    if (event?.id) fetchChecklist(event.id);
  };

  return (
    <PortalDataContext.Provider value={{
      event,
      eventId: event?.id ?? null,
      accessTier,
      roleInEvent,
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
