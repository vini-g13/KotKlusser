import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Building2, MapPin, ArrowRight, Sparkles, Layers } from "lucide-react";
import { motion } from "framer-motion";

const PropertyOnboarding = () => {
  const { authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    floor_count: 5
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim()) {
      toast.error("Vul alle velden in");
      return;
    }

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
            Welkom bij KotMelding!
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
                  max="50"
                  value={formData.floor_count}
                  onChange={(e) => setFormData({ ...formData, floor_count: parseInt(e.target.value) || 0 })}
                  placeholder="5"
                  className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="property-floors-input"
                />
              </div>
              <p className="text-xs text-slate-500">
                Genereert automatisch: Gelijkvloers + Verdieping 1 t/m {formData.floor_count}
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
              disabled={loading}
              data-testid="create-property-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Aanmaken...
                </span>
              ) : (
                <>
                  Pand aanmaken
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          U kunt later meer panden toevoegen via het dashboard
        </p>
      </motion.div>
    </div>
  );
};

export default PropertyOnboarding;
