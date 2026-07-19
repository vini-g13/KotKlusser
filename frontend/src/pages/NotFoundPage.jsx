import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { MapPinOff, Home } from "lucide-react";

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
      <div className="bg-[#161425] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-500/10 flex items-center justify-center">
          <MapPinOff className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-5xl font-bold text-white font-['Outfit'] mb-2">404</h1>
        <h2 className="text-xl font-semibold text-white font-['Outfit'] mb-2">
          Pagina niet gevonden
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          Deze pagina bestaat niet (meer), of het adres klopt niet helemaal.
        </p>
        <Link to="/">
          <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 glow-primary">
            <Home className="mr-2 w-4 h-4" />
            Terug naar de homepage
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
