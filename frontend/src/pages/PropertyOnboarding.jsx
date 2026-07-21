import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";

const PropertyOnboarding = () => {
  const { authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "",
  });

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
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          U kunt later meer panden toevoegen via het dashboard
        </p>
      </motion.div>

      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />
    </div>
  );
};

export default PropertyOnboarding;
