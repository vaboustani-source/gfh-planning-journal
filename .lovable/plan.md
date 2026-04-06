

# Shared Documents Tab + Download All ZIP

## Overview

Create a couple-facing Documents page that shares the same `documents` table as admin. Both sides can upload and view all event documents. Add a "Download All as ZIP" button on the admin side for archiving.

## Changes

### 1. New file: `src/pages/portal/Documents.tsx`

A portal-styled Documents page that reuses the same data source (`documents` table filtered by `event_id`). Couples can:
- Upload files (type defaults to `couple_upload`, no type selector — keep it simple)
- View all documents grouped by category (same `DOC_GROUPS` as admin)
- Download individual files
- Delete only their own uploads (filter delete button by `uploaded_by === currentUserId`)

Uses the portal design language (same card styles, fonts, spacing as other portal pages). Includes `PortalStickyFooter` with Save & Continue to the next section.

### 2. Route + nav registration

**`src/App.tsx`** — Add `documents` route to both the couple portal and admin preview route groups:
```
<Route path="documents" element={<Documents />} />
```

**`src/pages/portal/PortalLayout.tsx`** — Add Documents nav item after Notes:
```
{ to: "/portal/documents", label: "Documents", icon: FileText, tiers: [1, 3, 4] }
```

**`src/pages/admin/PreviewPortalLayout.tsx`** — Add Documents to the preview nav:
```
{ to: "documents", label: "Documents", icon: FileText }
```

### 3. Download All as ZIP — Admin Documents tab

**`src/pages/admin/tabs/AdminDocumentsTab.tsx`** — Add a "Download All (.zip)" button in the header area. On click:
- Fetch all document URLs from state
- Use JSZip (install `jszip` package) to fetch each file and add to a zip
- Use `file-saver` (install) or a Blob download to trigger browser download
- Show progress indicator while zipping
- File name: `{event_title}_documents.zip` or `event_documents.zip`

This gives the admin a one-click archive before closing out an event.

### 4. Package additions

- `jszip` — client-side ZIP creation
- `file-saver` — trigger browser file download (or use native Blob URL approach to avoid the dep)

### Files modified
- `src/pages/portal/Documents.tsx` (new)
- `src/App.tsx` — add route
- `src/pages/portal/PortalLayout.tsx` — add nav item
- `src/pages/admin/PreviewPortalLayout.tsx` — add nav item
- `src/pages/admin/tabs/AdminDocumentsTab.tsx` — add Download All ZIP button

### Technical notes
- RLS already allows couples full access to their event's documents (`Couples manage their documents` policy exists)
- Storage bucket `vendor-contracts` is already used for all document uploads — couple uploads will use the same bucket with path `{eventId}/couple/{timestamp}_{filename}`
- The ZIP download fetches files client-side via `fetch()` on the public URLs, so no edge function needed

