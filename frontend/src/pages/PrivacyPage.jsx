import { motion } from "framer-motion";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

// TODO: laten nalezen door een jurist vóór launch

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const sections = [
  {
    title: "Welke gegevens we verzamelen",
    body: [
      "Om KotKlusser te laten werken verzamelen we: naam, e-mailadres, telefoonnummer, kamernummer en verdieping, de inhoud van meldingen (tekst en foto's die je toevoegt), en geanonimiseerde gebruiksdata via analytics (PostHog).",
    ],
  },
  {
    title: "Waarom we die gegevens verzamelen",
    body: [
      "We verwerken deze gegevens op basis van de uitvoering van de overeenkomst tussen jou en KotKlusser: zonder deze gegevens kunnen we het ticketbeheer tussen student en verhuurder niet laten functioneren.",
    ],
  },
  {
    title: "Wie toegang heeft tot je gegevens",
    body: [
      "De verhuurder van het pand waaraan jouw account gekoppeld is, ziet de meldingen die jij indient. KotKlusser zelf heeft toegang voor platformbeheer, technische ondersteuning en het oplossen van problemen. We verkopen je gegevens nooit aan derden.",
    ],
  },
  {
    title: "Bewaartermijn",
    body: [
      "We bewaren je gegevens zolang je account actief is, plus een redelijke periode daarna om aan wettelijke verplichtingen te voldoen of geschillen op te lossen.",
    ],
  },
  {
    title: "Derde partijen die gegevens verwerken",
    body: [
      "Voor de werking van het platform maken we gebruik van een aantal verwerkers: Supabase (authenticatie en database), Railway (hosting), Resend (transactionele e-mail), Stripe (betalingen, indien van toepassing op jouw account) en PostHog (anonieme analytics). Elk van deze partijen verwerkt gegevens enkel in opdracht van KotKlusser.",
    ],
  },
  {
    title: "Jouw rechten onder de AVG/GDPR",
    body: [
      "Je hebt het recht op inzage, correctie en verwijdering van je gegevens, het recht op gegevensoverdraagbaarheid, het recht om bezwaar te maken tegen bepaalde verwerkingen, en het recht om een klacht in te dienen bij de Gegevensbeschermingsautoriteit (GBA). Neem hiervoor contact met ons op via onderstaand e-mailadres.",
    ],
  },
  {
    title: "Cookies",
    body: [
      "KotKlusser gebruikt functionele cookies die nodig zijn om ingelogd te blijven, en anonieme analytics-cookies (PostHog) om te begrijpen hoe het platform gebruikt wordt. We gebruiken geen advertentiecookies.",
    ],
  },
  {
    title: "Contact",
    body: [
      "Vragen over deze privacyverklaring of over je gegevens? Mail naar contact@kotklusser.be.",
    ],
  },
];

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-[#0B0A14]">
      <LandingNav />

      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.h1
            {...fadeUp(0)}
            className="text-4xl sm:text-5xl font-bold text-white font-['Outfit'] mb-4"
          >
            Privacybeleid
          </motion.h1>
          <motion.p {...fadeUp(0.1)} className="text-sm text-slate-500">
            Laatst bijgewerkt: 19 juli 2026
          </motion.p>
        </div>
      </section>

      <section className="pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-10">
          {sections.map((section, idx) => (
            <motion.div key={section.title} {...fadeUp(0.05 * idx)}>
              <h2 className="text-xl font-semibold text-white font-['Outfit'] mb-3">
                {section.title}
              </h2>
              {section.body.map((para, pIdx) => (
                <p key={pIdx} className="text-slate-400 leading-relaxed">
                  {para}
                </p>
              ))}
            </motion.div>
          ))}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default PrivacyPage;
