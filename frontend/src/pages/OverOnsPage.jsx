import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { TrendingDown, Eye, MapPin, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const values = [
  {
    icon: <TrendingDown className="w-6 h-6" />,
    title: "Drempelverlagend",
    description: "Melden en beheren van meldingen moet makkelijk zijn voor beide partijen",
  },
  {
    icon: <Eye className="w-6 h-6" />,
    title: "Transparant",
    description: "Beide partijen weten op elk moment wat er gebeurt met een melding, volledige transparantie",
  },
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "Belgisch & Lokaal",
    description: "Gebouwd voor de Belgische studentenmarkt, met kennis van de lokale context en studentensteden.",
  },
];

const OverOnsPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0A14]">
      <LandingNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.h1
            {...fadeUp(0)}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white font-['Outfit'] mb-6"
          >
            Over{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              KotKlusser
            </span>
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-lg text-slate-400 max-w-2xl mx-auto">
            Waarom KotKlusser bestaat. Van studentenfrustratie naar slimme oplossing.
          </motion.p>
        </div>
      </section>

      {/* Atmospheric image */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-2xl mx-auto">
          <motion.div
            {...fadeUp(0.2)}
            className="relative rounded-2xl overflow-hidden border border-white/10"
          >
            <img
              src="https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&h=450&fit=crop"
              alt="Studentenkamer sfeer"
              className="w-full h-auto object-cover brightness-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0A14] via-transparent to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 pb-20">
        <div className="max-w-3xl mx-auto space-y-8">
          {[
            "Het begon met een simpele frustratie, eentje die elke student kent. Een defect melden via WhatsApp, e-mail, Berichten of via een telefoontje, en erna wachten op een reactie. Wanneer deze niet komt een nieuwe sturen en steeds communiceren via verschillende apps. De drempel om iets te melden voelde groter dan het probleem zelf — en dat terwijl verhuurders aan de andere kant het overzicht in alle meldingen soms verliezen.",
            "KotKlusser is ontstaan vanuit die frustratie om een oplossing te bieden tot het probleem. Een platform waar studenten in vier klikken een melding eenvoudig kunnen indienen, en verhuurders alles overzichtelijk op één plek beheren. Geen verloren meldingen meer. Geen onduidelijkheid over wat er met je melding gebeurt. Een helder systeem dat werkt voor iedereen.",
            "Vandaag bouwen we KotKlusser uit voor de Belgische studentensteden — Hasselt, Leuven, Antwerpen, Gent, Brussel en Brugge. De ambitie reikt verder, maar onze focus ligt op wat telt: het dagelijks leven op kot een stukje aangenamer maken. Voor elke student die te lang heeft gewacht op een antwoord. En voor elke verhuurder die het overzicht wil bewaren zonder de chaos.",
          ].map((para, idx) => (
            <motion.p
              key={idx}
              {...fadeUp(0.1 * idx)}
              className="text-slate-300 leading-relaxed text-lg"
            >
              {para}
            </motion.p>
          ))}
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#12111F]/50">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp(0)} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white font-['Outfit']">Onze waarden</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {values.map((val, idx) => (
              <motion.div
                key={val.title}
                {...fadeUp(0.1 * idx)}
                className="bg-[#12111F] border border-white/5 rounded-2xl p-6 hover:border-indigo-500/30 transition-colors duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
                  {val.icon}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{val.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{val.description}</p>
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
                Klaar om te starten?
              </h2>
              <p className="mt-4 text-indigo-100 max-w-lg mx-auto">
                Registreer nu en ontdek hoe eenvoudig het kan zijn.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link to="/register?role=student">
                  <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
                    Ik ben student
                  </Button>
                </Link>
                <Link to="/register?role=landlord">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                    Ik ben verhuurder
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default OverOnsPage;
