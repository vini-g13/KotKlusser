import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth, API } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Mail, Check, X, AlertCircle, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";

const ConfirmEmail = () => {
  const { token } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    confirmEmail();
  }, [token]);

  const confirmEmail = async () => {
    try {
      const response = await axios.post(`${API}/confirm-email/${token}`);
      setNewEmail(response.data.new_email);
      setStatus("success");
      
      // If logged in, log out so user can log in with new email
      if (user) {
        setTimeout(() => {
          logout();
        }, 3000);
      }
    } catch (error) {
      setStatus("error");
      setError(error.response?.data?.detail || "Kon email niet bevestigen");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Email bevestigen...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-10 h-10 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            Bevestiging mislukt
          </h1>
          <p className="text-slate-400 mb-6">{error}</p>
          <Link to="/login">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar inloggen
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
        className="w-full max-w-md text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
          Email succesvol gewijzigd!
        </h1>
        <p className="text-slate-400 mb-2">
          Uw emailadres is gewijzigd naar:
        </p>
        <p className="text-indigo-400 font-medium text-lg mb-6">{newEmail}</p>
        
        <div className="bg-[#161425] border border-white/5 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-400">
              U wordt automatisch uitgelogd. Log opnieuw in met uw nieuwe emailadres.
            </p>
          </div>
        </div>

        <Link to="/login">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Inloggen met nieuw emailadres
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </motion.div>
    </div>
  );
};

export default ConfirmEmail;
