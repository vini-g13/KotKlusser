import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  ArrowLeft, ArrowRight, Check, Upload, X, 
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle,
  Home, Bath, CookingPot, DoorOpen, Building2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { id: 'sanitair', name: 'Sanitair', icon: <Wrench className="w-6 h-6" />, description: 'Kraan, toilet, douche, lekkage' },
  { id: 'elektriciteit', name: 'Elektriciteit', icon: <Zap className="w-6 h-6" />, description: 'Stopcontact, verlichting, zekering' },
  { id: 'verwarming', name: 'Verwarming', icon: <Flame className="w-6 h-6" />, description: 'Radiator, thermostaat, boiler' },
  { id: 'internet', name: 'Internet', icon: <Wifi className="w-6 h-6" />, description: 'Wifi, netwerk, kabel' },
  { id: 'keuken', name: 'Keuken', icon: <ChefHat className="w-6 h-6" />, description: 'Apparatuur, afvoer, koelkast' },
  { id: 'anders', name: 'Anders', icon: <HelpCircle className="w-6 h-6" />, description: 'Overige defecten' }
];

const locations = [
  { id: 'kamer', name: 'Slaapkamer', icon: <Home className="w-5 h-5" /> },
  { id: 'badkamer', name: 'Badkamer', icon: <Bath className="w-5 h-5" /> },
  { id: 'keuken', name: 'Keuken', icon: <CookingPot className="w-5 h-5" /> },
  { id: 'gang', name: 'Gang', icon: <DoorOpen className="w-5 h-5" /> },
  { id: 'gemeenschappelijk', name: 'Gemeenschappelijke ruimte', icon: <Building2 className="w-5 h-5" /> }
];

const urgencyLevels = [
  { id: 'low', name: 'Laag', description: 'Kan wachten', color: 'bg-slate-500' },
  { id: 'normal', name: 'Normaal', description: 'Binnen een week', color: 'bg-blue-500' },
  { id: 'high', name: 'Hoog', description: 'Zo snel mogelijk', color: 'bg-orange-500' },
  { id: 'urgent', name: 'Urgent', description: 'Onmiddellijk actie nodig', color: 'bg-red-500' }
];

const NewReport = () => {
  const { authAxios } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    location: '',
    urgency: 'normal',
    title: '',
    description: '',
    photos: []
  });

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleCategorySelect = (categoryId) => {
    setFormData({ ...formData, category: categoryId });
  };

  const handleLocationSelect = (locationId) => {
    setFormData({ ...formData, location: locationId });
  };

  const handleUrgencySelect = (urgencyId) => {
    setFormData({ ...formData, urgency: urgencyId });
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const readers = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(readers).then(results => {
      setFormData({ ...formData, photos: [...formData.photos, ...results] });
    });
  };

  const removePhoto = (index) => {
    const newPhotos = formData.photos.filter((_, i) => i !== index);
    setFormData({ ...formData, photos: newPhotos });
  };

  const canProceed = () => {
    switch (step) {
      case 1: return formData.category !== '';
      case 2: return formData.title !== '' && formData.description !== '' && formData.location !== '';
      case 3: return true; // Photos are optional
      case 4: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Create ticket
      const response = await authAxios.post('/tickets', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: formData.location,
        urgency: formData.urgency
      });
      
      // Upload photos if any
      if (formData.photos.length > 0) {
        for (const photo of formData.photos) {
          const blob = await fetch(photo).then(r => r.blob());
          const photoFormData = new FormData();
          photoFormData.append('file', blob, 'photo.jpg');
          await authAxios.post(`/tickets/${response.data.id}/photos`, photoFormData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      }
      
      toast.success(`Melding ${response.data.ticket_number} succesvol aangemaakt!`);
      navigate(`/ticket/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon melding niet aanmaken");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#12111F]/80 backdrop-blur-lg border-b border-white/5">
        <Progress value={progress} className="h-1 rounded-none bg-[#1C1A2E]" />
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center text-slate-400 hover:text-white group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Annuleren
          </Link>
          <span className="text-sm text-slate-400">Stap {step} van {totalSteps}</span>
        </div>
      </div>

      {/* Content */}
      <main className="pt-24 pb-32 px-4">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {/* Step 1: Category */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
                  Wat voor soort defect?
                </h1>
                <p className="text-slate-400 mb-8">Selecteer de categorie die het beste past</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        formData.category === cat.id
                          ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                          : 'bg-[#161425] border-white/5 text-white hover:border-white/20'
                      }`}
                      data-testid={`category-${cat.id}`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 ${
                        formData.category === cat.id ? 'bg-indigo-500/20' : 'bg-white/5'
                      }`}>
                        {cat.icon}
                      </div>
                      <h3 className="font-medium mb-1">{cat.name}</h3>
                      <p className="text-xs text-slate-400">{cat.description}</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
                  Beschrijf het probleem
                </h1>
                <p className="text-slate-400 mb-8">Geef zoveel mogelijk details</p>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-slate-300">Titel</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Bijv. Lekkende kraan in badkamer"
                      className="bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                      data-testid="title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-slate-300">Beschrijving</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Beschrijf het defect zo gedetailleerd mogelijk..."
                      rows={4}
                      className="bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 resize-none"
                      data-testid="description-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Locatie</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {locations.map((loc) => (
                        <button
                          key={loc.id}
                          onClick={() => handleLocationSelect(loc.id)}
                          className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                            formData.location === loc.id
                              ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400'
                              : 'bg-[#161425] border-white/5 text-slate-300 hover:border-white/20'
                          }`}
                          data-testid={`location-${loc.id}`}
                        >
                          {loc.icon}
                          {loc.id === 'gemeenschappelijk' ? (
                            <span className="text-sm">
                              <span className="sm:hidden">Gem. ruimte</span>
                              <span className="hidden sm:inline">Gemeenschappelijke ruimte</span>
                            </span>
                          ) : (
                            <span className="text-sm">{loc.name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300">Urgentie</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {urgencyLevels.map((urg) => (
                        <button
                          key={urg.id}
                          onClick={() => handleUrgencySelect(urg.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                            formData.urgency === urg.id
                              ? 'bg-indigo-600/20 border-indigo-500'
                              : 'bg-[#161425] border-white/5 hover:border-white/20'
                          }`}
                          data-testid={`urgency-${urg.id}`}
                        >
                          <div className={`w-3 h-3 rounded-full ${urg.color}`} />
                          <div className="text-left">
                            <p className={`text-sm font-medium ${formData.urgency === urg.id ? 'text-indigo-400' : 'text-white'}`}>
                              {urg.name}
                            </p>
                            <p className="text-xs text-slate-400">{urg.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Photos */}
            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
                  Voeg foto's toe
                </h1>
                <p className="text-slate-400 mb-8">Optioneel, maar helpt bij de beoordeling</p>

                <div className="space-y-4">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-48 rounded-xl border-2 border-dashed border-white/10 bg-[#161425] cursor-pointer hover:border-indigo-500/50 transition-colors"
                    data-testid="photo-upload-area"
                  >
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-white font-medium">Klik om foto's te uploaden</p>
                    <p className="text-sm text-slate-400 mt-1">of sleep ze hierheen</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      data-testid="photo-input"
                    />
                  </label>

                  {formData.photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                      {formData.photos.map((photo, idx) => (
                        <div key={idx} className="relative group">
                          <img 
                            src={photo} 
                            alt={`Foto ${idx + 1}`} 
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            onClick={() => removePhoto(idx)}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-photo-${idx}`}
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
                  Controleer uw melding
                </h1>
                <p className="text-slate-400 mb-8">Bevestig dat alle gegevens correct zijn</p>

                <div className="bg-[#161425] border border-white/5 rounded-xl p-6 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                      {categories.find(c => c.id === formData.category)?.icon}
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Categorie</p>
                      <p className="text-white font-medium">
                        {categories.find(c => c.id === formData.category)?.name}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <p className="text-sm text-slate-400 mb-1">Titel</p>
                    <p className="text-white font-medium">{formData.title}</p>
                  </div>

                  <div className="border-t border-white/5 pt-4">
                    <p className="text-sm text-slate-400 mb-1">Beschrijving</p>
                    <p className="text-slate-300">{formData.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Locatie</p>
                      <p className="text-white">{locations.find(l => l.id === formData.location)?.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Urgentie</p>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${urgencyLevels.find(u => u.id === formData.urgency)?.color}`} />
                        <p className="text-white">{urgencyLevels.find(u => u.id === formData.urgency)?.name}</p>
                      </div>
                    </div>
                  </div>

                  {formData.photos.length > 0 && (
                    <div className="border-t border-white/5 pt-4">
                      <p className="text-sm text-slate-400 mb-2">Foto's ({formData.photos.length})</p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {formData.photos.map((photo, idx) => (
                          <img 
                            key={idx}
                            src={photo} 
                            alt={`Foto ${idx + 1}`} 
                            className="w-20 h-20 object-cover rounded-lg shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#12111F]/80 backdrop-blur-lg border-t border-white/5 p-4">
        <div className="max-w-2xl mx-auto flex gap-4">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={prevStep}
              className="flex-1 border-white/10 text-white hover:bg-white/5"
              data-testid="prev-step-btn"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
          )}
          <Button
            onClick={nextStep}
            disabled={!canProceed() || loading}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 glow-primary"
            data-testid="next-step-btn"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Bezig...
              </span>
            ) : step === totalSteps ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Melding versturen
              </>
            ) : (
              <>
                Volgende
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NewReport;
