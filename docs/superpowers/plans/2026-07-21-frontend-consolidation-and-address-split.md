# Frontend Consolidation + Property Address Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate KotKlusser's triplicated join-code-verification and property-form logic into shared hooks/components, split `properties.address` into structured `street`/`house_number`/`postal_code`/`city` fields (matching sister project KotStart's data model ahead of the future platform merge), and fix the smaller consistency bugs found in the cleanup-plan audit (`propertiesUpdated` event, contractor API base-URL, dead code/inconsistent-await hygiene).

**Architecture:** The property address split lands first (backend model + Supabase migration), since every frontend property-form change is built directly against the new 4-field shape rather than being written once against `address` and reworked later. Two new shared pieces then get built once and wired into their 3 respective call sites each: `useJoinCodeVerification()` (join-code lookup) and `<PropertyFormFields>` + `useFloorCountConfirm()` + `<FloorCountConfirmDialog>` (property create/edit). The remaining items (`propertiesUpdated` dispatch, contractor base-URL, hygiene) are small, independent, mechanical fixes.

**Tech Stack:** React 18 (CRA/CRACO), Tailwind CSS, Shadcn UI (Dialog/Input/Label/Select), lucide-react icons, axios, FastAPI, asyncpg, Supabase Postgres.

## Global Constraints

- No frontend automated test suite exists in this repo — every "verify" step in this plan is a manual dev-server walkthrough (`npm start` in `frontend/`, plus `uvicorn server:app --reload` in `backend/` for the address-split task), not a `pytest`/`jest` run.
- `street`, `house_number`, `postal_code`, `city` are all **required** fields on `properties` (deliberately stricter than sister project KotStart, which leaves them nullable/optional — confirmed during brainstorming, not to be "fixed" to match KotStart).
- Every existing HTTP behavior/error message untouched by this plan (role checks, other validation) must keep working exactly as before — this plan touches property routes and join-code display only.
- `authAxios` (from `useAuth()`) is safe to call without a logged-in session — it conditionally omits the `Authorization` header, and `GET /properties/by-code/{code}` is a public, unauthenticated, rate-limited backend route. Never reach for raw `axios` + manual `${API}` prefix in code touched by this plan.

---

## File Structure

- **Create:** `supabase/migrations/20260721120000_split_property_address.sql`
- **Modify:** `backend/server.py` — `PropertyCreate`/`PropertyUpdate`/`PropertyResponse` models, `_property_row_to_response`, `create_property`, `update_property`, `get_property_by_code`.
- **Create:** `frontend/src/hooks/useJoinCodeVerification.js`
- **Create:** `frontend/src/components/PropertyFormFields.jsx`
- **Create:** `frontend/src/components/FloorCountConfirmDialog.jsx`
- **Create:** `frontend/src/hooks/useFloorCountConfirm.js`
- **Modify:** `frontend/src/lib/utils.js` — add `formatPropertyAddress()`.
- **Modify:** `frontend/src/pages/LandlordDashboard.jsx`, `PropertyOnboarding.jsx`, `LandlordProfilePage.jsx` — wire in the new shared property-form pieces; add missing `propertiesUpdated` dispatches.
- **Modify:** `frontend/src/pages/StudentDashboard.jsx`, `JoinProperty.jsx`, `RegisterPage.jsx` — wire in `useJoinCodeVerification`; display sites in `JoinProperty.jsx`/`PropertyDetail.jsx`/`LandlordProfilePage.jsx` swap to `formatPropertyAddress()`.
- **Modify:** `frontend/src/pages/AannemerDashboard.jsx`, `AannemerKlusDetail.jsx` — API base-URL fix.
- **Modify:** `frontend/src/pages/TicketDetail.jsx`, `ProfilePage.jsx`, `ContactPage.jsx` — hygiene fixes.

---

### Task 1: Backend — split `properties.address` into structured fields

**Files:**
- Create: `supabase/migrations/20260721120000_split_property_address.sql`
- Modify: `backend/server.py:248-264` (models), `backend/server.py:1225-1238` (`_property_row_to_response`), `backend/server.py:1241-1261` (`create_property`), `backend/server.py:1299-1332` (`update_property`), `backend/server.py:1466-1481` (`get_property_by_code`)

**Interfaces:**
- Produces: `PropertyResponse` now has `street: str`, `house_number: str`, `postal_code: str`, `city: str` instead of `address: str`. Every later task that displays or edits a property reads/writes these 4 fields.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260721120000_split_property_address.sql
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

- [ ] **Step 2: Apply the migration**

Run the SQL above in the Supabase project's SQL Editor (Supabase Dashboard → SQL Editor → paste → Run). Confirm it completes without error, then confirm the new columns exist:
```sql
select column_name, is_nullable from information_schema.columns where table_name = 'properties';
```
Expected: `street`, `house_number`, `postal_code`, `city` all `is_nullable = NO`; `address` no longer listed.

- [ ] **Step 3: Update the Pydantic models (`server.py:248-264`)**

Old:
```python
class PropertyCreate(BaseModel):
    name: str
    address: str
    floor_count: int = 5

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    floor_count: Optional[int] = None

class PropertyResponse(BaseModel):
    id: str
    name: str
    address: str
    landlord_id: str
    join_code: str
    join_link: str
```

New:
```python
class PropertyCreate(BaseModel):
    name: str
    street: str
    house_number: str
    postal_code: str
    city: str
    floor_count: int = 5

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    street: Optional[str] = None
    house_number: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    floor_count: Optional[int] = None

class PropertyResponse(BaseModel):
    id: str
    name: str
    street: str
    house_number: str
    postal_code: str
    city: str
    landlord_id: str
    join_code: str
    join_link: str
```

- [ ] **Step 4: Update `_property_row_to_response` (`server.py:1225-1238`)**

Old:
```python
def _property_row_to_response(prop: dict, tenant_count: int) -> PropertyResponse:
    floor_count = prop.get('floor_count', 5)
    return PropertyResponse(
        id=str(prop['id']),
        name=prop['name'],
        address=prop['address'],
        landlord_id=str(prop['landlord_id']),
        join_code=prop['join_code'],
        join_link=f"{APP_URL}/join/{prop['join_code']}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=prop['created_at'].isoformat(),
    )
```

New:
```python
def _property_row_to_response(prop: dict, tenant_count: int) -> PropertyResponse:
    floor_count = prop.get('floor_count', 5)
    return PropertyResponse(
        id=str(prop['id']),
        name=prop['name'],
        street=prop['street'],
        house_number=prop['house_number'],
        postal_code=prop['postal_code'],
        city=prop['city'],
        landlord_id=str(prop['landlord_id']),
        join_code=prop['join_code'],
        join_link=f"{APP_URL}/join/{prop['join_code']}",
        floor_count=floor_count,
        floors=generate_floors(floor_count),
        tenant_count=tenant_count,
        created_at=prop['created_at'].isoformat(),
    )
```

- [ ] **Step 5: Update `create_property` (`server.py:1241-1261`)**

Old:
```python
@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden aanmaken')

    property_id = uuid.uuid4()
    join_code = generate_join_code()
    while await fetchval("select 1 from properties where join_code = $1", join_code):
        join_code = generate_join_code()

    floor_count = max(0, min(prop.floor_count, 50))

    row = await fetchrow(
        """
        insert into properties (id, landlord_id, name, address, join_code, floor_count)
        values ($1, $2, $3, $4, $5, $6)
        returning *
        """,
        property_id, uuid.UUID(user['id']), prop.name, prop.address, join_code, floor_count,
    )
    return _property_row_to_response(row, 0)
```

New:
```python
@api_router.post("/properties", response_model=PropertyResponse)
async def create_property(prop: PropertyCreate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden aanmaken')

    property_id = uuid.uuid4()
    join_code = generate_join_code()
    while await fetchval("select 1 from properties where join_code = $1", join_code):
        join_code = generate_join_code()

    floor_count = max(0, min(prop.floor_count, 50))

    row = await fetchrow(
        """
        insert into properties (id, landlord_id, name, street, house_number, postal_code, city, join_code, floor_count)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        returning *
        """,
        property_id, uuid.UUID(user['id']), prop.name, prop.street, prop.house_number,
        prop.postal_code, prop.city, join_code, floor_count,
    )
    return _property_row_to_response(row, 0)
```

- [ ] **Step 6: Update `update_property` (`server.py:1299-1332`)**

Old:
```python
@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bijwerken')

    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    sets, args = [], []
    if update.name:
        args.append(update.name)
        sets.append(f"name = ${len(args)}")
    if update.address:
        args.append(update.address)
        sets.append(f"address = ${len(args)}")
    if update.floor_count is not None:
        args.append(max(0, min(update.floor_count, 50)))
        sets.append(f"floor_count = ${len(args)}")
```

New:
```python
@api_router.patch("/properties/{property_id}", response_model=PropertyResponse)
async def update_property(property_id: str, update: PropertyUpdate, user: dict = Depends(get_current_user)):
    if user['role'] != 'landlord':
        raise HTTPException(status_code=403, detail='Alleen verhuurders kunnen panden bijwerken')

    prop = await fetchrow(
        "select * from properties where id = $1 and landlord_id = $2",
        uuid.UUID(property_id), uuid.UUID(user['id']),
    )
    if not prop:
        raise HTTPException(status_code=404, detail='Pand niet gevonden')

    sets, args = [], []
    if update.name:
        args.append(update.name)
        sets.append(f"name = ${len(args)}")
    if update.street:
        args.append(update.street)
        sets.append(f"street = ${len(args)}")
    if update.house_number:
        args.append(update.house_number)
        sets.append(f"house_number = ${len(args)}")
    if update.postal_code:
        args.append(update.postal_code)
        sets.append(f"postal_code = ${len(args)}")
    if update.city:
        args.append(update.city)
        sets.append(f"city = ${len(args)}")
    if update.floor_count is not None:
        args.append(max(0, min(update.floor_count, 50)))
        sets.append(f"floor_count = ${len(args)}")
```

- [ ] **Step 7: Update `get_property_by_code` (`server.py:1466-1481`)**

Old:
```python
@api_router.get("/properties/by-code/{join_code}")
@limiter.limit("20/minute")
async def get_property_by_code(request: Request, join_code: str):
    """Public endpoint to verify join code and get property name and floors"""
    prop = await fetchrow("select * from properties where join_code = $1", join_code.upper())
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')

    floor_count = prop.get('floor_count', 5)
    return {
        'property_id': str(prop['id']),
        'property_name': prop['name'],
        'address': prop['address'],
        'floor_count': floor_count,
        'floors': generate_floors(floor_count),
    }
```

New:
```python
@api_router.get("/properties/by-code/{join_code}")
@limiter.limit("20/minute")
async def get_property_by_code(request: Request, join_code: str):
    """Public endpoint to verify join code and get property name and floors"""
    prop = await fetchrow("select * from properties where join_code = $1", join_code.upper())
    if not prop:
        raise HTTPException(status_code=404, detail='Ongeldige join code')

    floor_count = prop.get('floor_count', 5)
    return {
        'property_id': str(prop['id']),
        'property_name': prop['name'],
        'street': prop['street'],
        'house_number': prop['house_number'],
        'postal_code': prop['postal_code'],
        'city': prop['city'],
        'floor_count': floor_count,
        'floors': generate_floors(floor_count),
    }
```

- [ ] **Step 8: Verify locally**

```bash
cd backend && venv/Scripts/python.exe -m py_compile server.py && venv/Scripts/python.exe -c "import server; print('IMPORT OK')"
```
Expected: `IMPORT OK`. Then start the server (`venv/Scripts/python.exe -m uvicorn server:app --reload --host 0.0.0.0 --port 8000`) and manually create a property via `curl` or the (not-yet-updated) frontend dev tools/`httpie`, confirming the response contains `street`/`house_number`/`postal_code`/`city` and no `address` key.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260721120000_split_property_address.sql backend/server.py
git commit -m "feat: split properties.address into street/house_number/postal_code/city"
```

---

### Task 2: Frontend — shared property-form components

**Files:**
- Create: `frontend/src/components/PropertyFormFields.jsx`
- Create: `frontend/src/components/FloorCountConfirmDialog.jsx`
- Create: `frontend/src/hooks/useFloorCountConfirm.js`
- Modify: `frontend/src/lib/utils.js`

**Interfaces:**
- Produces: `<PropertyFormFields formData, onChange, testIdPrefix />` — controlled component, `formData` shape `{ name, street, house_number, postal_code, city, floor_count }`, `onChange(field, value)` callback.
- Produces: `useFloorCountConfirm(onConfirmedSubmit)` → `{ showConfirm, requestSubmit(floorCount), cancel, confirm }`. `requestSubmit` calls `onConfirmedSubmit` immediately if `floorCount !== 0`, otherwise opens the confirmation dialog and calls `onConfirmedSubmit` only once the user confirms.
- Produces: `<FloorCountConfirmDialog open, onCancel, onConfirm />`.
- Produces: `formatPropertyAddress({ street, house_number, postal_code, city })` in `frontend/src/lib/utils.js`, used by Tasks 4-6.

- [ ] **Step 1: `frontend/src/components/PropertyFormFields.jsx`**

```jsx
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Building2, MapPin } from "lucide-react";

const PropertyFormFields = ({ formData, onChange, testIdPrefix = "property" }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-slate-300">Naam van het pand</Label>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            value={formData.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Bijv. Studentenhuis De Brug"
            className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
            data-testid={`${testIdPrefix}-name`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Straat</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <Input
            value={formData.street}
            onChange={(e) => onChange("street", e.target.value)}
            placeholder="Bijv. Naamsestraat"
            className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
            data-testid={`${testIdPrefix}-street`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Huisnummer</Label>
          <Input
            value={formData.house_number}
            onChange={(e) => onChange("house_number", e.target.value)}
            placeholder="Bijv. 123"
            className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
            data-testid={`${testIdPrefix}-house-number`}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Postcode</Label>
          <Input
            value={formData.postal_code}
            onChange={(e) => onChange("postal_code", e.target.value)}
            placeholder="Bijv. 3000"
            className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
            data-testid={`${testIdPrefix}-postal-code`}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Stad</Label>
        <Input
          value={formData.city}
          onChange={(e) => onChange("city", e.target.value)}
          placeholder="Bijv. Leuven"
          className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
          data-testid={`${testIdPrefix}-city`}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-slate-300">Aantal verdiepingen</Label>
        <Input
          type="number"
          min="0"
          value={formData.floor_count === "" ? "" : formData.floor_count}
          onChange={(e) => onChange("floor_count", e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="Bijv. 3"
          className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
          data-testid={`${testIdPrefix}-floors`}
        />
        <p className="text-xs text-slate-500">
          {formData.floor_count === "" || formData.floor_count === 0
            ? "Genereert automatisch de verdiepingen van uw pand"
            : `Genereert automatisch: Gelijkvloers + Verdieping 1 t/m ${formData.floor_count}`}
        </p>
      </div>
    </div>
  );
};

export default PropertyFormFields;
```

- [ ] **Step 2: `frontend/src/components/FloorCountConfirmDialog.jsx`**

```jsx
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

const FloorCountConfirmDialog = ({ open, onCancel, onConfirm }) => (
  <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
    <DialogContent className="bg-[#161425] border-white/10">
      <DialogHeader>
        <DialogTitle className="text-white">Bevestiging aantal verdiepingen</DialogTitle>
      </DialogHeader>
      <p className="text-slate-300 py-2">
        Uw pand heeft enkel een gelijkvloers, zonder extra verdiepingen. Klopt dit?
      </p>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} className="border-white/10 text-white">
          Nee, aanpassen
        </Button>
        <Button onClick={onConfirm} className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="confirm-floor-zero">
          Ja, bevestigen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default FloorCountConfirmDialog;
```

- [ ] **Step 3: `frontend/src/hooks/useFloorCountConfirm.js`**

```js
import { useState, useRef } from "react";

export function useFloorCountConfirm(onConfirmedSubmit) {
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingSubmitRef = useRef(false);

  const requestSubmit = (floorCount) => {
    if (floorCount === 0) {
      setShowConfirm(true);
      return;
    }
    onConfirmedSubmit();
  };

  const cancel = () => setShowConfirm(false);

  const confirm = () => {
    setShowConfirm(false);
    onConfirmedSubmit();
  };

  return { showConfirm, requestSubmit, cancel, confirm };
}
```

- [ ] **Step 4: Add `formatPropertyAddress` to `frontend/src/lib/utils.js`**

Old:
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

New:
```js
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPropertyAddress({ street, house_number, postal_code, city }) {
  return `${street} ${house_number}, ${postal_code} ${city}`;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PropertyFormFields.jsx frontend/src/components/FloorCountConfirmDialog.jsx frontend/src/hooks/useFloorCountConfirm.js frontend/src/lib/utils.js
git commit -m "feat: add shared PropertyFormFields, FloorCountConfirmDialog, useFloorCountConfirm, formatPropertyAddress"
```

---

### Task 3: Wire property form into `LandlordDashboard.jsx` (create, sidebar Dialog)

**Files:**
- Modify: `frontend/src/pages/LandlordDashboard.jsx`

**Interfaces:**
- Consumes: `PropertyFormFields`, `FloorCountConfirmDialog`, `useFloorCountConfirm` from Task 2.

- [ ] **Step 1: Update `newPropertyData` state (line 87)**

Old:
```js
  const [newPropertyData, setNewPropertyData] = useState({ name: "", address: "", floor_count: "" });
```

New:
```js
  const [newPropertyData, setNewPropertyData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "",
  });
```

- [ ] **Step 2: Replace `submitNewProperty`/`createProperty` (lines 170-200) with the shared hook, and add the `propertiesUpdated` dispatch**

Old:
```js
  const submitNewProperty = async () => {
    setCreatingProperty(true);
    try {
      const response = await authAxios.post("/properties", newPropertyData);
      setProperties([...properties, response.data]);
      setNewPropertyData({ name: "", address: "", floor_count: "" });
      setShowNewProperty(false);
      await refreshUser();
      toast.success("Pand aangemaakt!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setCreatingProperty(false);
    }
  };

  const createProperty = async () => {
    if (!newPropertyData.name.trim() || !newPropertyData.address.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (newPropertyData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    if (newPropertyData.floor_count === 0) {
      setShowFloorConfirm(true);
      return;
    }
    await submitNewProperty();
  };
```

New:
```js
  const submitNewProperty = async () => {
    setCreatingProperty(true);
    try {
      const response = await authAxios.post("/properties", newPropertyData);
      setProperties([...properties, response.data]);
      setNewPropertyData({ name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "" });
      setShowNewProperty(false);
      await refreshUser();
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
      toast.success("Pand aangemaakt!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setCreatingProperty(false);
    }
  };

  const { showConfirm: showFloorConfirm, requestSubmit: requestCreateProperty, cancel: cancelFloorConfirm, confirm: confirmFloorConfirm } =
    useFloorCountConfirm(submitNewProperty);

  const createProperty = async () => {
    if (!newPropertyData.name.trim() || !newPropertyData.street.trim() || !newPropertyData.house_number.trim()
        || !newPropertyData.postal_code.trim() || !newPropertyData.city.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (newPropertyData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    requestCreateProperty(newPropertyData.floor_count);
  };
```

Note: this removes the standalone `showFloorConfirm`/`setShowFloorConfirm` `useState` at line 89 — delete that line, the hook now owns this state.

- [ ] **Step 3: Add the import (near the other local imports, e.g. after line 9)**

```js
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";
```

- [ ] **Step 4: Replace the form fields JSX inside the "Add property" Dialog (lines 323-370) with `<PropertyFormFields>`**

Old:
```jsx
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Naam van het pand</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={newPropertyData.name}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, name: e.target.value })}
                        placeholder="Bijv. Studentenhuis De Brug"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                        data-testid="new-property-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Adres</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={newPropertyData.address}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, address: e.target.value })}
                        placeholder="Bijv. Naamsestraat 123, 3000 Leuven"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                        data-testid="new-property-address"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Aantal verdiepingen</Label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        type="number"
                        min="0"
                        value={newPropertyData.floor_count === "" ? "" : newPropertyData.floor_count}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, floor_count: e.target.value === "" ? "" : Number(e.target.value) })}
                        placeholder="Bijv. 3"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                        data-testid="new-property-floors"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {newPropertyData.floor_count === "" || newPropertyData.floor_count === 0
                        ? "Genereert automatisch de verdiepingen van uw pand"
                        : `Genereert: Gelijkvloers + Verdieping 1 t/m ${newPropertyData.floor_count}`}
                    </p>
                  </div>
                </div>
```

New:
```jsx
                <div className="py-4">
                  <PropertyFormFields
                    formData={newPropertyData}
                    onChange={(field, value) => setNewPropertyData({ ...newPropertyData, [field]: value })}
                    testIdPrefix="new-property"
                  />
                </div>
```

- [ ] **Step 5: Replace the floor-confirm Dialog JSX (lines 530-556) with `<FloorCountConfirmDialog>`**

Old:
```jsx
      {/* Floor count confirmation dialog */}
      <Dialog open={showFloorConfirm} onOpenChange={setShowFloorConfirm}>
        <DialogContent className="bg-[#161425] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Bevestiging aantal verdiepingen</DialogTitle>
          </DialogHeader>
          <p className="text-slate-300 py-2">
            Uw pand heeft enkel een gelijkvloers, zonder extra verdiepingen. Klopt dit?
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFloorConfirm(false)}
              className="border-white/10 text-white"
            >
              Nee, aanpassen
            </Button>
            <Button
              onClick={() => { setShowFloorConfirm(false); submitNewProperty(); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="confirm-floor-zero"
            >
              Ja, bevestigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

New:
```jsx
      {/* Floor count confirmation dialog */}
      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />
```

- [ ] **Step 6: Verify**

Start `npm start` (frontend) + `uvicorn` (backend). Log in as a landlord, open "Pand toevoegen" in the sidebar, fill in name/street/house_number/postal_code/city, leave floor count at 0, submit → confirm the "enkel gelijkvloers" dialog appears, confirm it, and the new property appears in the sidebar list.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/LandlordDashboard.jsx
git commit -m "refactor: wire LandlordDashboard property-create form onto shared components"
```

---

### Task 4: Wire property form into `PropertyOnboarding.jsx` (create, full page)

**Files:**
- Modify: `frontend/src/pages/PropertyOnboarding.jsx`

- [ ] **Step 1: Update `formData` state (lines 17-21)**

Old:
```js
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    floor_count: ""
  });
```

New:
```js
  const [formData, setFormData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "",
  });
```

- [ ] **Step 2: Replace `submitProperty`/`handleSubmit` (lines 23-52) with the shared hook, and add the `propertiesUpdated` dispatch**

Old:
```js
  const submitProperty = async () => {
    setLoading(true);
    try {
      await authAxios.post("/properties", formData);
      await refreshUser();
      toast.success("Pand succesvol aangemaakt!");
      navigate("/verhuurder");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (formData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    if (formData.floor_count === 0) {
      setShowFloorConfirm(true);
      return;
    }
    await submitProperty();
  };
```

New:
```js
  const submitProperty = async () => {
    setLoading(true);
    try {
      await authAxios.post("/properties", formData);
      await refreshUser();
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
      toast.success("Pand succesvol aangemaakt!");
      navigate("/verhuurder");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setLoading(false);
    }
  };

  const { showConfirm: showFloorConfirm, requestSubmit: requestSubmitProperty, cancel: cancelFloorConfirm, confirm: confirmFloorConfirm } =
    useFloorCountConfirm(submitProperty);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.street.trim() || !formData.house_number.trim()
        || !formData.postal_code.trim() || !formData.city.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (formData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    requestSubmitProperty(formData.floor_count);
  };
```

Remove the now-unused `const [showFloorConfirm, setShowFloorConfirm] = useState(false);` at line 16.

- [ ] **Step 3: Add the import**

```js
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";
```

- [ ] **Step 4: Replace the form fields JSX (lines 78-132) with `<PropertyFormFields>`**

Old:
```jsx
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Naam van het pand</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Bijv. Studentenhuis De Brug"
                  required
                  className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="property-name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-slate-300">Adres</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Bijv. Naamsestraat 123, 3000 Leuven"
                  required
                  className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="property-address-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="floor_count" className="text-slate-300">Aantal verdiepingen</Label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="floor_count"
                  type="number"
                  min="0"
                  value={formData.floor_count === "" ? "" : formData.floor_count}
                  onChange={(e) => setFormData({ ...formData, floor_count: e.target.value === "" ? "" : Number(e.target.value) })}
                  placeholder="Bijv. 3"
                  className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12 [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                  data-testid="property-floors-input"
                />
              </div>
              <p className="text-xs text-slate-500">
                {formData.floor_count === "" || formData.floor_count === 0
                  ? "Genereert automatisch de verdiepingen van uw pand"
                  : `Genereert automatisch: Gelijkvloers + Verdieping 1 t/m ${formData.floor_count}`}
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
              disabled={loading}
              data-testid="create-property-btn"
            >
              <>
                Pand aanmaken
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            </Button>
          </form>
```

New:
```jsx
          <form onSubmit={handleSubmit} className="space-y-6">
            <PropertyFormFields
              formData={formData}
              onChange={(field, value) => setFormData({ ...formData, [field]: value })}
              testIdPrefix="property"
            />

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
              disabled={loading}
              data-testid="create-property-btn"
            >
              <>
                Pand aanmaken
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            </Button>
          </form>
```

- [ ] **Step 5: Replace the floor-confirm Dialog JSX (lines 153-178) with `<FloorCountConfirmDialog>`**

Old:
```jsx
      <Dialog open={showFloorConfirm} onOpenChange={setShowFloorConfirm}>
        <DialogContent className="bg-[#161425] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Bevestiging aantal verdiepingen</DialogTitle>
          </DialogHeader>
          <p className="text-slate-300 py-2">
            Uw pand heeft enkel een gelijkvloers, zonder extra verdiepingen. Klopt dit?
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFloorConfirm(false)}
              className="border-white/10 text-white"
            >
              Nee, aanpassen
            </Button>
            <Button
              onClick={() => { setShowFloorConfirm(false); submitProperty(); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="confirm-floor-zero"
            >
              Ja, bevestigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
```

New:
```jsx
      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />
```

- [ ] **Step 6: Verify**

Register a brand-new landlord account (or use one with no property yet) to land on `/onboarding/pand`, fill in the form with floor_count 0, confirm the dialog appears and works, confirm redirect to `/verhuurder` afterward.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/PropertyOnboarding.jsx
git commit -m "refactor: wire PropertyOnboarding onto shared property-form components"
```

---

### Task 5: Wire property form into `LandlordProfilePage.jsx` (edit, Dialog) — fixes the missing floor-confirm bug

**Files:**
- Modify: `frontend/src/pages/LandlordProfilePage.jsx`

- [ ] **Step 1: Update `editPropertyData` state (line 37)**

Old:
```js
  const [editPropertyData, setEditPropertyData] = useState({ name: "", address: "", floor_count: 0 });
```

New:
```js
  const [editPropertyData, setEditPropertyData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: 0,
  });
```

- [ ] **Step 2: Update `handleEditProperty` (lines 75-78)**

Old:
```js
  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setEditPropertyData({ name: prop.name, address: prop.address, floor_count: prop.floor_count ?? 0 });
  };
```

New:
```js
  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setEditPropertyData({
      name: prop.name, street: prop.street, house_number: prop.house_number,
      postal_code: prop.postal_code, city: prop.city, floor_count: prop.floor_count ?? 0,
    });
  };
```

- [ ] **Step 3: Update `handleSaveProperty` (lines 80-97) to go through the floor-confirm gate and dispatch on success (already dispatches today — keep that, just route through the hook)**

Old:
```js
  const handleSaveProperty = async () => {
    setSavingProperty(true);
    try {
      const response = await authAxios.patch(`/properties/${editingProperty.id}`, {
        name: editPropertyData.name,
        address: editPropertyData.address,
        floor_count: editPropertyData.floor_count
      });
      setProperties(properties.map(p => p.id === editingProperty.id ? response.data : p));
      setEditingProperty(null);
      toast.success("Pand succesvol bijgewerkt");
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet opslaan");
    } finally {
      setSavingProperty(false);
    }
  };
```

New:
```js
  const submitSaveProperty = async () => {
    setSavingProperty(true);
    try {
      const response = await authAxios.patch(`/properties/${editingProperty.id}`, {
        name: editPropertyData.name,
        street: editPropertyData.street,
        house_number: editPropertyData.house_number,
        postal_code: editPropertyData.postal_code,
        city: editPropertyData.city,
        floor_count: editPropertyData.floor_count,
      });
      setProperties(properties.map(p => p.id === editingProperty.id ? response.data : p));
      setEditingProperty(null);
      toast.success("Pand succesvol bijgewerkt");
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet opslaan");
    } finally {
      setSavingProperty(false);
    }
  };

  const { showConfirm: showFloorConfirm, requestSubmit: requestSaveProperty, cancel: cancelFloorConfirm, confirm: confirmFloorConfirm } =
    useFloorCountConfirm(submitSaveProperty);

  const handleSaveProperty = () => {
    if (!editPropertyData.name.trim() || !editPropertyData.street.trim() || !editPropertyData.house_number.trim()
        || !editPropertyData.postal_code.trim() || !editPropertyData.city.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    requestSaveProperty(editPropertyData.floor_count);
  };
```

- [ ] **Step 4: Add the import**

```js
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";
import { formatPropertyAddress } from "../lib/utils";
```

- [ ] **Step 5: Replace the properties-list address display (line 511)**

Old:
```jsx
                        <span className="truncate">{prop.address}</span>
```

New:
```jsx
                        <span className="truncate">{formatPropertyAddress(prop)}</span>
```

- [ ] **Step 6: Replace the edit-Dialog form fields (lines 569-596) with `<PropertyFormFields>`**

Old:
```jsx
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Naam</Label>
              <Input
                value={editPropertyData.name}
                onChange={(e) => setEditPropertyData({ ...editPropertyData, name: e.target.value })}
                className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Adres</Label>
              <Input
                value={editPropertyData.address}
                onChange={(e) => setEditPropertyData({ ...editPropertyData, address: e.target.value })}
                className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Aantal verdiepingen</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={editPropertyData.floor_count}
                onChange={(e) => setEditPropertyData({ ...editPropertyData, floor_count: parseInt(e.target.value) || 0 })}
                className="bg-[#1C1A2E] border-white/10 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>
          </div>
```

New:
```jsx
          <div className="py-4">
            <PropertyFormFields
              formData={editPropertyData}
              onChange={(field, value) => setEditPropertyData({ ...editPropertyData, [field]: value })}
              testIdPrefix="edit-property"
            />
          </div>
```

- [ ] **Step 7: Add `<FloorCountConfirmDialog>` right after the closing `</Dialog>` of the edit dialog (after line 615)**

```jsx
      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />
```

- [ ] **Step 8: Verify**

Open `/verhuurder/profiel`, edit an existing property, set floor count to 0, confirm the "enkel gelijkvloers" dialog now appears (it didn't before this task — this is the bug fix), confirm the save succeeds and the list shows the formatted address.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/LandlordProfilePage.jsx
git commit -m "fix: add missing floor-count-zero confirmation to property edit form, wire shared components"
```

---

### Task 6: Swap remaining `property.address` display sites to `formatPropertyAddress()`

**Files:**
- Modify: `frontend/src/pages/JoinProperty.jsx`
- Modify: `frontend/src/pages/PropertyDetail.jsx`

**Interfaces:**
- Consumes: `formatPropertyAddress` from `frontend/src/lib/utils.js` (Task 2). Also relies on the join-code lookup endpoint now returning `street`/`house_number`/`postal_code`/`city` instead of `address` (Task 1, Step 7) — so `property.address` in these files would already be `undefined` post-Task-1 if left unchanged; this task fixes that.

- [ ] **Step 1: `JoinProperty.jsx` — add the import**

```js
import { formatPropertyAddress } from "../lib/utils";
```

- [ ] **Step 2: `JoinProperty.jsx` line 93**

Old:
```jsx
              <p className="text-slate-400 mb-2">{property.address}</p>
```

New:
```jsx
              <p className="text-slate-400 mb-2">{formatPropertyAddress(property)}</p>
```

- [ ] **Step 3: `JoinProperty.jsx` line 236**

Old:
```jsx
          <p className="text-sm text-slate-500">{property.address}</p>
```

New:
```jsx
          <p className="text-sm text-slate-500">{formatPropertyAddress(property)}</p>
```

- [ ] **Step 4: `PropertyDetail.jsx` — add the import**

```js
import { formatPropertyAddress } from "../lib/utils";
```

- [ ] **Step 5: `PropertyDetail.jsx` line 117**

Old:
```jsx
            <p className="text-xs text-slate-400 truncate">{property.address}</p>
```

New:
```jsx
            <p className="text-xs text-slate-400 truncate">{formatPropertyAddress(property)}</p>
```

- [ ] **Step 6: `PropertyDetail.jsx` line 140**

Old:
```jsx
                <p className="text-slate-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {property.address}
                </p>
```

New:
```jsx
                <p className="text-slate-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {formatPropertyAddress(property)}
                </p>
```

- [ ] **Step 7: Verify**

Visit a property's join link (`/join/{code}`) and a landlord's `/verhuurder/pand/{id}` detail page (`PropertyDetail.jsx`'s route), confirm both show the full formatted address with no `undefined` fragments.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/JoinProperty.jsx frontend/src/pages/PropertyDetail.jsx
git commit -m "fix: display formatted street/house_number/postal_code/city instead of removed address field"
```

---

### Task 7: `useJoinCodeVerification()` hook + migrate its 3 call sites

**Files:**
- Create: `frontend/src/hooks/useJoinCodeVerification.js`
- Modify: `frontend/src/pages/StudentDashboard.jsx`
- Modify: `frontend/src/pages/JoinProperty.jsx`
- Modify: `frontend/src/pages/RegisterPage.jsx`

- [ ] **Step 1: Write the hook**

```js
// frontend/src/hooks/useJoinCodeVerification.js
import { useState, useCallback } from "react";
import { useAuth } from "../App";

export function useJoinCodeVerification() {
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

- [ ] **Step 2: `StudentDashboard.jsx` — replace local state/fetch (lines 48, 85-96) with the hook**

Old (state at line 48, function at lines 85-96):
```js
  const [propertyPreview, setPropertyPreview] = useState(null);
```
```js
  const verifyJoinCode = async () => {
    if (joinData.join_code.length < 6) {
      setPropertyPreview(null);
      return;
    }
    try {
      const response = await authAxios.get(`/properties/by-code/${joinData.join_code}`);
      setPropertyPreview(response.data);
    } catch (error) {
      setPropertyPreview(null);
    }
  };
```

New:
```js
  const { propertyInfo: propertyPreview, verifyJoinCode: verifyJoinCodeRaw } = useJoinCodeVerification();
  const verifyJoinCode = () => verifyJoinCodeRaw(joinData.join_code).catch(() => {});
```

(Aliasing `propertyInfo` to `propertyPreview` keeps every existing JSX reference to `propertyPreview` in this file working unchanged — no JSX edits needed in this file beyond this.)

Add the import:
```js
import { useJoinCodeVerification } from "../hooks/useJoinCodeVerification";
```

- [ ] **Step 3: `JoinProperty.jsx` — replace `fetchProperty` (lines 30-40) with the hook**

Old:
```js
  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API}/properties/by-code/${code}`);
      console.log("Fetched property:", response.data);
      setProperty(response.data);
    } catch (error) {
      toast.error("Ongeldige of verlopen uitnodigingscode");
    } finally {
      setLoading(false);
    }
  };
```

New:
```js
  const { propertyInfo: property, verifyJoinCode } = useJoinCodeVerification();

  const fetchProperty = async () => {
    try {
      await verifyJoinCode(code);
    } catch (error) {
      toast.error("Ongeldige of verlopen uitnodigingscode");
    } finally {
      setLoading(false);
    }
  };
```

Remove the old `const [property, setProperty] = useState(null);` at line 18 (replaced by the hook's `propertyInfo` aliased above) and the `import axios from "axios";` at line 11 (no longer used directly in this file — `useJoinCodeVerification` uses `authAxios` internally). Add:
```js
import { useJoinCodeVerification } from "../hooks/useJoinCodeVerification";
```

This also removes the `console.log("Fetched property:", response.data)` debug line as a side effect of the rewrite (also listed separately in Task 9's hygiene sweep — if Task 9 runs first, there is nothing left to remove here).

- [ ] **Step 4: `RegisterPage.jsx` — replace `verifyJoinCode` (lines 48-56) with the hook**

Old:
```js
  const verifyJoinCode = async (code) => {
    try {
      const response = await axios.get(`${API}/properties/by-code/${code}`);
      setPropertyInfo(response.data);
    } catch (error) {
      toast.error("Ongeldige uitnodigingscode");
      setFormData(prev => ({ ...prev, join_code: "" }));
    }
  };
```

New:
```js
  const { propertyInfo, verifyJoinCode: verifyJoinCodeRaw } = useJoinCodeVerification();

  const verifyJoinCode = async (code) => {
    try {
      await verifyJoinCodeRaw(code);
    } catch (error) {
      toast.error("Ongeldige uitnodigingscode");
      setFormData(prev => ({ ...prev, join_code: "" }));
    }
  };
```

Remove the old `const [propertyInfo, setPropertyInfo] = useState(null);` at line 37 (replaced by the hook). Add:
```js
import { useJoinCodeVerification } from "../hooks/useJoinCodeVerification";
```

`axios`/`API` imports in this file stay — `RegisterPage.jsx` still uses raw `axios` for the Stripe checkout-session call at line 108, unrelated to join-code verification.

- [ ] **Step 5: Verify all 3 flows**

1. `StudentDashboard.jsx`: open "Aansluiten" dialog, type a valid join code, blur the field, confirm the property preview appears and room/floor fields show up.
2. `JoinProperty.jsx`: visit `/join/{valid-code}` while logged out, confirm the invite screen shows the property name/address; visit `/join/{invalid-code}`, confirm the "ongeldige uitnodiging" toast/screen.
3. `RegisterPage.jsx`: visit `/register?role=student&join={valid-code}`, confirm the property preview + room/floor fields appear automatically.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useJoinCodeVerification.js frontend/src/pages/StudentDashboard.jsx frontend/src/pages/JoinProperty.jsx frontend/src/pages/RegisterPage.jsx
git commit -m "refactor: consolidate join-code verification into useJoinCodeVerification()"
```

---

### Task 8: Contractor API base-URL fix

**Files:**
- Modify: `frontend/src/pages/AannemerDashboard.jsx`
- Modify: `frontend/src/pages/AannemerKlusDetail.jsx`

- [ ] **Step 1: `AannemerDashboard.jsx` line 66**

Old:
```js
      const res = await authAxios.get(`${API}/contractor/tickets`);
```

New:
```js
      const res = await authAxios.get(`/contractor/tickets`);
```

- [ ] **Step 2: `AannemerKlusDetail.jsx` line 51**

Old:
```js
      const res = await authAxios.get(`${API}/contractor/tickets/${ticket_id}`);
```

New:
```js
      const res = await authAxios.get(`/contractor/tickets/${ticket_id}`);
```

- [ ] **Step 3: `AannemerKlusDetail.jsx` line 64**

Old:
```js
      await authAxios.patch(`${API}/contractor/tickets/${ticket_id}/status`, { status: nieuwStatus });
```

New:
```js
      await authAxios.patch(`/contractor/tickets/${ticket_id}/status`, { status: nieuwStatus });
```

- [ ] **Step 4: Remove the now-unused `API` import in both files if nothing else in the file references it**

Check with:
```bash
cd frontend/src/pages && grep -n "\bAPI\b" AannemerDashboard.jsx AannemerKlusDetail.jsx
```
If the only remaining occurrence in either file is the `import { useAuth, API } from "../App";` line itself, change that file's import to `import { useAuth } from "../App";`.

- [ ] **Step 5: Verify**

Log in as a contractor, open the aannemer dashboard (confirm the job list loads) and a job detail page (confirm it loads and a status update succeeds).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/AannemerDashboard.jsx frontend/src/pages/AannemerKlusDetail.jsx
git commit -m "fix: use relative paths against authAxios in contractor pages instead of manual API prefix"
```

---

### Task 9: Hygiene fixes

**Files:**
- Modify: `frontend/src/pages/TicketDetail.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/ContactPage.jsx`
- Modify: `frontend/src/pages/JoinProperty.jsx`
- Modify: `frontend/src/pages/LandlordDashboard.jsx`
- Modify: `frontend/src/pages/StudentDashboard.jsx`

- [ ] **Step 1: `TicketDetail.jsx` — remove dead `Image` import and `selectedImage` state (lines 14, 51)**

Old (line 14, part of a multi-line import):
```js
  ArrowLeft, Send, Upload, Clock, MapPin, User, Image, X,
```
New:
```js
  ArrowLeft, Send, Upload, Clock, MapPin, User, X,
```

Old (line 51):
```js
  const [selectedImage, setSelectedImage] = useState(null);
```
Delete this line entirely.

- [ ] **Step 2: `ProfilePage.jsx` — remove dead `ExternalLink` import and `logout` destructure (lines 12, 19)**

Old (line 12, part of a multi-line import):
```js
  Save, AlertCircle, Clock, Check, X, Edit3, Lock, ExternalLink
```
New:
```js
  Save, AlertCircle, Clock, Check, X, Edit3, Lock
```

Old (line 19):
```js
  const { user, authAxios, refreshUser, logout } = useAuth();
```
New:
```js
  const { user, authAxios, refreshUser } = useAuth();
```

- [ ] **Step 3: `ContactPage.jsx` — use the shared `Textarea` instead of the local one (lines 13-18)**

Old:
```jsx
const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`flex min-h-[120px] w-full rounded-md border border-white/10 bg-[#1C1A2E] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    {...props}
  />
);
```
Delete this local component definition entirely, and add the import near the other component imports:
```js
import { Textarea } from "../components/ui/textarea";
```
(Check the existing usage at line 205 renders correctly with the shared component's default styling — the shared `components/ui/textarea.jsx` already matches this dark theme per the design system, since every other page in the app uses it unmodified.)

- [ ] **Step 4: `JoinProperty.jsx` — confirm the debug `console.log` is gone**

If Task 7 already replaced `fetchProperty` (which removed this line as a side effect), skip this step. Otherwise remove line 33: `console.log("Fetched property:", response.data);`.

- [ ] **Step 5: `LandlordDashboard.jsx` line 165-168 — add missing `await`**

Old:
```js
  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };
```

New:
```js
  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };
```

- [ ] **Step 6: `StudentDashboard.jsx` line 79-83 — add missing `await`**

Old:
```js
  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };
```

New:
```js
  const handleLogout = async () => {
    await logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };
```

- [ ] **Step 7: Verify**

Start the dev server, confirm it compiles with no unused-variable warnings for the touched files, open a ticket detail page, a profile page, the contact page (submit the form once), and log out from both a landlord and student account.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/TicketDetail.jsx frontend/src/pages/ProfilePage.jsx frontend/src/pages/ContactPage.jsx frontend/src/pages/JoinProperty.jsx frontend/src/pages/LandlordDashboard.jsx frontend/src/pages/StudentDashboard.jsx
git commit -m "chore: remove dead code, use shared Textarea, add missing await on logout()"
```

---

### Task 10: Final manual regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full walkthrough checklist** (dev server + local backend running)

- [ ] Register a new landlord → onboarding property form (4 address fields + floor count 0 → confirm dialog appears) → lands on `/verhuurder`.
- [ ] From the dashboard sidebar, add a second property (floor count > 0, no confirm dialog expected).
- [ ] Edit an existing property from `/verhuurder/profiel`, set floor count to 0 → confirm dialog now appears (bug fix) → save → list shows formatted address.
- [ ] Delete a property from `/verhuurder/profiel` → confirm the dashboard sidebar list updates without a manual refresh (tests the `propertiesUpdated` fix).
- [ ] Register a new student with a join code in the URL (`/register?role=student&join={code}`) → property preview appears → complete registration.
- [ ] From an already-registered student's dashboard, join a second property via the "Aansluiten" dialog.
- [ ] Visit a `/join/{code}` link directly while logged out → invite screen shows correctly.
- [ ] Log in as a contractor → dashboard job list loads → open a job detail → update its status successfully.
- [ ] Log out from a landlord account and a student account, confirm both redirect and toast correctly.
- [ ] Submit the public contact form (`/contact`) and confirm the textarea still renders and submits correctly.

- [ ] **Step 2: Confirm no leftover references to the removed `address` field**

```bash
cd frontend/src && grep -rn "\.address\b" pages/ components/
```
Expected: no output.

```bash
cd backend && grep -n "'address'\|\.address\b" server.py
```
Expected: no output.

- [ ] **Step 3: Final commit (if anything outstanding)**

```bash
git status
```

---

## Self-Review Notes

- **Spec coverage:** all 5 original section-3.4 items (join-code hook, property-form consolidation, `propertiesUpdated` consistency, contractor base-URL, hygiene) plus the address-split addition are each covered by a dedicated task.
- **Type/shape consistency:** `PropertyFormFields`' `formData` shape (`name/street/house_number/postal_code/city/floor_count`) is identical across Tasks 3, 4, 5. `useFloorCountConfirm(onConfirmedSubmit)`'s returned `{ showConfirm, requestSubmit, cancel, confirm }` shape is used identically in all 3 wiring tasks. `formatPropertyAddress({street, house_number, postal_code, city})` matches `PropertyResponse`'s new shape from Task 1.
- **Sequencing:** Task 1 (backend) intentionally precedes every frontend task, since Tasks 3-7 write code directly against the new 4-field shape rather than against the old `address` field.
