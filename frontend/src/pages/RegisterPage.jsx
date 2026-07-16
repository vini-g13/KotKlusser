import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, API } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, GraduationCap, Building2, DoorOpen, Layers, Key, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";

const PLAN_LABELS = { growth: "Growth", pro: "Pro" };
const BILLING_LABELS = { monthly: "Maandelijks", yearly: "Jaarlijks" };

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') || 'student';
  const joinCode = searchParams.get('join') || '';
  const selectedPlan = searchParams.get('plan') || '';
  const selectedBilling = searchParams.get('billing') || 'monthly';
  const inviteToken = searchParams.get('token') || '';
  const prefillEmail = searchParams.get('email') || '';

  const [formData, setFormData] = useState({
    name: "",
    email: prefillEmail,
    password: "",
    phone: "",
    role: defaultRole,
    join_code: joinCode,
    room_number: "",
    floor: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [propertyInfo, setPropertyInfo] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Verify join code if provided
  useEffect(() => {
    if (joinCode) {
      verifyJoinCode(joinCode);
    }
  }, [joinCode]);

  const verifyJoinCode = async (code) => {
    try {
      const response = await axios.get(`${API}/properties/by-code/${code}`);
      setPropertyInfo(response.data);
    } catch (error) {
      toast.error("Ongeldige uitnodigingscode");
      setFormData(prev => ({ ...prev, join_code: "" }));
    }
  };

  const handleJoinCodeBlur = () => {
    if (formData.join_code && formData.join_code.length >= 6) {
      verifyJoinCode(formData.join_code);
    } else {
      setPropertyInfo(null);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.role === 'student' && formData.join_code) {
      if (!formData.room_number || !formData.floor) {
        toast.error("Vul uw kamernummer en verdieping in");
        return;
      }
    }

    setLoading(true);

    try {
      const submitData = { ...formData };
      if (selectedPlan) {
        submitData.plan = selectedPlan;
        submitData.billing = selectedBilling;
      }
      if (inviteToken) {
        submitData.invite_token = inviteToken;
      }

      const { user, token: authToken } = await register(submitData);
      toast.success(`Welkom, ${user.name}! Account succesvol aangemaakt.`);

      if (selectedPlan && selectedPlan !== 'starter') {
        try {
          const response = await axios.post(
            `${API}/payments/create-checkout-session`,
            { plan: selectedPlan, billing: selectedBilling },
            { headers: { Authorization: `Bearer ${authToken}` } }
          );
          window.location.href = response.data.checkout_url;
        } catch {
          toast.error("Betaling starten mislukt. Neem contact op via contact@kotklusser.be.");
          navigate(user.has_property ? '/verhuurder' : '/onboarding/pand');
        }
      } else if (user.role === 'contractor') {
        navigate('/aannemer');
      } else if (user.role === 'landlord') {
        navigate(user.has_property ? '/verhuurder' : '/onboarding/pand');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registratie mislukt");
    } finally {
      setLoading(false);
    }
  };

  const showJoinFields = formData.role === 'student' && formData.join_code && propertyInfo;

  return (
    <div className="h-screen overflow-hidden bg-[#0B0A14] flex">
      {/* Left side - Image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-l from-[#0B0A14] to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1769026806508-9afd673962ae?w=800&h=1200&fit=crop"
          alt="Student housing"
          className="w-full h-full object-cover brightness-50"
        />
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-start px-4 sm:px-6 lg:px-20 xl:px-24 pt-16 pb-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
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
            Account aanmaken
          </h1>
          <p className="text-slate-400 mb-6">
            Begin vandaag nog met het melden van defecten
          </p>

          {selectedPlan && selectedPlan !== 'starter' && (
            <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mb-6">
              <CreditCard className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-indigo-300">
                  {PLAN_LABELS[selectedPlan] || selectedPlan} plan · {BILLING_LABELS[selectedBilling] || selectedBilling}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Na registratie wordt u doorgestuurd naar de beveiligde betaalpagina.
                </p>
              </div>
            </div>
          )}

          {/* Role selector */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, role: 'student' });
                setPropertyInfo(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${
                formData.role === 'student' 
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                  : 'bg-[#161425] border-white/10 text-slate-400 hover:border-white/20'
              }`}
              data-testid="register-role-student"
            >
              <GraduationCap className="w-5 h-5" />
              Student
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({ ...formData, role: 'landlord', join_code: '', room_number: '', floor: '' });
                setPropertyInfo(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg border transition-colors ${
                formData.role === 'landlord' 
                  ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' 
                  : 'bg-[#161425] border-white/10 text-slate-400 hover:border-white/20'
              }`}
              data-testid="register-role-landlord"
            >
              <Building2 className="w-5 h-5" />
              Verhuurder
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-slate-300">Naam</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Uw volledige naam"
                  required
                  className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="register-name-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="naam@email.com"
                  required
                  className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="register-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Telefoon (optioneel)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+32 xxx xx xx xx"
                  className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="register-phone-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Wachtwoord</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pl-10 pr-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="register-password-input"
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

            {/* Join code for students */}
            {formData.role === 'student' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="join_code" className="text-slate-300">
                    Uitnodigingscode (optioneel)
                  </Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      id="join_code"
                      name="join_code"
                      type="text"
                      value={formData.join_code}
                      onChange={handleChange}
                      onBlur={handleJoinCodeBlur}
                      placeholder="Bijv. ABC123"
                      className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12 uppercase"
                      maxLength={6}
                      data-testid="register-join-code-input"
                    />
                  </div>
                  {propertyInfo && (
                    <p className="text-sm text-emerald-400">
                      ✓ Pand gevonden: {propertyInfo.property_name}
                    </p>
                  )}
                </div>

                {showJoinFields && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="room_number" className="text-slate-300">Kamernummer</Label>
                      <div className="relative">
                        <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                        <Input
                          id="room_number"
                          name="room_number"
                          type="text"
                          value={formData.room_number}
                          onChange={handleChange}
                          placeholder="101"
                          required={!!formData.join_code}
                          className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                          data-testid="register-room-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="floor" className="text-slate-300">Verdieping</Label>
                      <Select
                        value={formData.floor}
                        onValueChange={(value) => setFormData({ ...formData, floor: value })}
                        data-testid="register-floor-select"
                      >
                        <SelectTrigger className="bg-[#161425] border-white/10 text-white h-12" id="floor">
                          <SelectValue placeholder="Selecteer" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#161425] border-white/10">
                          {propertyInfo?.floors?.map((floor) => (
                            <SelectItem key={floor.value} value={floor.value} className="text-white">
                              {floor.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary mt-6"
              disabled={loading}
              data-testid="register-submit-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {selectedPlan && selectedPlan !== 'starter' ? "Doorsturen naar betaling..." : "Account aanmaken..."}
                </span>
              ) : selectedPlan && selectedPlan !== 'starter' ? (
                "Registreren & betalen"
              ) : (
                "Registreren"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-slate-400">
            Heeft u al een account?{" "}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Log hier in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default RegisterPage;
