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

      <div className="grid grid-cols-[2fr_1fr] gap-4">
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
      </div>

      <div className="grid grid-cols-[1fr_2fr] gap-4">
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
