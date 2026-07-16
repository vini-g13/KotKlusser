import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

const PaymentCancelPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0A14] flex flex-col">
      <LandingNav />
      <main className="flex-1 flex items-center justify-center px-4 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-slate-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white font-['Outfit'] mb-3">
            Betaling geannuleerd
          </h1>
          <p className="text-slate-400 mb-8">
            Geen zorgen — uw account is aangemaakt. U kunt de betaling later afronden via uw dashboard, of kies opnieuw een plan.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/prijzen">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                Terug naar prijzen
              </Button>
            </Link>
            <Link to="/verhuurder">
              <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 bg-transparent w-full sm:w-auto">
                Naar dashboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </main>
      <LandingFooter />
    </div>
  );
};

export default PaymentCancelPage;
