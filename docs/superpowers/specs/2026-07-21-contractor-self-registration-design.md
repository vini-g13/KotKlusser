# Contractor Self-Registration Design

New feature request (not from `kotklusser-cleanup-plan.md`), raised during the same session as the post-cleanup-plan sub-projects. Status: ontwerp goedgekeurd, klaar voor `writing-plans`.

## Context

The landing page (`LandingPage.jsx`) offers "Ik ben student" and "Ik ben verhuurder" registration CTAs, but no contractor entry point — despite a working contractor module already existing in the app. Investigation found the actual gap is narrower than it first appeared:

- **Login already works for contractors** — `LoginPage.jsx:27` already redirects a `role === 'contractor'` user to `/aannemer` post-login. No gap here.
- **Registering without an invite already works at the backend, accidentally** — `complete_registration` (`server.py`) only validates/consumes an invite token `if data.role == 'contractor' and data.invite_token:`. If no token is provided, this whole branch is skipped and the profile is created anyway with `role='contractor'` and no `contractor_landlord_links` row. This path has simply never been reachable from the UI, since the only existing entry point to `/register?role=contractor` is the invite email link, which always carries a token.
- **Landlords finding/assigning an unlinked contractor already works** — `GET /contractors/search` matches any `role='contractor'` profile regardless of existing links; `assign_contractor` creates the `contractor_landlord_links` row at assignment time if it doesn't already exist.

So the real gaps are: (1) no landing-page/registration-form entry point for a contractor to sign up without a token, and (2) the registration form has no UI at all for the `specialty`/`region` fields that the data model already supports.

During brainstorming, "private vs platform-tied" was simplified: every self-serve signup (no token) is private/unlinked by construction (no token → no invite consumed → no link), and every invite-link signup is tied to that inviting landlord by construction (existing behavior, unchanged). There is no scenario where a self-serve registrant needs to actively choose to link to a specific landlord at signup — an explicit toggle would only ever lead to one real outcome today, so the form instead just explains what "private" means.

**Separately raised and deliberately deferred**: the ability to scope a contractor's availability to specific properties rather than a landlord's entire portfolio (e.g. a Hasselt-based contractor should only be assignable to a landlord's Hasselt property, not their Gent one). This touches the `contractor_landlord_links` data model itself and is tracked as its own, separate design effort — not part of this spec.

## Scope

**In scope:**
1. Landing-page CTA for contractor signup.
2. `RegisterPage.jsx` role selector gains a third "Aannemer" option, with `specialty`/`region` inputs and explanatory copy for the no-token case.
3. `GET /contractors/search` extended to also match on `specialty`/`region`, so the newly-collected data is actually useful to landlords searching for a contractor.
4. Contractor-search placeholder text updated to reflect the new searchable fields.

**Out of scope:**
- Property-level scoping of contractor assignment (separate design effort, tracked apart per the user's request).
- Any change to the existing invite-link flow — unchanged.
- Any change to login — already works.

## Architecture & components

### `LandingPage.jsx`

Third CTA button in the existing `flex flex-wrap justify-center gap-4` row (`LandingPage.jsx:218-229`), styled consistently with the existing two (`variant="outline"`, matching the "Ik ben verhuurder" treatment):
```jsx
<Link to="/register?role=contractor">
  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" data-testid="cta-contractor-btn">
    Ik ben aannemer
  </Button>
</Link>
```

### `RegisterPage.jsx`

- Third role-selector button "Aannemer" alongside the existing Student/Verhuurder buttons (`RegisterPage.jsx:182-214`), following the same active/inactive styling pattern, using an appropriate icon (e.g. `HardHat`, already used elsewhere in the app for contractor context — `TicketDetail.jsx:16`).
- Two new text inputs, shown only when `formData.role === 'contractor'`: Specialiteit, Regio — plain free-text `Input`s (no existing dropdown/fixed-list convention for these fields anywhere in the app), added to `formData` state and included in `submitData` on submit (the backend model already accepts `specialty`/`region`, no payload restructuring needed).
- Explanatory paragraph, shown only when `formData.role === 'contractor' && !inviteToken`:
  > "Je registreert je als zelfstandig aannemer. Verhuurders op het platform kunnen je vinden en aan klussen toewijzen."

  When `inviteToken` is present (the existing invite-link flow), this text is not shown — that flow's existing behavior/copy is untouched.

### Backend: `search_contractors` (`server.py:1561-1581`)

Old:
```python
    pattern = f"%{q}%"
    rows = await fetch(
        """
        select pr.id, pr.name, au.email, pr.specialty, pr.region
        from profiles pr
        join auth.users au on au.id = pr.id
        where pr.role = 'contractor' and (pr.name ilike $1 or au.email ilike $1)
        limit 10
        """,
        pattern,
    )
```

New:
```python
    pattern = f"%{q}%"
    rows = await fetch(
        """
        select pr.id, pr.name, au.email, pr.specialty, pr.region
        from profiles pr
        join auth.users au on au.id = pr.id
        where pr.role = 'contractor' and (
            pr.name ilike $1 or au.email ilike $1 or pr.specialty ilike $1 or pr.region ilike $1
        )
        limit 10
        """,
        pattern,
    )
```

### `TicketDetail.jsx` contractor-search input (`TicketDetail.jsx:554`)

Placeholder text updated from `"Zoek op naam of e-mail..."` to `"Zoek op naam, e-mail, specialiteit of regio..."`.

## Data flow

No new endpoints, no request/response shape changes — `UserCreate`/`complete_registration` already accept `specialty`/`region`, this just adds the missing frontend inputs that let a self-serve contractor actually populate them. `search_contractors`'s response shape is unchanged, only its matching criteria widen.

## Error handling

No new error paths. Existing validation (required `name`, role-specific requirements) unchanged; `specialty`/`region` remain optional, consistent with the existing backend model.

## Testing

No frontend test suite exists in this repo. Manual verification: click "Ik ben aannemer" from the landing page, fill in the form (with specialty/region), submit, confirm a `profiles` row is created with `role='contractor'` and no `contractor_landlord_links` row; separately confirm the existing invite-link flow (`?token=...&role=contractor`) still works unchanged; as a landlord, search for the new contractor by specialty/region text from a ticket's contractor-assignment box and confirm they appear.
