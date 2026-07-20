# Backend duplicatie-cleanup + test-infrastructuur modernisering — Design

Sub-project A uit de vervolgronde op `kotklusser-cleanup-plan.md` (secties 3.3 + het testvangnet ervoor). Status: ontwerp goedgekeurd, klaar voor `writing-plans`.

## Context

`kotklusser-cleanup-plan.md` (16 juli 2026) beschrijft sectie 3.3 als "backend-duplicatie wegwerken". Een audit tegen de huidige code (na de Supabase-migratie van sprint 5, sectie 6.5) toont dat een deel van sectie 3.3 al stilzwijgend is opgelost:

- `send_followup_emails`-duplicatie: **al opgelost** — `cron_followup.py` importeert nu rechtstreeks uit `server.py`.
- `TicketResponse`-opbouw "4x": **al opgelost** — nog maar 1 occurrence (`server.py:1799`).
- "Haal pand-ID's van deze verhuurder"-query: **deels opgelost** — nog 2 identieke occurrences (`server.py:1919`, `server.py:2348`), niet 5 zoals de planningdoc stelt.
- Rolcontroles (`if user['role'] != '...'`): **nog steeds aanwezig**, en er zijn er méér dan de planningdoc claimt — **31 occurrences**, niet 22 (`server.py` regels 880, 933, 948, 1011, 1100, 1143, 1243, 1266, 1285, 1301, 1336, 1356, 1380, 1414, 1441, 1486, 1510, 1563, 1586, 1625, 1684, 1698, 1731, 1774, 1963, 1991, 2028, 2084, 2267, 2331, 2344). Elke check heeft een eigen, unieke `HTTPException(403, detail=...)`-tekst — geen enkele is generiek.

Tijdens het brainstormen bleek dat de bestaande backend-tests (`backend/tests/test_floor_configuration.py`, root-`backend_test.py`) volledig tegen de **oude custom-JWT-auth** zijn geschreven (`POST /auth/register`/`POST /auth/login` → `{"token": ...}`). Die routes bestaan sinds de Supabase-migratie niet meer — enkel `/auth/me` bleef over. Beide testbestanden zouden vandaag dus meteen 404'en op hun eigen auth-bootstrap. `backend_test.py` heeft bovendien nog de oude Emergent-preview-URL als hardcoded default `base_url`.

De gebruiker heeft expliciet gekozen om dit testvangnet eerst te herstellen (naar het huidige Supabase Auth-model) vóór de eigenlijke refactor, in plaats van de refactor enkel handmatig te verifiëren. Dit maakt sub-project A twee fases in plaats van één.

## Scope

**In scope:**
1. Test-infrastructuur moderniseren naar Supabase Auth (beide bestaande testbestanden).
2. `require_role()`-dependency invoeren, alle 31 call-sites migreren.
3. `get_landlord_property_ids()`-helper invoeren, beide call-sites migreren.

**Expliciet buiten scope** (YAGNI / apart traject):
- Geen algemene RBAC/permissie-tabel — er bestaat vandaag geen route die meerdere rollen toestaat, dus `require_role()` blijft single-role.
- Geen herschrijving van de class-based structuur van `backend_test.py` — enkel de auth-bootstrap en de hardcoded base-URL worden vervangen, de rest van de 951 regels blijft in zijn bestaande vorm/stijl.
- Timestamps-als-ISO-strings (sectie 3.3, laatste bullet) — expliciet uitgesteld tot de latere Postgres-schema-iteratie, niet nu aanpakken.
- Sectie 3.4 (frontend-duplicatie) en de overige secties (5, 6.2) — aparte sub-projecten, elk met een eigen ontwerp.

## Architectuur & componenten

### Fase 1 — Test-auth-helper

Nieuw bestand `backend/tests/conftest.py` met een herbruikbare fixture-factory:

```python
def create_confirmed_test_user(role: str, **profile_fields) -> tuple[dict, str]:
    """
    1. supabase_admin.auth.admin.create_user(email=..., password=..., email_confirm=True)
       — service-role Admin API, omzeilt de mailbevestigingsstap volledig.
    2. supabase_anon.auth.sign_in_with_password(...) — haalt een echte sessie-
       access_token op, exact zoals de frontend na signUp() zou doen.
    3. requests.post(f"{BASE_URL}/api/profile/complete-registration", json={role, ...},
       headers={"Authorization": f"Bearer {access_token}"})
       — vervolledigt de profiles-rij, exact de bestaande productieflow.
    Retourneert (user_dict, access_token).
    """
```

Gebruikt dezelfde `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` env vars als `server.py` zelf (uit `backend/.env`), geen nieuwe configuratie nodig.

Reden voor dit patroon i.p.v. iets simpelers: dit is de enige manier om een bruikbare, backend-geverifieerde sessietoken te krijgen zonder een echte e-mail te moeten bevestigen, én het oefent tegelijk de echte registratie-flow uit (`complete-registration`) i.p.v. een testspecifieke shortcut die met de productiecode uit de pas zou kunnen lopen.

### Fase 1 — Migratie van de twee testbestanden

- `test_floor_configuration.py`: de bestaande `landlord_token`/`authenticated_landlord`-fixtures (regels 34-57) vervangen door calls naar de nieuwe helper. Vaste testaccounts (`test_landlord_floor@test.com` etc.) blijven behouden als patroon — enkel de manier waarop een token verkregen wordt verandert.
- `backend_test.py`: `base_url`-default (regel 15) wijzigt naar `os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000')` — consistent met het patroon in `test_floor_configuration.py`, en lokaal draaibaar zonder Railway-afhankelijkheid. `test_register_student`/`test_register_landlord`-methodes (en eventuele login-methodes) roepen de nieuwe helper aan i.p.v. de non-existente `/auth/register`/`/auth/login`. De rest van de 951 regels (ticket-, messaging-, stats-tests) blijft in structuur ongewijzigd; enkel calls die op het token/de user-vorm uit de oude auth-respons steunen worden aangepast waar nodig.

### Fase 2 — De refactor

```python
def require_role(role: str, detail: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user['role'] != role:
            raise HTTPException(status_code=403, detail=detail)
        return user
    return checker
```
Geplaatst naast de bestaande `get_current_user` (rond `server.py:462`). Elke van de 31 call-sites migreert van `Depends(get_current_user)` + losse `if`-check naar `Depends(require_role(role, exact_bestaande_detail_tekst))` — geen enkele foutmelding verandert van tekst.

```python
async def get_landlord_property_ids(landlord_id: str) -> list[str]:
    rows = await fetch("select id from properties where landlord_id = $1", uuid.UUID(landlord_id))
    return [r['id'] for r in rows]
```
Vervangt de 2 identieke occurrences (`server.py:1919`, `2348`).

## Data flow

Fase 1 introduceert geen nieuwe productiecode-paden — de tests roepen exact dezelfde publieke flow aan die de frontend ook gebruikt (Supabase signUp/sign-in → `complete-registration` → Bearer-token op alle verdere calls). Fase 2 is een zuivere interne refactor: identieke requests/responses, identieke HTTP-statussen, identieke foutteksten. Geen enkel bestaand frontend-gedrag kan hierdoor breken.

## Error handling

Ongewijzigd in fase 2 (zie hierboven). In fase 1: als `create_user` faalt omdat het testaccount al bestaat (herhaalde testruns), valt de fixture terug op direct inloggen met de bestaande vaste testcredentials — zelfde "login-first-dan-registreren"-patroon dat `test_floor_configuration.py` vandaag al hanteert.

## Testing

Dit sub-project **is** het testwerk voor zichzelf: fase 1 levert het vangnet, fase 2 wordt ertegen geverifieerd door de gemigreerde suites lokaal te draaien tegen een lokaal draaiende `uvicorn server:app --reload` (met de inmiddels ingevulde `backend/.env`). Geen aparte nieuwe testronde nodig buiten deze twee bestanden.
