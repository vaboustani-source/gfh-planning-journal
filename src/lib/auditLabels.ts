import { formatMealType, formatPackageTier } from "./formatMealType";

/**
 * Friendly labels for audit log field names, scoped per table.
 * Falls back to title-cased snake_case if not found.
 */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  events: {
    title: "Title",
    wedding_date: "Wedding date",
    arrival_date: "Arrival date",
    departure_date: "Departure date",
    tasting_date: "Tasting date",
    wedding_date_note: "Wedding date note",
    arrival_date_note: "Arrival date note",
    departure_date_note: "Departure date note",
    tasting_date_note: "Tasting date note",
    ceremony_location: "Ceremony location",
    cocktail_hour_location: "Cocktail hour location",
    rehearsal_dinner_location: "Rehearsal dinner location",
    package_tier: "Package tier",
    status: "Status",
    estimated_guest_count: "Estimated guest count",
    count_at_30_days: "30-day headcount",
    count_at_90_days: "90-day headcount",
    how_heard: "How they heard about us",
    event_type: "Event type",
  },
  vendors: {
    business_name: "Business name",
    contact_name: "Contact name",
    phone: "Phone",
    email: "Email",
    instagram: "Instagram",
    category: "Category",
    status: "Status",
    contract_uploaded: "Contract uploaded",
    coi_received: "COI received",
    info_emailed: "Info emailed",
    vendor_meals: "Vendor meals",
    brandon_notes: "Coordinator notes",
  },
  checklist_items: {
    label: "Task",
    status: "Status",
    section: "Section",
    owner: "Owner",
    paced_send_date: "Due date",
    completed_at: "Completed at",
    notes: "Notes",
  },
  ceremony_details: {
    officiant_name: "Officiant name",
    officiant_relationship: "Officiant relationship",
    officiant_attending_rehearsal: "Officiant attending rehearsal",
    ceremony_music_vendor: "Ceremony music vendor",
    musician_singer: "Musician / singer",
    dj_band_vendor: "DJ / band vendor",
    dj_playlist_name: "DJ playlist name",
    dj_staying_for_afterparty: "DJ staying for after-party",
    dj_events_performing: "DJ events performing",
    microphone_speakers: "Microphone & speakers",
    microphone_type: "Microphone type",
    processional_order: "Processional order",
    intro_order: "Introduction order",
    formal_introductions: "Formal introductions",
    welcome_toast_person: "Welcome toast person",
    speeches_rehearsal: "Rehearsal speeches",
    speeches_reception: "Reception speeches",
    parent_dances: "Parent dances",
    first_dance_song: "First dance song",
    last_dance_song: "Last dance song",
    recessional_song: "Recessional song",
    cake_cutting_song: "Cake cutting song",
    wedding_party_altar_choice: "Wedding party at altar",
    wedding_party_altar_notes: "Wedding party altar notes",
    couple_leading_to_cocktail: "Couple leading to cocktail",
    couple_staying_for_photos: "Couple staying for photos",
    script_sent_to_brandon: "Script sent to coordinator",
    finalized: "Finalized",
    locked_by_brandon: "Locked by coordinator",
    special_notes: "Special notes",
    misc_notes: "Misc notes",
  },
  bar_selections: {
    bar_package: "Bar package",
    welcome_drink_1: "Welcome drink 1",
    welcome_drink_2: "Welcome drink 2",
    welcome_drink_3: "Welcome drink 3",
    champagne_welcome_toast: "Champagne welcome toast",
    champagne_arrival_upgrade: "Champagne arrival upgrade",
    white_wine_1: "White wine 1",
    white_wine_2: "White wine 2",
    red_wine_1: "Red wine 1",
    red_wine_2: "Red wine 2",
    beer_selection_1: "Beer selection 1",
    beer_selection_2: "Beer selection 2",
    signature_drink_1: "Signature drink 1",
    signature_drink_2: "Signature drink 2",
    signature_drink_special_request: "Signature drink special request",
    high_noon_events: "High Noon events",
    high_noon_upgrade_1: "High Noon upgrade 1",
    high_noon_upgrade_2: "High Noon upgrade 2",
    high_noon_add_third: "High Noon add third",
    finalized: "Finalized",
    locked_by_brandon: "Locked by coordinator",
    notes: "Notes",
  },
  lodging_assignments: {
    assigned_guest_name: "Assigned guest",
    assigned_guest_email: "Guest email",
    payment_mode: "Payment mode",
    payment_method: "Payment method",
    payment_completed_date: "Payment completed",
    host_pays: "Host pays",
    invoice_1_sent: "Invoice 1 sent",
    invoice_2_sent: "Invoice 2 sent",
    invoice_final_sent: "Final invoice sent",
    brandon_notes: "Coordinator notes",
    room_id: "Room",
  },
  decor_items: {
    item_name: "Item",
    event_section: "Event section",
    quantity: "Quantity",
    unit_price: "Unit price",
    provided_by: "Provided by",
    ordered: "Ordered",
    confirmed_by_brandon: "Confirmed by coordinator",
    couple_notes: "Couple notes",
    brandon_notes: "Coordinator notes",
    selection_notes: "Selection notes",
  },
  dietary_restrictions: {
    guest_name: "Guest name",
    has_restriction: "Has restriction",
    restriction_type: "Restriction type",
    severity: "Severity",
    is_child: "Is child",
    child_age: "Child age",
    is_onsite: "On-site guest",
    reception_only: "Reception only",
    other_meals: "Other meals",
    notes: "Notes",
  },
  financials: {
    site_fee_total: "Site fee total",
    site_fee_paid: "Site fee paid",
    catering_estimate: "Catering estimate",
    catering_paid: "Catering paid",
    notes: "Notes",
  },
  meal_events: {
    meal_type: "Meal",
    location: "Location",
    adult_count: "Adult count",
    kids_count: "Kids count",
    vendor_count: "Vendor count",
    included_in_package: "Included in package",
    notes: "Notes",
  },
  guests: {
    first_name: "First name",
    last_name: "Last name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    invite_group: "Invite group",
    rsvp_status: "RSVP",
    plus_one_allowed: "Plus one allowed",
    plus_one_name: "Plus one name",
    meal_choice: "Meal choice",
    table_assignment: "Table",
    notes: "Notes",
  },
  guest_dietary_entries: {
    guest_name: "Guest",
    restriction_type: "Restriction",
    severity: "Severity",
    is_child: "Is child",
    meal_scope: "Meals",
    notes: "Notes",
  },
  working_timeline: {
    published: "Published",
    timeline_data: "Timeline",
  },
  milestones: {
    title: "Milestone",
    timeframe_label: "Timeframe",
    target_date: "Target date",
    status: "Status",
    owner: "Owner",
    notes: "Notes",
  },
  decor_selections: {
    quantity: "Quantity",
    unit_price: "Unit price",
    notes: "Notes",
  },
  experience_requests: {
    title: "Experience",
    status: "Status",
    requested_date: "Requested date",
    notes: "Notes",
  },
  budget_items: {
    label: "Item",
    category: "Category",
    estimated_amount: "Estimated amount",
    actual_amount: "Actual amount",
    notes: "Notes",
  },
  event_budgets: {
    total_budget: "Total budget",
    notes: "Notes",
  },
  seating_tables: {
    label: "Table",
    capacity: "Capacity",
    shape: "Shape",
    notes: "Notes",
  },
  seating_assignments: {
    guest_name: "Guest",
    seat_number: "Seat",
    notes: "Notes",
  },
  seating_config: {
    seating_mode: "Seating mode",
    table_count: "Table count",
    layout_image_url: "Layout image",
  },
  menu_finalization: {
    finalized: "Menus finalized",
  },
  financial_line_items: {
    label: "Item",
    section: "Section",
    quantity: "Quantity",
    unit_price: "Unit price",
  },
  payment_schedule: {
    label: "Payment",
    amount: "Amount",
    due_date: "Due date",
    paid: "Paid",
    paid_on: "Paid on",
    notes: "Notes",
  },
  documents: {
    title: "Document",
    description: "Description",
    file_name: "File name",
  },
};

/** Friendly value mappings per (table, field). */
const VALUE_LABELS: Record<string, Record<string, Record<string, string>>> = {
  events: {
    status: {
      onboarding: "Onboarding",
      planning: "Planning",
      tasting_complete: "Tasting Complete",
      final_30: "Final 30 Days",
      wedding_week: "Wedding Week",
      complete: "Complete",
      archived: "Archived",
    },
    how_heard: {
      google: "Google",
      instagram: "Instagram",
      referral: "Referral",
      wedding_website: "Wedding website",
      other: "Other",
    },
  },
  vendors: {
    status: {
      pending: "Pending",
      contacted: "Contacted",
      booked: "Booked",
      done: "Done",
    },
    category: {
      venue: "Venue",
      caterer: "Caterer",
      cake: "Cake",
      photographer: "Photographer",
      videographer: "Videographer",
      hair: "Hair",
      makeup: "Makeup",
      officiant: "Officiant",
      ceremony_music: "Ceremony music",
      dj_band: "DJ / Band",
      florals: "Florals",
      rentals: "Rentals",
      photo_booth: "Photo booth",
      fireworks: "Fireworks",
      invitations: "Invitations",
      shuttle: "Shuttle",
      hotel: "Hotel",
      planner: "Planner",
      other: "Other",
    },
  },
  checklist_items: {
    status: { complete: "Complete", incomplete: "Incomplete" },
    owner: { couple: "Couple", brandon: "Coordinator", both: "Both" },
  },
  ceremony_details: {
    wedding_party_altar_choice: {
      sit: "Sit",
      stand: "Stand",
      have_not_chosen: "Not yet chosen",
    },
  },
  bar_selections: {
    bar_package: { open: "Open Bar", premium: "Premium Bar" },
  },
  lodging_assignments: {
    payment_mode: { host: "Host pays", guest: "Guest pays", mixed: "Mixed" },
  },
  dietary_restrictions: {
    severity: { mild: "Mild", moderate: "Moderate", severe: "Severe", allergy: "Allergy" },
  },
  milestones: {
    status: { pending: "Pending", in_progress: "In progress", complete: "Complete" },
    owner: { couple: "Couple", brandon: "Coordinator", both: "Both" },
  },
};

function titleCase(snake: string): string {
  return snake
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Friendly label for a column on a given table. */
export function formatAuditField(table: string, field: string): string {
  return FIELD_LABELS[table]?.[field] ?? titleCase(field);
}

/** Friendly value for a column on a given table. */
export function formatAuditValue(table: string, field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Table+field-specific value mapping
  if (typeof value === "string") {
    const mapped = VALUE_LABELS[table]?.[field]?.[value];
    if (mapped) return mapped;

    // Cross-cutting helpers
    if (table === "meal_events" && field === "meal_type") return formatMealType(value);
    if (table === "events" && field === "package_tier") return formatPackageTier(value) ?? value;
  }

  if (typeof value === "object") {
    // Arrays / json — show compact preview
    try {
      if (Array.isArray(value)) {
        if (value.length === 0) return "Empty list";
        return `${value.length} item${value.length === 1 ? "" : "s"}`;
      }
      return JSON.stringify(value);
    } catch {
      return "[complex value]";
    }
  }

  return String(value);
}

/** Friendly section label for a table in the audit log. */
export const TABLE_LABELS: Record<string, string> = {
  events: "Event details",
  vendors: "Vendor",
  checklist_items: "Checklist item",
  ceremony_details: "Ceremony & music",
  bar_selections: "Bar selections",
  lodging_assignments: "Lodging assignment",
  decor_items: "Décor item",
  decor_selections: "Décor selection",
  dietary_restrictions: "Dietary restriction",
  financials: "Financials",
  meal_events: "Meal event",
  guests: "Guest",
  guest_dietary_entries: "Guest dietary entry",
  working_timeline: "Weekend timeline",
  milestones: "Milestone",
  experience_requests: "Experience",
  budget_items: "Budget item",
  event_budgets: "Budget",
  seating_tables: "Seating table",
  seating_assignments: "Seat assignment",
  seating_config: "Seating layout",
  menu_finalization: "Menus",
  financial_line_items: "Financial line item",
  payment_schedule: "Payment schedule",
  documents: "Document",
};

/** Fields hidden from the audit log entirely (internal/noise). */
export const HIDDEN_AUDIT_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "last_updated",
  "sort_order",
]);

/**
 * Tables whose changes are appropriate to surface in the couple-facing
 * History view. Anything not in this set is hidden from couples.
 * Admin views are unaffected.
 */
export const COUPLE_ALLOWED_TABLES = new Set<string>([
  "guests",
  "guest_dietary_entries",
  "working_timeline",
  "milestones",
  "decor_selections",
  "experience_requests",
  "budget_items",
  "event_budgets",
  "seating_tables",
  "seating_assignments",
  "seating_config",
  "menu_finalization",
  "ceremony_details",
  "bar_selections",
  "dietary_restrictions",
  "meal_events",
  "financials",
  "financial_line_items",
  "payment_schedule",
  "documents",
]);

/**
 * Returns true only if a field has a friendly label defined for the table.
 * Used by the couple-facing History view to "fail toward hiding" unmapped fields.
 */
export function hasFriendlyAuditField(table: string, field: string): boolean {
  return Boolean(FIELD_LABELS[table]?.[field]);
}
