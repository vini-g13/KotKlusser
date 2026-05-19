import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../components/ui/button";
import { Check, ChevronDown, ChevronUp, Building2, Zap, Shield, Headphones } from "lucide-react";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const plans = [
  {
    key: "starter",
    name: "Starter",
    rooms: "0–15 kamers",
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyTotal: 0,
    setupFee: null,
    featured: false,
    cta: "Gratis starten",
    ctaLink: "/register?role=landlord",
    features: [
      "Tot 15 kamers",
      "1 gebouw",
      "Basis ticketing",
      "E-mailmeldingen",
      "Studentonboarding via koppelcode",
      "KotKlusser branding",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    rooms: "16–50 kamers",
    monthlyPrice: 149,
    yearlyPrice: 124,
    yearlyTotal: 1490,
    setupFee: 349,
    featured: true,
    cta: "Plan starten",
    ctaLink: "/contact",
    features: [
      "Tot 50 kamers",
      "Meerdere gebouwen",
      "Onbeperkte meldingen",
      "Volledig dashboard",
      "Prioriteiten & statussen",
      "Foto uploads per melding",
      "E-mailnotificaties",
      "Studentonboarding via koppelcode",
      "Huurdersbeheer per pand",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    rooms: "51–150 kamers",
    monthlyPrice: 299,
    yearlyPrice: 249,
    yearlyTotal: 2990,
    setupFee: 699,
    featured: false,
    cta: "Plan starten",
    ctaLink: "/contact",
    features: [
      "Tot 150 kamers",
      "Alles uit Growth",
      "Eigen branding & logo",
      "Multi-user toegang",
      "Exportfuncties",
      "Prioriteitssupport",
      "Geavanceerde rapportage",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    rooms: "150+ kamers",
    monthlyPrice: null,
    yearlyPrice: null,
    yearlyTotal: null,
    setupFee: null,
    featured: false,
    cta: "Neem contact op",
    ctaLink: "/contact",
    features: [
      "Onbeperkt kamers",
      "Alles uit Pro",
      "Persoonlijke onboarding",
      "SLA & dedicated support",
      "Custom workflows",
      "Mogelijke integraties",
      "Custom facturatie",
    ],
  },
];

const faqs = [
  {
    q: "Kan ik op elk moment opzeggen?",
    a: "Ja, u kunt uw abonnement op elk moment opzeggen. Bij maandelijkse facturatie stopt het abonnement aan het einde van de lopende maand. Bij jaarlijkse facturatie blijft u toegang houden tot het einde van de betaalde periode.",
  },
  {
    q: "Wat houdt de setup-fee in?",
    a: "De eenmalige setup-fee dekt de persoonlijke onboarding: we helpen u uw panden aanmaken, de studentenkoppeling configureren en zorgen dat alles correct werkt vóór de livegang. Voor het Growth-plan bedraagt dit €349, voor Pro €699.",
  },
  {
    q: "Is de setup-fee echt gratis bij jaarlijkse facturatie?",
    a: "Ja. Bij het afsluiten van een jaarplan is de setup-fee volledig inbegrepen. Dit is onze manier om u te belonen voor de langetermijncommitment.",
  },
  {
    q: "Kan ik upgraden naar een hoger plan?",
    a: "Absoluut. U kunt op elk moment upgraden. Het prijsverschil voor de resterende periode wordt pro-rata verrekend.",
  },
  {
    q: "Wat als mijn aantal kamers de tierlimiet overschrijdt?",
    a: "We nemen dan contact met u op om samen het meest geschikte plan te bespreken. U wordt nooit onverwacht afgeschakeld.",
  },
  {
    q: "Is KotKlusser fiscaal aftrekbaar?",
    a: "Ja. Als verhuurder kunt u KotKlusser beschouwen als een beroepskost voor het beheer van uw vastgoedportefeuille. Raadpleeg uw boekhouder voor de exacte fiscale verwerking in uw situatie.",
  },
  {
    q: "Hoe werkt de studentonboarding?",
    a: "Elke verhuurder krijgt een unieke koppelcode per pand. Studenten voeren deze code in bij registratie en zijn meteen gekoppeld aan het juiste pand en de juiste verdieping. Geen handmatige stappen nodig.",
  },
];

const PricingPage = () => {
  const [isYearly, setIsYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      <LandingNav />
      <main className="pt-16">

        {/* HERO */}
        <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div {...fadeUp(0)}>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm mb-6">
                Transparante prijzen
              </span>
            </motion.div>
            <motion.h1
              {...fadeUp(0.1)}
              className="text-4xl md:text-5xl font-bold text-white font-['Outfit']"
            >
              Eenvoudig. Transparant. Eerlijk.
            </motion.h1>
            <motion.p
              {...fadeUp(0.2)}
              className="text-slate-400 text-lg mt-4 max-w-2xl mx-auto"
            >
              Kies het plan dat past bij uw portefeuille. Geen verrassingen, geen verborgen kosten.
            </motion.p>

            {/* Billing toggle */}
            <motion.div
              {...fadeUp(0.3)}
              className="flex items-center justify-center gap-4 mt-8 mb-12"
            >
              <span className={`text-sm font-medium ${!isYearly ? "text-white" : "text-slate-400"}`}>
                Maandelijks
              </span>
              <button
                data-testid="billing-toggle"
                onClick={() => setIsYearly(!isYearly)}
                className="w-12 h-6 rounded-full cursor-pointer bg-[#1C1A2E] border border-white/10 relative flex-shrink-0"
                aria-label="Wissel tussen maandelijks en jaarlijks"
              >
                <span
                  className={`w-5 h-5 rounded-full bg-indigo-500 absolute top-0.5 transition-all duration-200 ${
                    isYearly ? "left-6" : "left-0.5"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${isYearly ? "text-white" : "text-slate-400"}`}>
                Jaarlijks
              </span>
              <AnimatePresence>
                {isYearly && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full"
                  >
                    2 maanden gratis
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        {/* PRICING CARDS */}
        <section className="pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <motion.div
              {...fadeUp(0.4)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {plans.map((plan) => (
                <div
                  key={plan.key}
                  data-testid={`plan-card-${plan.key}`}
                  className={`relative bg-[#161425] border border-white/5 rounded-2xl p-6 flex flex-col hover:border-indigo-500/20 transition-colors duration-300 ${
                    plan.featured ? "ring-2 ring-indigo-500" : ""
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">
                      Meest gekozen
                    </div>
                  )}

                  <p className="text-lg font-semibold text-white font-['Outfit'] mb-1">{plan.name}</p>
                  <p className="text-xs text-slate-500 mb-6">{plan.rooms}</p>

                  {/* Price */}
                  <div>
                    {plan.monthlyPrice === 0 ? (
                      <span className="text-4xl font-bold text-white">Gratis</span>
                    ) : plan.monthlyPrice === null ? (
                      <>
                        <span className="text-3xl font-bold text-white">Op maat</span>
                        <p className="text-sm text-slate-400 mt-1">Vanaf ~€599/maand</p>
                      </>
                    ) : (
                      <>
                        <span className="text-4xl font-bold text-white">
                          €{isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                        </span>
                        <span className="text-slate-400 text-sm"> /maand</span>
                        {isYearly && plan.yearlyTotal > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            €{plan.yearlyTotal} per jaar gefactureerd
                          </p>
                        )}
                      </>
                    )}

                    {plan.setupFee !== null && (
                      isYearly ? (
                        <p className="text-xs text-emerald-400 mt-2">Setup inbegrepen bij jaarplan</p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-2">Eenmalig: €{plan.setupFee} setup</p>
                      )
                    )}
                  </div>

                  <div className="border-t border-white/5 my-5" />

                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-300">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={plan.ctaLink}>
                    <Button
                      data-testid={`cta-${plan.key}`}
                      className={`w-full ${
                        plan.featured
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "border border-white/10 text-white hover:bg-white/5 bg-transparent"
                      }`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0.5)} className="max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center gap-8 md:gap-16">
              <div className="flex items-center gap-3">
                <Shield className="w-8 h-8 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-white">Fiscaal aftrekbaar</p>
                  <p className="text-xs text-slate-500">Als beroepskost voor verhuurders</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="w-8 h-8 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-white">Snel operationeel</p>
                  <p className="text-xs text-slate-500">Binnen 24u volledig actief</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Headphones className="w-8 h-8 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-white">Persoonlijke support</p>
                  <p className="text-xs text-slate-500">Altijd bereikbaar via e-mail</p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* FAQ */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0.6)} className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-white font-['Outfit'] text-center mb-10">
              Veelgestelde vragen
            </h2>
            <div>
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-white/5">
                  <button
                    data-testid={`faq-btn-${idx}`}
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex justify-between items-center py-4 text-left"
                  >
                    <span className="text-sm md:text-base font-medium text-white">{faq.q}</span>
                    {openFaq === idx ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {openFaq === idx && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="pb-4 text-sm text-slate-400 leading-relaxed">{faq.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* CLOSING CTA */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp(0.7)} className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center overflow-hidden">
              <div className="noise-overlay absolute inset-0 rounded-2xl pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-2xl md:text-3xl font-bold text-white">Klaar om te starten?</h2>
                <p className="text-indigo-100 mt-4 max-w-lg mx-auto">
                  Registreer nu en zet uw eerste pand in minder dan 5 minuten op.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <Link to="/register?role=landlord">
                    <Button size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50 w-full sm:w-auto">
                      Gratis starten
                    </Button>
                  </Link>
                  <Link to="/contact">
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-white text-white hover:bg-white/10 w-full sm:w-auto"
                    >
                      Neem contact op
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

      </main>
      <LandingFooter />
    </div>
  );
};

export default PricingPage;
