import { useEffect, useState } from "react";
import { useParams, useNavigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PortalDataProvider } from "@/hooks/usePortalData";
import { Eye, X } from "lucide-react";
import PortalSidebarNav from "@/components/portal/PortalSidebarNav";

// Preview shows every page the couple could have, regardless of tab access.
const showAll = () => true;


export default function PreviewPortalLayout() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [coupleNames, setCoupleNames] = useState("this couple");

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data: euData } = await supabase
        .from("event_users")
        .select("user_id")
        .eq("event_id", eventId)
        .in("role_in_event", ["partner_1", "partner_2", "couple"]);

      if (euData && euData.length > 0) {
        const userIds = euData.map(eu => eu.user_id).filter(Boolean) as string[];
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("first_name, last_name")
            .in("id", userIds);
          if (usersData && usersData.length > 0) {
            const names = usersData
              .map(u => `${u.first_name || ""} ${u.last_name || ""}`.trim())
              .filter(Boolean)
              .join(" & ");
            if (names) setCoupleNames(names);
          }
        }
      }
    })();
  }, [eventId]);

  if (!eventId) return null;

  return (
    <PortalDataProvider key={eventId} previewEventId={eventId}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Preview banner */}
        <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Eye size={16} className="text-amber-600 shrink-0" />
              <p className="font-body text-sm text-amber-800">
                <span className="font-medium">Preview Mode</span>
                <span className="hidden sm:inline"> — You're viewing <strong>{coupleNames}</strong>'s portal exactly as they see it</span>
              </p>
            </div>
            <button
              onClick={() => navigate(`/admin/events/${eventId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 font-body text-xs font-medium text-amber-800 transition-colors"
            >
              <X size={12} />
              Exit Preview
            </button>
          </div>
        </div>

        {/* Read-only overlay for interactions */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border bg-sidebar sticky top-[45px] h-[calc(100vh-45px)]">
            <div className="px-5 py-6 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sage/15 border border-sage/25 flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-sage">
                    <path d="M12 2C8 2 4 6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4-4-8-8-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </div>
                <div>
                  <p className="font-display text-base font-light leading-tight text-foreground">Gilbertsville</p>
                  <p className="font-body text-[10px] text-muted-foreground -mt-0.5">Farmhouse</p>
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-b border-border">
              <p className="font-body text-[10px] tracking-widest uppercase text-amber-600 mb-0.5">Preview as</p>
              <p className="font-body text-sm font-medium text-foreground truncate">{coupleNames}</p>
            </div>

            <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
              <PortalSidebarNav basePath={`/admin/preview/${eventId}`} visible={showAll} />
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-y-auto pb-24 lg:pb-0">
            <Outlet />
          </div>
        </div>
      </div>
    </PortalDataProvider>
  );
}
