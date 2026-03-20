import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { 
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle, 
  CheckCircle, MessageSquare, Bell, BarChart3, ArrowRight, Shield
} from "lucide-react";
import { motion } from "framer-motion";

const LandingPage = () => {
  const features = [
    {
      icon: <Wrench className="w-6 h-6" />,
      title: "Eenvoudig Melden",
      description: "Defecten melden in maximaal 3 klikken met foto-upload"
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: "Status Tracking",
      description: "Volg de voortgang van uw melding in real-time"
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Directe Communicatie",
      description: "Chat direct met uw verhuurder binnen elk ticket"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Automatische Herinneringen",
      description: "Nooit meer een melding vergeten dankzij notificaties"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Overzichtelijk Dashboard",
      description: "Verhuurders hebben volledige controle met filters en statistieken"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Veilig & Betrouwbaar",
      description: "Al uw data is veilig opgeslagen en beveiligd"
    }
  ];

  const categories = [
    { icon: <Wrench className="w-8 h-8" />, name: "Sanitair", color: "text-blue-400" },
    { icon: <Zap className="w-8 h-8" />, name: "Elektriciteit", color: "text-yellow-400" },
    { icon: <Flame className="w-8 h-8" />, name: "Verwarming", color: "text-red-400" },
    { icon: <Wifi className="w-8 h-8" />, name: "Internet", color: "text-emerald-400" },
    { icon: <ChefHat className="w-8 h-8" />, name: "Keuken", color: "text-orange-400" },
    { icon: <HelpCircle className="w-8 h-8" />, name: "Anders", color: "text-purple-400" }
  ];

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-2xl font-bold text-white font-['Outfit']">
                Kot<span className="text-indigo-500">Klusser</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-slate-300 hover:text-white" data-testid="nav-login-btn">
                  Inloggen
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white glow-primary" data-testid="nav-register-btn">
                  Registreren
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Glow orb */}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight font-['Outfit']">
                Defecten melden was nog nooit zo{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                  eenvoudig
                </span>
              </h1>
              <p className="mt-6 text-lg text-slate-400 max-w-lg">
                Het platform voor studenten en koteigenaars om defecten in studentenkoten efficiënt te melden, op te volgen en op te lossen.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/register">
                  <Button 
                    size="lg" 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 glow-primary group"
                    data-testid="hero-register-btn"
                  >
                    Nieuw hier? Start nu
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="border-white/10 text-white hover:bg-white/5"
                    data-testid="hero-login-btn"
                  >
                    Inloggen
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Gratis voor studenten
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Gebruiksvriendelijk
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:block"
            >
              <div className="relative rounded-2xl overflow-hidden border border-white/10">
                <img 
                  src="https://images.unsplash.com/photo-1702726001096-096efcf640b8?w=600&h=400&fit=crop" 
                  alt="Student housing"
                  className="w-full h-auto object-cover brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A14] via-transparent to-transparent" />
              </div>
              {/* Floating card */}
              <motion.div 
                className="absolute -bottom-6 -left-6 bg-[#161425] border border-white/10 rounded-xl p-4 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Melding opgelost</p>
                    <p className="text-sm text-slate-400">Binnen 2 dagen</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#12111F]/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-center text-xl font-medium text-slate-400 mb-8">
            Meld elk type defect
          </h2>
          <div className="flex flex-wrap justify-center gap-8">
            {categories.map((cat, idx) => (
              <motion.div
                key={cat.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="flex flex-col items-center gap-2"
              >
                <div className={`w-16 h-16 rounded-xl bg-[#161425] border border-white/10 flex items-center justify-center ${cat.color}`}>
                  {cat.icon}
                </div>
                <span className="text-sm text-slate-300">{cat.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-['Outfit']">
              Alles wat u nodig heeft
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Een complete oplossing voor het beheren van defectmeldingen in studentenhuisvesting
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="bg-[#161425] border border-white/5 rounded-xl p-6 hover:border-indigo-500/30 transition-colors duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%20200%20200%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cfilter%20id%3D%22noise%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.65%22%20numOctaves%3D%223%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23noise)%22%2F%3E%3C%2Fsvg%3E')] opacity-10" />
            <div className="relative text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white font-['Outfit']">
                Klaar om te beginnen?
              </h2>
              <p className="mt-4 text-indigo-100 max-w-lg mx-auto">
                Registreer nu en begin direct met het efficiënt beheren van defectmeldingen.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link to="/register?role=student">
                  <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50" data-testid="cta-student-btn">
                    Ik ben student
                  </Button>
                </Link>
                <Link to="/register?role=landlord">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" data-testid="cta-landlord-btn">
                    Ik ben verhuurder
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xl font-bold text-white font-['Outfit']">
            Kot<span className="text-indigo-500">Klusser</span>
          </span>
          <p className="text-slate-400 text-sm">
            © 2024 KotKlusser. Alle rechten voorbehouden.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
