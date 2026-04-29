import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Mail, MapPin, Instagram, Linkedin, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";
import { API } from "../App";

const Textarea = ({ className = "", ...props }) => (
  <textarea
    className={`flex w-full rounded-lg border border-white/10 bg-[#1C1A2E] px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none ${className}`}
    {...props}
  />
);

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const ContactPage = () => {
  const [form, setForm] = useState({
    naam: "",
    bedrijf: "",
    email: "",
    telefoon: "",
    bericht: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: "" });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!form.naam.trim()) newErrors.naam = "Naam is verplicht";
    if (!form.email.trim()) newErrors.email = "E-mailadres is verplicht";
    if (!form.bericht.trim()) newErrors.bericht = "Bericht is verplicht";
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/contact`, {
        name: form.naam,
        company: form.bedrijf || undefined,
        email: form.email,
        phone: form.telefoon || undefined,
        message: form.bericht,
      });
      toast.success("Bericht verzonden! We nemen spoedig contact op.");
      setSubmitted(true);
    } catch {
      toast.error("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      <LandingNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            {...fadeUp(0)}
            className="text-4xl sm:text-5xl font-bold text-white font-['Outfit'] mb-4"
          >
            Neem{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              contact op
            </span>
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-lg text-slate-400 max-w-xl mx-auto">
            Zit u nog met vragen of wilt u meer weten? Wij horen graag van u!
          </motion.p>
        </div>
      </section>

      {/* Content */}
      <section className="py-8 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12">
          {/* Left: info */}
          <motion.div {...fadeUp(0.15)}>
            <h2 className="text-xl font-semibold text-white mb-6">Bereik ons</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <span>contact@kotklusser.be</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <span>Limburg, België</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Instagram className="w-5 h-5" />
                </div>
                <a href="#" className="hover:text-indigo-400 transition-colors">Instagram</a>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                  <Linkedin className="w-5 h-5" />
                </div>
                <a href="#" className="hover:text-indigo-400 transition-colors">LinkedIn</a>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Sociale media coming soon.</p>
          </motion.div>

          {/* Right: form or success */}
          <motion.div {...fadeUp(0.2)}>
            <AnimatePresence mode="wait">
              {submitted ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#161425] border border-white/5 rounded-2xl p-8 text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Bericht ontvangen!</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    ✓ Bedankt voor uw bericht! We nemen zo snel mogelijk contact met u op via{" "}
                    <span className="text-indigo-400">contact@kotklusser.be</span>
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  className="bg-[#161425] border border-white/5 rounded-2xl p-6 space-y-4"
                >
                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Naam *</Label>
                    <Input
                      name="naam"
                      value={form.naam}
                      onChange={handleChange}
                      placeholder="Uw naam"
                      className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                    />
                    {errors.naam && <p className="text-xs text-red-400">{errors.naam}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Bedrijf</Label>
                    <Input
                      name="bedrijf"
                      value={form.bedrijf}
                      onChange={handleChange}
                      placeholder="Optioneel"
                      className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">E-mailadres *</Label>
                    <Input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="naam@email.com"
                      className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                    />
                    {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Telefoonnummer</Label>
                    <Input
                      name="telefoon"
                      type="tel"
                      value={form.telefoon}
                      onChange={handleChange}
                      placeholder="Optioneel"
                      className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-slate-300 text-sm">Bericht *</Label>
                    <Textarea
                      name="bericht"
                      value={form.bericht}
                      onChange={handleChange}
                      placeholder="Stel uw vraag of vertel ons meer..."
                      rows={5}
                      className="text-sm"
                    />
                    {errors.bericht && <p className="text-xs text-red-400">{errors.bericht}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || !form.naam.trim() || !form.email.trim() || !form.bericht.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white glow-primary disabled:opacity-50"
                  >
                    {loading ? "Versturen..." : "Verstuur bericht"}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default ContactPage;
