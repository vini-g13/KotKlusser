import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "./ui/button";
import { ShieldAlert, CornerDownLeft } from "lucide-react";

const SessionExpiredScreen = () => {
  const { clearSessionExpired } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    clearSessionExpired();
    navigate("/login");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0A14]/95 flex items-center justify-center px-4">
      <div className="bg-[#161425] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white font-['Outfit'] mb-2">Sessie verlopen</h2>
        <p className="text-slate-400 text-sm mb-6">
          Je bent te lang inactief geweest. Log opnieuw in om verder te gaan.
        </p>
        <Button
          onClick={handleLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary"
        >
          Terug naar login
          <CornerDownLeft className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default SessionExpiredScreen;
