# TicketDetail / AannemerKlusDetail — Shared Sub-components Design

Sub-project B2 from the vervolgronde op `kotklusser-cleanup-plan.md` (sectie 3.4, the architecture question deferred from B1). Status: ontwerp goedgekeurd, klaar voor `writing-plans`.

## Context

`TicketDetail.jsx` (692 lines, route `/ticket/:id`, used by landlord + student) and `AannemerKlusDetail.jsx` (276 lines, route `/aannemer/klus/:ticket_id`, contractor-only) are two parallel implementations of "view a single ticket." The cleanup-plan flagged this as duplication worth merging.

Investigation during brainstorming found the two screens are **functionally different, not just visually duplicated**:
- `TicketDetail.jsx` contains a full messaging/chat panel (message list, date separators, input box) — this is core to the landlord↔student screen.
- `AannemerKlusDetail.jsx` has **no messaging UI at all** — contractors currently cannot see or send chat messages on a ticket.
- The backend's general ticket routes (`_get_ticket_with_access_check` in `server.py`, used by both `GET /tickets/{id}` and `POST/GET /tickets/{id}/messages`) already permit contractors assigned to a ticket — so a full merge onto one shared route would technically work at the API level, and would newly expose the chat panel to contractors as a side effect.
- `CLAUDE.md`'s planned KotKlusser+ Aannemersmodule explicitly states: *"Student ziet alleen statusupdates, niet wie de aannemer is"* — giving contractors the same chat panel as landlord/student would let a student see messages from/to the contractor (including their name, per the existing `msg.sender_name` chat-bubble display), directly conflicting with that planned privacy model.

**Decision**: do not merge the two screens/routes. Keep `TicketDetail.jsx` and `AannemerKlusDetail.jsx` as separate top-level page components (no chat access added for contractors, no product-behavior change). Instead, extract the pieces that are genuinely the same presentation of the same data into small shared components, used by both pages.

Three extraction candidates were identified by comparing the two files line-by-line:

1. **Status stepper** — both files render a 4-step `sent → received → in_progress → resolved` progress indicator, with different visual treatments (`TicketDetail.jsx:292-320`: square numbered circles; `AannemerKlusDetail.jsx:120-156`: round circles + checkmarks + colored connecting line). Same data, same 4 steps, no reason to keep 2 visual styles — the `AannemerKlusDetail.jsx` version (round circles + checkmarks) was chosen as the one canonical look.
2. **Photo gallery** — `TicketDetail.jsx:387-410` renders clickable thumbnails that open a `Dialog` lightbox to view full-size; `AannemerKlusDetail.jsx:247-270` renders a static, non-clickable 2-column grid. The lightbox version is strictly better UX with no downside for the contractor view, so it becomes the one canonical implementation (a small upgrade for the contractor screen as a side effect).
3. **Urgency badge** — exists today only in `AannemerKlusDetail.jsx:109-113` (a colored pill using `URGENCY_CONFIG`). Investigation found `TicketDetail.jsx` **never displays ticket urgency at all** — confirmed via full-text search, no `ticket.urgency` reference anywhere in the file. This looks like an oversight, not a deliberate omission (urgency is shown on dashboards, just not on this detail page). The extracted `<UrgencyBadge>` will be added to `TicketDetail.jsx` too, not just shared where it already existed.

**Explicitly NOT extracted — the details grid.** `TicketDetail.jsx`'s grid shows Categorie/Locatie/**Gemeld door** (reporting student's name)/Aangemaakt; `AannemerKlusDetail.jsx`'s grid shows **Pand** (property name)/Locatie/Categorie/Gemeld op. These aren't the same data styled differently — landlord/student already know which property they're looking at (contextual) and need to know who reported it; the contractor works across multiple properties/landlords and needs to know which property, but (consistent with the same privacy direction noted above) is never shown who personally reported the ticket. Forcing these into one configurable component would add complexity to preserve a difference that exists for a good reason. Left as two separate, independently-maintained grids.

**Noted but out of scope for this sub-project**: the user wants to eventually remove the urgency field/label entirely (tracked in memory `project_urgentie_label_verwijderen.md` — students reportedly always pick "urgent" regardless of real severity, so the field carries no signal). This sub-project's `<UrgencyBadge>` work proceeds as planned; the future removal is a separate, later piece of work.

## Scope

**In scope:**
1. `<TicketStatusStepper status />` — extracted from `AannemerKlusDetail.jsx`'s visual style, used by both pages.
2. `<TicketPhotoGallery photos />` — extracted from `TicketDetail.jsx`'s lightbox version, used by both pages (contractor screen gains click-to-enlarge as a side effect).
3. `<UrgencyBadge urgency />` — extracted from `AannemerKlusDetail.jsx`, used by both pages (`TicketDetail.jsx` gains an urgency display it didn't have before).

**Explicitly out of scope:**
- Merging the two page components/routes into one.
- Giving contractors chat/messaging access.
- The details-grid duplication (different field sets, intentionally left separate).
- Removing the urgency field entirely (separate, later, tracked in memory).

## Architecture & components

### `<TicketStatusStepper status />` — new `frontend/src/components/TicketStatusStepper.jsx`

Presentational component taking the ticket's `status` string (`sent`/`received`/`in_progress`/`resolved`) and rendering the round-circle/checkmark/connecting-line design currently in `AannemerKlusDetail.jsx:120-156`, generalized to use `TicketDetail.jsx`'s existing `statusLabels`/`statusOrder` constants (Dutch labels: Verstuurd/Ontvangen/In Behandeling/Opgelost) so both pages share one source of truth for the label text too, not just the visual shell.

### `<TicketPhotoGallery photos />` — new `frontend/src/components/TicketPhotoGallery.jsx`

Takes an array of already-signed photo URLs (both backends already return ready-to-use signed URLs, no path-building needed). Renders `TicketDetail.jsx`'s horizontal-scroll thumbnail row, each opening a `Dialog` lightbox on click (reusing the existing `components/ui/dialog.jsx`), exactly as `TicketDetail.jsx` does today. `AannemerKlusDetail.jsx` switches from its static grid to this component.

### `<UrgencyBadge urgency />` — new `frontend/src/components/UrgencyBadge.jsx`

Extracted `URGENCY_CONFIG` map + pill-badge JSX from `AannemerKlusDetail.jsx:25-30,109-113`. `AannemerKlusDetail.jsx` swaps its inline badge for this component; `TicketDetail.jsx` gains a new badge (placed next to the existing status `Badge` in its header, `TicketDetail.jsx:275-277`).

## Data flow

No backend changes. No new API calls — all 3 components are purely presentational, driven entirely by data both pages already fetch (`ticket.status`/`klus.status`, `ticket.photos`/`klus.photos`, `klus.urgency`/`ticket.urgency`). Confirmed: `TicketResponse` (`server.py:357`) already includes `urgency: str`, so `TicketDetail.jsx` already receives the field today — it's simply never rendered. No backend change is needed to add the badge to `TicketDetail.jsx`.

## Error handling

No new error paths — these are pure rendering components with no I/O of their own.

## Testing

No frontend test suite exists in this repo. Verification: manual walkthrough of both `/ticket/:id` (as landlord and as student) and `/aannemer/klus/:id` (as contractor), confirming the status stepper, photo lightbox, and urgency badge all render correctly and match the previous visual behavior (plus the two intentional upgrades: contractor gets lightbox photos, landlord/student get an urgency badge).
