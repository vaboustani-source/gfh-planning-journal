import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalData } from "@/hooks/usePortalData";
import { Building2, Instagram, FileCheck2, ChevronDown, ChevronUp } from "lucide-react";
import VendorFileUpload from "@/components/admin/VendorFileUpload";

interface Vendor {
  id: string;
  category: string;
  business_name: string | null;
  contact_name: string | null;
  instagram: string | null;
  status: string | null;
}

const FRIENDLY_CATEGORY: Record<string, string> = {
  venue: "Venue", caterer: "Caterer", photographer: "Photographer", videographer: "Videographer",
  hair: "Hair Stylist", makeup: "Makeup Artist", officiant: "Officiant", ceremony_music: "Ceremony Music",
  dj_band: "DJ / Band", florals: "Florals", rentals: "Rentals", photo_booth: "Photo Booth",
  fireworks: "Fireworks", invitations: "Invitations", hotel: "Hotel", shuttle: "Shuttle Service",
  planner: "Planner", cake: "Cake", other: "Other",
};

interface VendorGroup { label: string; categories: string[] }
const VENDOR_GROUPS: VendorGroup[] = [
  { label: "Venue & Catering", categories: ["venue", "caterer"] },
  { label: "Memory Capture", categories: ["photographer", "videographer"] },
  { label: "Beauty", categories: ["hair", "makeup"] },
  { label: "Ceremony", categories: ["officiant", "ceremony_music", "dj_band"] },
  { label: "Florals & Decor", categories: ["florals", "rentals", "photo_booth", "fireworks"] },
  { label: "Printed & Graphic", categories: ["invitations"] },
  { label: "Guest Logistics", categories: ["hotel", "shuttle"] },
  { label: "Additional", categories: ["planner", "cake", "other"] },
];

function VendorCard({ vendor, eventId }: { vendor: Vendor; eventId: string }) {
  const isGF = ["venue", "caterer"].includes(vendor.category) && vendor.business_name === "Gilbertsville Farmhouse";
  const [expanded, setExpanded] = useState(false);
  const [fileCount, setFileCount] = useState(0);

  return (
    <div className={`rounded-xl border overflow-hidden ${isGF ? "border-sage/25 bg-sage/5" : "border-border bg-card"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                {FRIENDLY_CATEGORY[vendor.category] || vendor.category}
              </p>
              {isGF && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-sage font-medium">
                  <Building2 size={8} /> GF
                </span>
              )}
              {fileCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 border border-sage/30 px-2 py-0.5 font-body text-[10px] text-primary font-medium">
                  <FileCheck2 size={8} /> Contract on file
                </span>
              )}
            </div>
            {vendor.business_name ? (
              <p className="font-body text-sm font-medium text-foreground">{vendor.business_name}</p>
            ) : (
              <p className="font-body text-sm italic text-muted-foreground/50">Not yet confirmed</p>
            )}
            {vendor.contact_name && (
              <p className="font-body text-xs text-muted-foreground mt-0.5">{vendor.contact_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {vendor.instagram && (
              <a href={`https://instagram.com/${vendor.instagram.replace("@", "")}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                <Instagram size={13} />
                <span className="font-body text-[11px]">@{vendor.instagram.replace("@", "")}</span>
              </a>
            )}
            <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20">
          <VendorFileUpload
            eventId={eventId}
            vendorId={vendor.id}
            canUpload={false}
            canDelete={false}
            onFileCountChange={setFileCount}
          />
          {fileCount === 0 && (
            <p className="font-body text-xs text-muted-foreground text-center py-2">No files uploaded yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function VendorList() {
  const { eventId } = usePortalData();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    supabase
      .from("vendors")
      .select("id, category, business_name, contact_name, instagram, status")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setVendors(data);
        setLoading(false);
      });
  }, [eventId]);

  if (loading) {
    return <div className="space-y-2 mt-4">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}</div>;
  }

  if (vendors.length === 0) {
    return <p className="font-body text-sm text-muted-foreground mt-4">Your vendor list will appear here once your coordinator sets things up.</p>;
  }

  return (
    <div className="space-y-6 mt-4">
      {VENDOR_GROUPS.map(group => {
        const groupVendors = vendors.filter(v => group.categories.includes(v.category));
        if (groupVendors.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="font-display text-sm font-light text-foreground border-b border-border pb-1.5 mb-2.5">
              {group.label}
            </p>
            <div className="space-y-2">
              {groupVendors.map(v => <VendorCard key={v.id} vendor={v} eventId={eventId!} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
