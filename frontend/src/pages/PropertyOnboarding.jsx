import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Building2, MapPin, ArrowRight, Sparkles, Layers } from "lucide-react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";

const PropertyOnboarding = () => {
  const { authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showFloorConfirm, setShowFloorConfirm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    floor_count: ""
  });

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

  return (
    <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
            Welkom bij KotKlusser!
          </h1>
          <p className="text-slate-400">
            Laten we beginnen met het toevoegen van uw eerste pand
          </p>
        </div>

        {/* Form */}
        <div className="bg-[#161425] border border-white/5 rounded-2xl p-6">
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
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          U kunt later meer panden toevoegen via het dashboard
        </p>
      </motion.div>

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
    </div>
  );
};

export default PropertyOnboarding;
