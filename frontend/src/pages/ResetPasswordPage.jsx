import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Wachtwoord moet minstens 8 tekens bevatten");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("Wachtwoord succesvol gewijzigd!");
      navigate("/login", { replace: true });
    } catch (error) {
      // Meest voorkomende oorzaak: de resetlink is verlopen of al gebruikt —
      // Supabase's detectSessionInUrl kon dan geen geldige recovery-sessie
      // opzetten en updateUser() faalt met een auth-fout.
      toast.error(
        error.message?.includes("session")
          ? "Deze resetlink is verlopen of al gebruikt. Vraag een nieuwe aan."
          : "Wachtwoord wijzigen mislukt. Probeer het opnieuw."
      );
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

          <h1 className="text-3xl font-bold text-white font-['Outfit'] mb-2">
            Nieuw wachtwoord instellen
          </h1>
          <p className="text-slate-400 mb-6">
            Kies een nieuw wachtwoord voor je account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Nieuw wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="pl-10 pr-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Bevestig wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
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
              {loading ? "Bezig met wijzigen..." : "Wachtwoord wijzigen"}
            </Button>
          </form>

          <p className="mt-6 text-center text-slate-400">
            <Link to="/wachtwoord-vergeten" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Nieuwe resetlink aanvragen
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
