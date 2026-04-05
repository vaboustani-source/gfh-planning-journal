

# Plan: Couple-Side Vendor Delete + Document Upload

## Current State

- **VendorCard** already has delete button logic but it's gated behind `isAdmin` (line 182)
- **VendorFileUpload** already has full upload/delete/download UI but `canUpload` and `canDelete` are passed as `false` from the couple side (lines 213-214 in VendorCard, lines 339-342 in edit mode)
- **VendorList** (couple side) doesn't pass `onDelete` to VendorCard at all
- Couples have an RLS UPDATE policy on vendors but no DELETE policy
- The `documents` table has full CRUD RLS for couples via `event_users`
- Storage bucket `vendor-contracts` needs couple upload access (currently scoped by event folder)

## Changes

### 1. Database Migration — Add DELETE RLS on vendors for couples

Add a policy so couples can delete non-GF vendor rows linked to their event:

```sql
CREATE POLICY "Couples can delete vendors"
ON public.vendors FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM event_users
    WHERE event_users.event_id = vendors.event_id
    AND event_users.user_id = auth.uid()
  )
);
```

Also add a storage policy so couples can upload to the `vendor-contracts` bucket for their event folder:

```sql
CREATE POLICY "Couples upload vendor files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-contracts'
  AND EXISTS (
    SELECT 1 FROM event_users
    WHERE event_users.event_id::text = (storage.foldername(name))[1]
    AND event_users.user_id = auth.uid()
  )
);
```

### 2. VendorList.tsx — Add delete handler + pass it to VendorCard

- Add a `deleteVendor` function that calls `supabase.from("vendors").delete().eq("id", id)` and removes from local state
- Pass `onDelete={deleteVendor}` to each `VendorCard`

### 3. VendorCard.tsx — Enable delete + file upload for couples

- Remove the `isAdmin` gate on the delete button (line 182) — keep only the `!isGF` check so GF rows remain non-deletable
- Change `canUpload` and `canDelete` on `VendorFileUpload` from `isAdmin` to `true` in both view and edit modes, so couples can upload contracts, inspo photos, and docs per vendor
- Update the label from "Contracts & Files" to "Documents & Files" for the couple view

### Files Modified

| File | Change |
|------|--------|
| Migration SQL | DELETE policy on `vendors`, INSERT policy on `storage.objects` |
| `src/pages/portal/people/VendorList.tsx` | Add `deleteVendor` handler, pass to VendorCard |
| `src/components/vendor/VendorCard.tsx` | Show delete button for non-GF rows regardless of role; enable file upload/delete for couples |

