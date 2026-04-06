

# Fix Documents Upload Issues

## Root causes

1. **Private bucket + `getPublicUrl`**: The `vendor-contracts` bucket is private (`public: false`), but the code uses `getPublicUrl()` to generate download URLs. These URLs won't work for a private bucket — need `createSignedUrl()` instead. While this mainly affects downloads, it also means previously "uploaded" files would appear broken, making it seem like nothing works.

2. **Silent error swallowing**: The `uploadFile` function catches storage errors but shows no feedback — it just resets the progress bar. If the upload fails (e.g. due to storage policy mismatch, bucket config, or network), the user sees the spinner reset with zero explanation.

3. **Stale closure in `handleDrop`**: The `useCallback` for `handleDrop` has `[eventId]` in its dependency array but calls `uploadFile` which isn't memoized. This means `uploadFile` might capture stale `eventId` or `user` values when called via drag-and-drop.

## Fix plan

### 1. Add error feedback with toast notifications
- Import `toast` from sonner
- Show `toast.error("Upload failed — please try again")` when the storage upload returns an error
- Show `toast.error("File too large — 20MB max")` for oversized files
- Show `toast.success("File uploaded")` on success

### 2. Fix download URLs for private bucket
- Replace `getPublicUrl()` with `createSignedUrl(filePath, 3600)` (1-hour expiry) when storing `file_url`
- For existing documents that already have broken public URLs, generate signed URLs on fetch rather than storing them

### 3. Fix stale closures
- Wrap `uploadFile` in `useCallback` with proper dependencies (`[eventId, user]`)
- Update `handleDrop` to depend on `uploadFile`

### 4. Apply same fixes to `AdminDocumentsTab.tsx`
- Same `getPublicUrl` → signed URL fix
- Same error toast additions
- Same closure fixes

### Files modified
- `src/pages/portal/Documents.tsx`
- `src/pages/admin/tabs/AdminDocumentsTab.tsx`

