import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const user = await login(email, password);
      toast.success(`Welkom terug, ${user.name}!`);
      const defaultPath = user.role === 'landlord' ? '/verhuurder' : user.role === 'contractor' ? '/aannemer' : '/dashboard';
      const from = location.state?.from?.pathname || defaultPath;
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0B0A14] flex">
      {/* Left side - Form */}
      <div className="flex flex-col justify-center overflow-y-auto pt-16 py-8 px-4 sm:px-6 lg:px-20 xl:px-24">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xl font-bold text-white font-['Outfit']">
              Kot<span className="text-indigo-500">Klusser</span>
            </span>
          </Link>

          <h1 className="text-3xl font-bold text-white font-['Outfit'] mb-2">
            Welkom terug
          </h1>
          <p className="text-slate-400 mb-6">
            Log in om uw meldingen te bekijken
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
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Wachtwoord</Label>
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
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="text-right">
                <Link to="/wachtwoord-vergeten" className="text-sm text-slate-400 hover:text-indigo-400">
                  Wachtwoord vergeten?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
              disabled={loading}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Bezig met inloggen...
                </span>
              ) : (
                "Inloggen"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-slate-400">
            Nog geen account?{" "}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Registreer hier
            </Link>
          </p>
        </motion.div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B0A14] to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1768548273807-275b0e16fff3?w=800&h=1200&fit=crop"
          alt="Student housing"
          className="w-full h-full object-cover brightness-50"
        />
        <div className="absolute bottom-12 left-12 right-12 z-20">
          <blockquote className="text-white text-xl font-medium">
            "Eindelijk een systeem waarbij ik mijn defecten snel kan melden en de status kan volgen!"
          </blockquote>
          <p className="mt-4 text-slate-400">— Student, KU Leuven</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
