import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth, API } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Building2, MapPin, DoorOpen, Layers, ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";

const JoinProperty = () => {
  const { code } = useParams();
  const { user, authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [formData, setFormData] = useState({
    room_number: "",
    floor: ""
  });

  useEffect(() => {
    fetchProperty();
  }, [code]);

  const fetchProperty = async () => {
    try {
      const response = await axios.get(`${API}/properties/by-code/${code}`);
      setProperty(response.data);
    } catch (error) {
      toast.error("Ongeldige of verlopen uitnodigingscode");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    
    if (!formData.room_number.trim() || !formData.floor) {
      toast.error("Vul alle velden in");
      return;
    }

    setJoining(true);
    try {
      await authAxios.post("/properties/join", {
        join_code: code,
        room_number: formData.room_number,
        floor: formData.floor
      });
      await refreshUser();
      toast.success(`Welkom bij ${property.property_name}!`);
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon niet aansluiten bij pand");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If not logged in, redirect to register with join code
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          {property ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
                Uitnodiging voor {property.property_name}
              </h1>
              <p className="text-slate-400 mb-2">{property.address}</p>
              <p className="text-slate-500 mb-8">
                Log in of maak een account aan om u aan te sluiten bij dit pand.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to={`/login?redirect=/join/${code}`}>
                  <Button variant="outline" className="w-full border-white/10 text-white">
                    Inloggen
                  </Button>
                </Link>
                <Link to={`/register?role=student&join=${code}`}>
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                    Registreren
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
                Ongeldige uitnodiging
              </h1>
              <p className="text-slate-400 mb-6">
                Deze uitnodigingscode is ongeldig of verlopen.
              </p>
              <Link to="/">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  Naar startpagina
                </Button>
              </Link>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  // If user is landlord
  if (user.role === 'landlord') {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            Alleen voor studenten
          </h1>
          <p className="text-slate-400 mb-6">
            Uitnodigingscodes zijn alleen bedoeld voor studenten, niet voor verhuurders.
          </p>
          <Link to="/verhuurder">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar dashboard
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // If user already has a property
  if (user.property_id) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            U bent al gekoppeld
          </h1>
          <p className="text-slate-400 mb-2">
            U bent al aangesloten bij <strong className="text-white">{user.property_name}</strong>.
          </p>
          <p className="text-slate-500 mb-6 text-sm">
            Neem contact op met uw verhuurder om van pand te wisselen.
          </p>
          <Link to="/dashboard">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar dashboard
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            Ongeldige uitnodiging
          </h1>
          <p className="text-slate-400 mb-6">
            Deze uitnodigingscode is ongeldig of verlopen.
          </p>
          <Link to="/dashboard">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar dashboard
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

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
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit'] mb-2">
            Aansluiten bij pand
          </h1>
          <p className="text-slate-400">{property.property_name}</p>
          <p className="text-sm text-slate-500">{property.address}</p>
        </div>

        {/* Form */}
        <div className="bg-[#161425] border border-white/5 rounded-2xl p-6">
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="room_number" className="text-slate-300">Kamernummer</Label>
              <div className="relative">
                <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  id="room_number"
                  type="text"
                  value={formData.room_number}
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                  placeholder="Bijv. 101, 2A"
                  required
                  className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                  data-testid="room-number-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="floor" className="text-slate-300">Verdieping</Label>
              <div className="relative">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none z-10" />
                <select
                  id="floor"
                  value={formData.floor}
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                  required
                  className="w-full pl-10 pr-4 h-12 bg-[#1C1A2E] border border-white/10 text-white rounded-md focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 appearance-none cursor-pointer"
                  data-testid="floor-select"
                >
                  <option value="" disabled className="bg-[#1C1A2E] text-slate-500">Selecteer verdieping</option>
                  {property?.floors?.map((floor) => (
                    <option key={floor.value} value={floor.value} className="bg-[#1C1A2E] text-white">
                      {floor.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
              disabled={joining}
              data-testid="join-property-btn"
            >
              {joining ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Aansluiten...
                </span>
              ) : (
                <>
                  Aansluiten
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default JoinProperty;
