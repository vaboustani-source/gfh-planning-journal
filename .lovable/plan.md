

# Fix Couple Portal Content Width

## Summary
Change `max-w-lg` to `max-w-5xl` on the outer content container div in 10 portal page components to match the Vendors page width.

## Changes

One-line change per file — replace `max-w-lg` with `max-w-5xl` in the outermost container div's className:

| File | Line pattern |
|------|-------------|
| `src/pages/portal/MenusMeals.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Planning.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/OurPeople.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Financials.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Today.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/OurWeekend.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Ceremony.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Decor.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Notes.tsx` | `max-w-lg` → `max-w-5xl` |
| `src/pages/portal/Messages.tsx` | `max-w-lg` → `max-w-5xl` |

No other changes. Width only.

