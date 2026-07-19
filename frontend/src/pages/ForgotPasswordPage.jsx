import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Bewust gén error tonen die verraadt of het account bestaat — altijd
      // dezelfde success-state, ongeacht wat Supabase intern doet.
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/wachtwoord-resetten`,
      });
      setSent(true);
    } catch (error) {
      toast.error("Er ging iets mis. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0B0A14] flex">
      <div className="flex flex-col justify-center overflow-y-auto pt-16 py-8 px-4 sm:px-6 lg:px-20 xl:px-24 w-full">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          <Link to="/login" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xl font-bold text-white font-['Outfit']">
              Kot<span className="text-indigo-500">Klusser</span>
            </span>
          </Link>

          {sent ? (
            <>
              <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold text-white font-['Outfit'] mb-2">
                Check je inbox
              </h1>
              <p className="text-slate-400 mb-6">
                Als er een account bestaat voor <span className="text-white">{email}</span>, hebben we
                een e-mail gestuurd met een link om je wachtwoord opnieuw in te stellen.
              </p>
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                Terug naar inloggen
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-white font-['Outfit'] mb-2">
                Wachtwoord vergeten
              </h1>
              <p className="text-slate-400 mb-6">
                Vul je e-mailadres in en we sturen je een link om een nieuw wachtwoord in te stellen.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="naam@email.com"
                      required
                      className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
                  disabled={loading}
                >
                  {loading ? "Bezig met versturen..." : "Verstuur resetlink"}
                </Button>
              </form>

              <p className="mt-6 text-center text-slate-400">
                Weet je je wachtwoord weer?{" "}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Log in
                </Link>
              </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
