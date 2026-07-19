import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "kotklusser_cookie_consent";

const readStoredConsent = () => {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return typeof parsed?.analytics === "boolean" ? parsed : null;
  } catch {
    return null;
  }
};

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  useEffect(() => {
    if (!readStoredConsent()) {
      setVisible(true);
    }
  }, []);

  const saveConsent = (analytics) => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics }));
    setVisible(false);
    setShowPreferences(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-[#161425] border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Cookie className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-300 flex-1">
            We gebruiken functionele cookies om je ingelogd te houden. Analytics-cookies (PostHog) zijn
            optioneel. Meer info in ons{" "}
            <Link to="/privacybeleid" className="text-indigo-400 hover:text-indigo-300 underline">
              privacybeleid
            </Link>
            .
          </p>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button
              onClick={() => setShowPreferences((v) => !v)}
              variant="outline"
              className="bg-transparent border-white/10 text-slate-300 hover:bg-white/5 hover:text-white w-full sm:w-auto"
            >
              Voorkeuren
            </Button>
            <Button
              onClick={() => saveConsent(false)}
              variant="outline"
              className="bg-transparent border-white/10 text-slate-300 hover:bg-white/5 hover:text-white w-full sm:w-auto"
            >
              Enkel noodzakelijke
            </Button>
            <Button
              onClick={() => saveConsent(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
            >
              Alles accepteren
            </Button>
          </div>
        </div>

        {showPreferences && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white font-medium">Functionele cookies</p>
                <p className="text-xs text-slate-500">Nodig om ingelogd te blijven — altijd actief.</p>
              </div>
              <Switch checked disabled />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white font-medium">Analytics-cookies (PostHog)</p>
                <p className="text-xs text-slate-500">Anonieme gebruiksdata om het platform te verbeteren.</p>
              </div>
              <Switch checked={analyticsEnabled} onCheckedChange={setAnalyticsEnabled} />
            </div>
            <Button
              onClick={() => saveConsent(analyticsEnabled)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
            >
              Selectie accepteren
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CookieConsent;
