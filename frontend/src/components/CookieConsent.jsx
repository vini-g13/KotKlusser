import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "kotklusser_cookie_consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-[#161425] border border-white/10 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
          <Cookie className="w-5 h-5" />
        </div>
        <p className="text-sm text-slate-300 flex-1">
          We gebruiken functionele cookies om je ingelogd te houden en anonieme analytics-cookies om het
          platform te verbeteren. Meer info in ons{" "}
          <Link to="/privacybeleid" className="text-indigo-400 hover:text-indigo-300 underline">
            privacybeleid
          </Link>
          .
        </p>
        <Button
          onClick={accept}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 w-full sm:w-auto"
        >
          Begrepen
        </Button>
      </div>
    </div>
  );
};

export default CookieConsent;
