

# Fix Admin Overview: Dropdowns, Remove Sections

## Problems

1. **Dropdowns (Status, Package Tier) don't visually update when clicked** — The `SelectField` component uses `value={value}` (the prop from parent) as a controlled input, but the parent state only updates after the async Supabase call completes. React immediately snaps the select back to the old prop value before the save finishes, making it appear broken.

2. **Add-ons section and How Heard field need to be removed** from the Overview page.

## Changes

### File: `src/pages/admin/tabs/Overview.tsx`

**Fix SelectField** — Add local optimistic state so the dropdown updates immediately on click, then syncs with the saved value:

```tsx
function SelectField({ label, value, options, onSave }) {
  const [localValue, setLocalValue] = useState(value);
  const [saving, setSaving] = useState(false);

  // Sync if prop changes from outside
  useEffect(() => { setLocalValue(value); }, [value]);

  return (
    <select
      value={localValue}
      onChange={async (e) => {
        setLocalValue(e.target.value);  // optimistic
        setSaving(true);
        await onSave(e.target.value);
        setSaving(false);
      }}
    />
  );
}
```

**Remove Add-ons and How Heard** — Delete the entire fourth card in the grid (lines 387–413) containing the Add-ons toggles and the "How Heard" field. Also remove the `addons` state, `addonsLoaded` state, the `ALL_ADDONS` constant, the `SmallToggle` component, and the addon-fetching logic — all now unused.

**Guest Count** — Already editable via the `Field` component on line 375. No change needed.

### Summary of removals
- `ALL_ADDONS` constant (line 213–216)
- `SmallToggle` component (lines 131–146)
- `addons` / `addonsLoaded` state and the fetch block (lines 220–248)
- The Add-ons card JSX (lines 387–413)

Grid goes from 4 cards to 3 cards (Key Dates, Event Info, Locations).

