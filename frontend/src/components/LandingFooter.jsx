import { Link, useLocation } from "react-router-dom";
import { Instagram, Linkedin } from "lucide-react";

const LandingFooter = () => {
  const location = useLocation();

  return (
    <footer className="bg-[#080714] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Left: logo + tagline + socials */}
          <div>
            <Link to="/" className="inline-block mb-3">
              <span className="text-xl font-bold text-white font-['Outfit']">
                Kot<span className="text-indigo-500">Klusser</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 mb-4">
              Het platform voor studentenhuisvesting
            </p>
            <div className="flex gap-3">
              <a href="#" className="text-slate-500 hover:text-indigo-400 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-500 hover:text-indigo-400 transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Center: nav links */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Navigatie
            </p>
            <nav className="flex flex-col gap-2">
              {[
                { label: "Home", to: "/" },
                { label: "Over ons", to: "/over-ons" },
                { label: "Contact", to: "/contact" },
                { label: "Demo", to: "/demo" },
                { label: "Prijzen", to: "/prijzen" },
              ]
                .filter((link) => link.to !== "/" || location.pathname !== "/")
                .map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6">
          <p className="text-xs text-slate-500 text-right">
            <Link to="/privacybeleid" className="hover:text-indigo-400 transition-colors">
              Privacybeleid
            </Link>
            {" · "}
            <Link to="/algemene-voorwaarden" className="hover:text-indigo-400 transition-colors">
              Algemene Voorwaarden
            </Link>
            {" · "}
            © 2026 KotKlusser. Alle rechten voorbehouden.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
