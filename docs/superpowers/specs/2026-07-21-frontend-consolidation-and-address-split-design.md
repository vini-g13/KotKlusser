# Frontend Flow Consolidation + Property Address Split — Design

Sub-project B1 from the vervolgronde op `kotklusser-cleanup-plan.md` (sectie 3.4, lower/medium-risk half — the `TicketDetail.jsx`/`AannemerKlusDetail.jsx` merge question is deliberately deferred as a separate sub-project B2). Status: ontwerp goedgekeurd, klaar voor `writing-plans`.

## Context

Audit against the current codebase (post-Supabase-migration) confirmed section 3.4's frontend-duplication findings are still valid:

1. **Join-code verification duplicated 3x**: `StudentDashboard.jsx` (uses `authAxios`), `JoinProperty.jsx` (raw `axios` + manual `${API}` prefix), `RegisterPage.jsx` (same raw-`axios` pattern). Each has its own state shape and trigger (onBlur / useEffect-on-mount / auto-on-length).
2. **Property form duplicated 3x**: `LandlordDashboard.jsx` (create, in a sidebar Dialog), `PropertyOnboarding.jsx` (create, full-page onboarding), `LandlordProfilePage.jsx` (edit, in a Dialog). The edit form is missing the `floor_count === 0` confirmation dialog that both create forms have (`LandlordDashboard.jsx:195`, `PropertyOnboarding.jsx:47`) — confirmed live bug.
3. **`propertiesUpdated` custom event inconsistent**: dispatched only from `LandlordProfilePage.jsx:91,105` (edit + delete); listened to in `LandlordDashboard.jsx:117` and `PropertyDetail.jsx:34`. Neither `LandlordDashboard.jsx`'s own "add property" flow nor `PropertyOnboarding.jsx` dispatches it.
4. **Contractor pages hardcode the API base URL**: `AannemerDashboard.jsx:66` and `AannemerKlusDetail.jsx:51,64` call `authAxios.get(\`${API}/...\`)`. This works today only by accident — `API` is an absolute URL, so axios's `isAbsoluteURL` check makes it bypass `authAxios`'s configured `baseURL` entirely rather than combining with it. Every other page (e.g. `StudentDashboard.jsx`) uses bare relative paths against `authAxios`.
5. **Misc hygiene** (all confirmed live in the current files):
   - `TicketDetail.jsx:14,51` — `Image` icon imported and `selectedImage`/`setSelectedImage` state declared, neither ever read/rendered anywhere else in the file.
   - `ProfilePage.jsx:12,19` — `ExternalLink` icon imported, `logout` destructured from `useAuth()`, neither ever used anywhere else in the file.
   - `ContactPage.jsx:13-18` — defines its own local `Textarea` component instead of importing the shared `components/ui/textarea.jsx`.
   - `JoinProperty.jsx:33` — leftover debug `console.log("Fetched property:", response.data)`.
   - Inconsistent `await` on logout: `AannemerDashboard.jsx:76` does `await logout()`, but `LandlordDashboard.jsx:165` and `StudentDashboard.jsx:80` call bare `logout()` (no `await`).

During brainstorming, a new requirement was added: split `properties.address` (today one free-text column) into structured `street` / `house_number` / `postal_code` / `city` fields, matching the sister project **KotStart** (`C:\shit\Bezig\Kot\KotStart\KotStartGit`), which already models a rental property this way (`street`/`number`/`postalCode`/`city` in `src/pages/PropertiesPage.tsx` and `supabase/migrations/20260611002638_property_address_split.sql`). This is explicitly forward-looking groundwork for the eventual platform merge described in `kotstart-platform-overzicht-bijgewerkt.md` — KotKlusser's property model should be structurally compatible with KotStart's.

**Important finding surfaced during brainstorming**: KotStart itself does **not** enforce these fields as required — its migration adds them as plain nullable columns, and its property form only requires `name` (`PropertiesPage.tsx:337`: `disabled={!form.name.trim() || saving}`). The user explicitly chose to make KotKlusser **stricter than KotStart** here (all 4 fields required), as a deliberate improvement for the future platform's data quality, not as a like-for-like match with KotStart's current behavior. KotStart itself is untouched by this sub-project.

This falls under `kotklusser-cleanup-plan.md` sectie 3.4 (frontend duplication) but the address split is new scope discovered during brainstorming, not in the original plan document.

## Scope

**In scope:**
1. `useJoinCodeVerification()` hook — shared fetch+state logic, each call site keeps its own trigger/error UX.
2. `<PropertyFormFields>` shared component + `useFloorCountConfirm()` hook + `<FloorCountConfirmDialog>` — used by all 3 property-form contexts, fixing the missing confirmation in the edit form.
3. `propertiesUpdated` dispatched consistently from all 4 mutation points (2 creates, 1 edit, 1 delete).
4. Contractor API base-URL normalization (3 call sites → relative paths).
5. The 5 listed hygiene fixes.
6. Property address split: Supabase migration, backend model/route changes, frontend form + display changes, all folded into the `<PropertyFormFields>` work from item 2 since it's the same touch-point.

**Explicitly out of scope** (deferred, separate sub-project B2):
- Whether `TicketDetail.jsx` and `AannemerKlusDetail.jsx` should be merged into one component with role-branching, or stay as two separate screens. This is a real architecture decision (692 vs 276 lines, different field-naming conventions) that deserves its own design conversation.
- Any change to KotStart itself.
- Any change to the Dutch/English naming convention question (sectie 5.2) or the organization-model documentation (sectie 5.3-5.4) — separate sub-projects.

## Architecture & components

### 1. `useJoinCodeVerification()` — new `frontend/src/hooks/useJoinCodeVerification.js`

```js
function useJoinCodeVerification() {
  const { authAxios } = useAuth();
  const [propertyInfo, setPropertyInfo] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const verifyJoinCode = useCallback(async (code) => {
    if (!code || code.length < 6) {
      setPropertyInfo(null);
      return null;
    }
    setVerifying(true);
    try {
      const response = await authAxios.get(`/properties/by-code/${code}`);
      setPropertyInfo(response.data);
      return response.data;
    } catch (error) {
      setPropertyInfo(null);
      throw error;
    } finally {
      setVerifying(false);
    }
  }, [authAxios]);

  return { propertyInfo, verifying, verifyJoinCode, setPropertyInfo };
}
```

Used via `authAxios` (not raw `axios` + manual `${API}` prefix) even in `RegisterPage.jsx`/`JoinProperty.jsx`, which run before login — this is safe because `authAxios` only *conditionally* attaches an `Authorization` header (`App.js:246-249`: `headers: token ? {...} : {}`), and `GET /properties/by-code/{code}` is an explicitly public, unauthenticated backend route (`server.py:1466-1469`, rate-limited, no `Depends(get_current_user)`).

Each of the 3 call sites keeps its own trigger and error UX by wrapping `verifyJoinCode`:
- `StudentDashboard.jsx`: calls it `onBlur`, silently no-ops on error (current behavior).
- `JoinProperty.jsx`: calls it in a `useEffect` on mount (code comes from the URL param), shows a toast on error (current behavior).
- `RegisterPage.jsx`: calls it in a `useEffect` on mount when `?join=` is present, AND on blur; shows a toast + clears the field on error (current behavior).

### 2. Property form consolidation + address split

**New: `frontend/src/components/PropertyFormFields.jsx`** — presentational component with 5 required inputs (name, street, house_number, postal_code, city) plus the existing floor_count input + "Genereert..." hint text. Takes `formData`/`onChange`/`testIdPrefix` props. Used by `LandlordDashboard.jsx`, `PropertyOnboarding.jsx`, `LandlordProfilePage.jsx` regardless of their differing Dialog-vs-full-page chrome.

**New: `useFloorCountConfirm(onConfirmedSubmit)`** hook + **`<FloorCountConfirmDialog open, onCancel, onConfirm>`** shared component — centralizes the "only ground floor, correct?" gate. Wired into all 3 contexts, which fixes the missing check in `LandlordProfilePage.jsx`'s edit flow.

**Backend (`backend/server.py`):**
- `PropertyCreate` (line 250 area): `address: str` → `street: str`, `house_number: str`, `postal_code: str`, `city: str` (all required).
- `PropertyUpdate` (line 255 area): same 4 fields, all `Optional[str] = None` — same PATCH semantics as the existing `name`/`floor_count` fields ("not provided = don't touch this field", not "may be stored empty"). The frontend edit form never submits an empty value for these since `<PropertyFormFields>` enforces non-empty before allowing submit.
- `PropertyResponse` (line 261 area): same 4 fields replace `address`.
- `_property_row_to_response`, `create_property`, `update_property`, `get_property_by_code` (the public join-code lookup): updated to read/write the 4 new columns instead of `address`.

**New Supabase migration** (`supabase/migrations/<timestamp>_split_property_address.sql`):
```sql
alter table public.properties
  add column if not exists street text,
  add column if not exists house_number text,
  add column if not exists postal_code text,
  add column if not exists city text;

update public.properties set
  street = coalesce(street, ''),
  house_number = coalesce(house_number, ''),
  postal_code = coalesce(postal_code, ''),
  city = coalesce(city, '')
where street is null or house_number is null or postal_code is null or city is null;

alter table public.properties
  alter column street set not null,
  alter column house_number set not null,
  alter column postal_code set not null,
  alter column city set not null;

alter table public.properties drop column address;
```
(Backfill-then-constrain pattern, so the migration doesn't fail even if a test row happens to exist — per the user's confirmation this is pre-launch test data only, no real backfill/parsing of existing address strings is needed.)

**New: `formatPropertyAddress({street, house_number, postal_code, city})`** frontend helper (`frontend/src/lib/utils.js` if an existing shared utils module exists there, otherwise a new small file) — builds `"Naamsestraat 123, 3000 Leuven"` for the 4 display sites that currently render `property.address` directly (`JoinProperty.jsx:93,236`, `PropertyDetail.jsx:117,140`, `LandlordProfilePage.jsx:511`). Since all 4 parts are now mandatory, no conditional-missing-part handling is needed.

### 3. `propertiesUpdated` consistency

Add `window.dispatchEvent(new CustomEvent('propertiesUpdated'))` after the successful `authAxios.post("/properties", ...)` in `LandlordDashboard.jsx`'s `submitNewProperty` and in `PropertyOnboarding.jsx`'s `submitProperty`, alongside the existing dispatches in `LandlordProfilePage.jsx`.

### 4. Contractor API base-URL

`AannemerDashboard.jsx:66` and `AannemerKlusDetail.jsx:51,64`: `authAxios.get(\`${API}/contractor/tickets\`)` → `authAxios.get('/contractor/tickets')` (and the other 2 sites analogously). String-only change, no behavior change (it already worked, just fragile).

### 5. Hygiene fixes

Straightforward removals/replacements at the exact lines listed in Context above — no design decisions needed.

## Data flow

Items 1, 3, 4, 5 are pure frontend refactors with zero API contract changes. Item 2's address split changes the `PropertyCreate`/`PropertyUpdate`/`PropertyResponse` wire shape (`address` field removed, 4 new fields added) — every frontend call site that builds or reads a property payload must move in lockstep with the backend/migration change, so this item's tasks (in the eventual plan) must land backend+migration+frontend together, not staged independently, to avoid a broken intermediate state.

## Error handling

`PropertyCreate`/`PropertyUpdate` validation errors behave exactly as today's `name`/`address`/`floor_count` errors do (missing required field → existing generic "Vul alle velden in" toast pattern in the create forms; PATCH partial-update semantics unchanged for edit). No new error paths introduced.

## Testing

No frontend test suite exists in this repo (no Jest/RTL config found). Verification happens via the `run` skill: start the dev server, manually walk through all 3 join-code flows and all 3 property-form contexts (including triggering the floor-count-zero confirmation in the edit form to confirm the bug fix), and confirm the migration applies cleanly against the Supabase project via the SQL editor before backend/frontend changes are considered done.
