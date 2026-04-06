

# Mirror Admin Ceremony Tab in Couple Portal

## Gap Analysis

The couple's CeremonyMusic component is missing these sections that exist on the admin side:

| Admin Section | Couple Has? |
|---|---|
| Officiant | Yes |
| Ceremony Music Provider (musician, mic, speakers) | No |
| Processional Order | Yes |
| Post-ceremony (photos, cocktail hour checkboxes) | No |
| Wedding Party at Altar (sit/stand) | No |
| Music Selections (+ cake cutting song) | Partial — missing cake cutting |
| Parent Dances | Yes |
| Reception — Formal Introductions | No |
| Welcome Toast | No |
| DJ / Band | No |
| Speeches (rehearsal + reception) | No |
| Miscellaneous Notes | No |
| Special Notes | Yes |

## Plan

### File: `src/pages/portal/details/CeremonyMusic.tsx` — Major expansion

Add all missing state fields matching the admin component's types:
- `MusicianSinger`, `IntroEntry`, `SpeechEntry` interfaces
- State for: `musicianSinger`, `micSpeakers`, `microphone`, `ceremonyMusicVendor`, `djBandVendor`, `couplePhotos`, `coupleCocktail`, `altarChoice`, `altarNotes`, `cakeCuttingSong`, `introductions`, `welcomeToast`, `djAfterParty`, `djPlaylist`, `djEvents`, `speechesRehearsal`, `speechesReception`, `miscNotes`

Load all new fields from the `ceremony_details` row on mount (same cast pattern as admin).

Add matching sections in portal styling (rounded cards, `SectionHeading`, `TextInput`):
1. **Ceremony Music Provider** — musician booked checkbox, name, mic & speakers checkbox, mic type dropdown, vendor name
2. **Post-processional** — two checkboxes after processional section (photos, cocktail hour)
3. **Wedding Party at Altar** — sit/stand select + notes
4. **Music Selections** — add cake cutting song field
5. **Formal Introductions** — add/remove entries with name, role, unescorted toggle, escorted by, song
6. **Welcome Toast** — single text input
7. **DJ / Band** — vendor name, after-party checkbox, playlist name, event checkboxes
8. **Speeches** — rehearsal dinner + reception speakers with time estimates
9. **Miscellaneous Notes** — textarea with backup email reminder

All fields respect the `locked` state (readOnly inputs, no add/remove buttons when locked).

Update `handleSave` payload to include all new fields, matching the admin's `buildPayload` column names.

### File: `src/pages/portal/Ceremony.tsx` — No changes needed

Already wraps `CeremonyMusic` correctly.

### Technical notes
- All new fields map to existing `ceremony_details` columns (same ones the admin already reads/writes)
- No database changes needed
- Same `as Record<string, unknown>` cast pattern for columns not in the generated types
- Portal uses manual save button; no autosave change needed

