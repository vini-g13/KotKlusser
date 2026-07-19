import { motion } from "framer-motion";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

// TODO: laten nalezen door een jurist vóór launch, KBO-nummer en adres invullen

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay },
});

const sections = [
  {
    title: "Definities",
    body: [
      "Platform: de KotKlusser-webapplicatie en bijhorende diensten. Verhuurder: de natuurlijke of rechtspersoon die een pand beheert via het Platform. Student: de gebruiker die een kot bewoont en meldingen indient. Account: de persoonlijke toegang tot het Platform. Melding: een defectrapport ingediend door een Student.",
    ],
  },
  {
    title: "Toepasselijkheid",
    body: [
      "Deze algemene voorwaarden zijn van toepassing op elk gebruik van het KotKlusser-platform, door zowel Verhuurders als Studenten. Door een Account aan te maken ga je akkoord met deze voorwaarden.",
    ],
  },
  {
    title: "Account en registratie",
    body: [
      "Je bent zelf verantwoordelijk voor het geheimhouden van je accountgegevens en voor alle activiteit onder je Account. Je moet minstens 16 jaar oud zijn om een Account aan te maken.",
    ],
  },
  {
    title: "Gebruik van het platform",
    body: [
      "Toegestaan gebruik omvat het melden en opvolgen van defecten in je kot, en communicatie tussen Student en Verhuurder hierover. Verboden is: het Platform gebruiken voor spam, misbruik, het versturen van illegale content, of enige poging het Platform te verstoren.",
    ],
  },
  {
    title: "Tarieven en betaling",
    body: [
      "De actuele tarieven voor Verhuurders vind je op onze prijzenpagina. Betalingen verlopen via de op het Platform aangeboden betaalmethodes. Opzegtermijnen worden vermeld bij het afsluiten van een betaald abonnement.",
    ],
  },
  {
    title: "Aansprakelijkheid",
    body: [
      "KotKlusser is een communicatie- en ticketingtool tussen Verhuurder en Student. KotKlusser is niet verantwoordelijk voor de daadwerkelijke uitvoering, kwaliteit of tijdigheid van herstellingen — dit blijft de verantwoordelijkheid van de Verhuurder (en eventuele aannemers).",
    ],
  },
  {
    title: "Intellectueel eigendom",
    body: [
      "De merknaam KotKlusser en het Platform zelf blijven eigendom van KotKlusser. Niets in deze voorwaarden geeft je enig recht op het gebruik van de merknaam buiten het normale gebruik van het Platform.",
    ],
  },
  {
    title: "Beëindiging",
    body: [
      "Je kan je Account op elk moment stopzetten via je profielinstellingen of door contact op te nemen. KotKlusser kan een Account beëindigen bij schending van deze voorwaarden.",
    ],
  },
  {
    title: "Wijzigingen aan deze voorwaarden",
    body: [
      "KotKlusser kan deze voorwaarden aanpassen. Bij een belangrijke wijziging informeren we gebruikers via e-mail of een melding op het Platform.",
    ],
  },
  {
    title: "Toepasselijk recht",
    body: [
      "Op deze voorwaarden is Belgisch recht van toepassing. Bij geschillen zijn enkel de rechtbanken van het gerechtelijk arrondissement waar KotKlusser gevestigd is bevoegd.",
    ],
  },
  {
    title: "Contact",
    body: [
      "KotKlusser — [KBO-nummer] — [maatschappelijke zetel adres]. Vragen over deze voorwaarden? Mail naar contact@kotklusser.be.",
    ],
  },
];

const TermsPage = () => {
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
            Algemene Voorwaarden
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

export default TermsPage;
