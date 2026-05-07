import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { API } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle,
  CheckCircle, X, BarChart2, Clock, ArrowRight, ChevronDown,
  User, Calendar
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LandingNav from "../components/LandingNav";
import LandingFooter from "../components/LandingFooter";

// ─── Shared badge helpers ───────────────────────────────────────────────────

const statusStyle = {
  verstuurd:     "bg-indigo-500/15 text-indigo-400 border border-indigo-500/30",
  ontvangen:     "bg-slate-500/15 text-slate-400 border border-slate-500/30",
  "in behandeling": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  opgelost:      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

const urgencyStyle = {
  urgent: "bg-red-500/15 text-red-400 border border-red-500/30",
  hoog:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  normaal:"bg-slate-500/15 text-slate-400 border border-slate-500/30",
};

const statusLabel = {
  verstuurd: "Verstuurd",
  ontvangen: "Ontvangen",
  "in behandeling": "In Behandeling",
  opgelost: "Opgelost",
};

// ─── Browser frame wrapper ─────────────────────────────────────────────────

const BrowserFrame = ({ url, children }) => (
  <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
    {/* Title bar */}
    <div className="bg-[#1C1A2E] px-4 py-3 flex items-center gap-3 border-b border-white/10">
<div className="flex-1 bg-[#0B0A14] rounded-md px-3 py-1 text-xs text-slate-500 font-mono truncate">
        {url}
      </div>
    </div>
    {/* Content */}
    <div className="bg-[#0F0E1A] p-4">
      {children}
    </div>
  </div>
);

// ─── Student demo (4-step wizard) ──────────────────────────────────────────

const categories = [
  { key: "sanitair",      Icon: Wrench,    label: "Sanitair",      color: "text-blue-400" },
  { key: "elektriciteit", Icon: Zap,       label: "Elektriciteit", color: "text-yellow-400" },
  { key: "verwarming",    Icon: Flame,     label: "Verwarming",    color: "text-red-400" },
  { key: "internet",      Icon: Wifi,      label: "Internet",      color: "text-emerald-400" },
  { key: "keuken",        Icon: ChefHat,   label: "Keuken",        color: "text-orange-400" },
  { key: "anders",        Icon: HelpCircle,label: "Anders",        color: "text-purple-400" },
];

const urgencies = [
  { key: "normaal", label: "Normaal", desc: "Geen haast — handig om op te lossen.",      bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
  { key: "hoog",    label: "Hoog",   desc: "Vervelend, maar niet levensgevaarlijk.",      bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400" },
  { key: "urgent",  label: "Urgent", desc: "Directe aandacht vereist — mogelijke schade.", bg: "bg-red-500/10",   border: "border-red-500/30",     text: "text-red-400" },
];

const CHAT_PLACEHOLDER = [];

const StudentDemo = ({ sharedTickets, setSharedTickets }) => {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [urgency, setUrgency] = useState(null);
  const [chatMessages, setChatMessages] = useState({});

  const reset = () => { setStep(1); setCategory(null); setTitle(""); setDesc(""); setUrgency(null); };

  const selectCategory = (key) => {
    setCategory(key);
    setTimeout(() => setStep(2), 300);
  };

  const submitTicket = (selectedUrgency) => {
    if (sharedTickets.length >= 2) return;
    const newTicket = {
      id: `demo-${Date.now()}`,
      ticket_number: `KM-20260414-DEMO${sharedTickets.length + 1}`,
      title: title || "Nieuwe melding",
      category: category || "anders",
      urgency: selectedUrgency || urgency || "normaal",
      status: "verstuurd",
      date: new Date().toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" }),
      student: "Demo Student",
      isStudentCreated: true,
    };
    setSharedTickets([...sharedTickets, newTicket]);
    setChatMessages({ ...chatMessages, [newTicket.id]: [...CHAT_PLACEHOLDER] });
    setStep(4);
  };

  const selectUrgency = (key) => {
    setUrgency(key);
    setTimeout(() => submitTicket(key), 300);
  };

  return (
    <div className="bg-[#161425] border border-white/5 rounded-2xl p-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
              s < step ? "bg-indigo-600 text-white" :
              s === step ? "bg-indigo-600 text-white ring-2 ring-indigo-500/40" :
              "bg-white/10 text-slate-500"
            }`}>{s < step ? <CheckCircle className="w-4 h-4" /> : s}</div>
            {s < 4 && <div className={`h-px w-8 ${s < step ? "bg-indigo-500" : "bg-white/10"}`} />}
          </div>
        ))}
        <span className="ml-auto text-xs text-slate-500">Stap {step} van 4</span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-white font-semibold mb-4">Kies een categorie</h3>
            <div className="grid grid-cols-3 gap-3">
              {categories.map(({ key, Icon, label, color }) => (
                <button
                  key={key}
                  onClick={() => selectCategory(key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    category === key
                      ? "border-indigo-500 bg-indigo-500/10"
                      : "border-white/10 bg-[#1C1A2E] hover:border-white/20"
                  }`}
                >
                  <span className={color}><Icon className="w-6 h-6" /></span>
                  <span className="text-xs text-slate-300">{label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <h3 className="text-white font-semibold">Beschrijf het probleem</h3>
            <div className="space-y-1">
              <Label className="text-slate-300 text-sm">Titel van het probleem</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Verwarming werkt niet"
                className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-sm">Beschrijving</Label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Beschrijf het probleem zo duidelijk mogelijk..."
                rows={4}
                className="w-full rounded-lg border border-white/10 bg-[#1C1A2E] px-3 py-2 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
              />
            </div>
            {/* Photo upload — demo placeholder */}
            <div className="space-y-1">
              <Label className="text-slate-300 text-sm flex items-center gap-2">
                Foto toevoegen
                <span className="text-xs text-slate-500 font-normal">(optioneel)</span>
              </Label>
              <div className="border border-dashed border-white/15 rounded-xl bg-[#1C1A2E] px-4 py-5 flex flex-col items-center gap-2 text-center">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm text-slate-400">Foto uploaden</p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Niet beschikbaar in de demo
                </span>
                <p className="text-xs text-slate-500">Foto's uploaden is beschikbaar in de volledige versie</p>
              </div>
            </div>

            <Button onClick={() => setStep(3)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              Volgende <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h3 className="text-white font-semibold mb-4">Hoe urgent is het?</h3>
            <div className="space-y-3">
              {urgencies.map(({ key, label, desc, bg, border, text }) => (
                <button
                  key={key}
                  onClick={() => selectUrgency(key)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    urgency === key ? `${bg} ${border}` : "border-white/10 bg-[#1C1A2E] hover:border-white/20"
                  }`}
                >
                  <p className={`font-medium mb-0.5 ${urgency === key ? text : "text-white"}`}>{label}</p>
                  <p className="text-xs text-slate-400">{desc}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Melding ingediend!</h3>
            <p className="text-slate-500 font-mono text-sm mb-3">
              {sharedTickets[sharedTickets.length - 1]?.ticket_number || "KM-20260414-DEMO1"}
            </p>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 mb-4">
              Verstuurd
            </span>
            <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
              Uw verhuurder heeft uw melding ontvangen en zal zo snel mogelijk reageren.
            </p>
            <Button onClick={reset} variant="outline" className="border-white/10 text-white hover:bg-white/5">
              Nieuwe melding indienen
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Verhuurder demo (static dashboard mockup) ─────────────────────────────

const DEMO_TICKETS = [
  {
    id: "d1",
    ticket_number: "KM-20260331-DEMO1",
    title: "Verwarming werkt niet",
    urgency: "urgent",
    status: "verstuurd",
    student: "Thomas V.",
    date: "31 mrt. 2026",
    category: "verwarming",
  },
  {
    id: "d2",
    ticket_number: "KM-20260322-DEMO2",
    title: "Kraan lekt in de badkamer",
    urgency: "normaal",
    status: "in behandeling",
    student: "Yasmine M.",
    date: "22 mrt. 2026",
    category: "sanitair",
  },
  {
    id: "d3",
    ticket_number: "KM-20260318-DEMO3",
    title: "WiFi werkt niet op de kamer",
    urgency: "hoog",
    status: "opgelost",
    student: "Mohamed E. F.",
    date: "18 mrt. 2026",
    category: "internet",
  },
];

const STATUS_STEPS = ["verstuurd", "ontvangen", "in behandeling", "opgelost"];
const STATUS_STEP_LABELS = ["Verstuurd", "Ontvangen", "In Behandeling", "Opgelost"];

const categoryIcon = {
  verwarming: <Flame className="w-4 h-4 text-red-400" />,
  sanitair: <Wrench className="w-4 h-4 text-blue-400" />,
  internet: <Wifi className="w-4 h-4 text-emerald-400" />,
};

const tileBorder = {
  total:    "border-indigo-500",
  open:     "border-blue-500",
  urgent:   "border-red-500",
  resolved: "border-emerald-500",
};

const tileFilter = {
  total:    () => true,
  open:     (t, statuses) => statuses[t.id] !== "opgelost",
  urgent:   (t) => t.urgency === "urgent",
  resolved: (t, statuses) => statuses[t.id] === "opgelost",
};

const VerhuurderDemo = ({ sharedTickets }) => {
  const [activeTile, setActiveTile] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketStatuses, setTicketStatuses] = useState({
    d1: "verstuurd",
    d2: "in behandeling",
    d3: "opgelost",
  });
  const [plannedDates, setPlannedDates] = useState({});

  const allTickets = [
    ...sharedTickets.map(t => ({ ...t, isStudentCreated: true })),
    ...DEMO_TICKETS,
  ];

  useEffect(() => {
    const newStatuses = { ...ticketStatuses };
    sharedTickets.forEach(t => {
      if (!newStatuses[t.id]) newStatuses[t.id] = "verstuurd";
    });
    setTicketStatuses(newStatuses);
  }, [sharedTickets]);

  const tileDefs = [
    { key: "total",    label: "Totaal",   count: allTickets.length, iconBg: "bg-indigo-500/20",  iconText: "text-indigo-400",  Icon: BarChart2 },
    { key: "open",     label: "Open",     count: allTickets.filter(t => ticketStatuses[t.id] !== "opgelost").length, iconBg: "bg-blue-500/20", iconText: "text-blue-400", Icon: Clock },
    { key: "urgent",   label: "Urgent",   count: allTickets.filter(t => t.urgency === "urgent").length, iconBg: "bg-red-500/20", iconText: "text-red-400", Icon: Flame },
    { key: "resolved", label: "Opgelost", count: allTickets.filter(t => ticketStatuses[t.id] === "opgelost").length, iconBg: "bg-emerald-500/20", iconText: "text-emerald-400", Icon: CheckCircle },
  ];

  const visibleTickets = allTickets.filter((t) =>
    activeTile ? tileFilter[activeTile](t, ticketStatuses) : true
  );

  const panelTicket = selectedTicket
    ? { ...allTickets.find((t) => t.id === selectedTicket), status: ticketStatuses[selectedTicket] }
    : null;

  // If a ticket is selected, show full detail view (in-panel navigation)
  if (panelTicket) {
    return (
      <div className="bg-[#161425] border border-white/5 rounded-2xl overflow-hidden">
        {/* In-panel header with back button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#12111F]">
          <button
            onClick={() => setSelectedTicket(null)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Terug naar overzicht
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-slate-500 font-mono">{panelTicket.ticket_number}</span>
        </div>

        {/* Detail content */}
        <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: "560px" }}>

          {/* Demo feature banner */}
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <span className="text-indigo-400 text-sm mt-0.5">🎭</span>
            <div>
              <p className="text-xs text-indigo-300 font-medium">Demo-modus</p>
              <p className="text-xs text-slate-400 mt-0.5">Chat en foto's zijn enkel beschikbaar in de volledige versie.</p>
            </div>
          </div>

          {/* Title + badges */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-2">{panelTicket.title}</h3>
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[ticketStatuses[panelTicket.id] || panelTicket.status]}`}>
                {statusLabel[ticketStatuses[panelTicket.id] || panelTicket.status]}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyStyle[panelTicket.urgency]}`}>
                {panelTicket.urgency}
              </span>
              {panelTicket.isStudentCreated && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  Nieuwe melding
                </span>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1C1A2E] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Student</p>
              <p className="text-sm text-white">{panelTicket.student}</p>
            </div>
            <div className="bg-[#1C1A2E] rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">Datum</p>
              <p className="text-sm text-white">{panelTicket.date}</p>
            </div>
          </div>

          {/* Status stepper */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Status</p>
            <div className="flex items-center gap-0">
              {STATUS_STEPS.map((s, idx) => {
                const currentIdx = STATUS_STEPS.indexOf(ticketStatuses[panelTicket.id] || panelTicket.status);
                const done = idx <= currentIdx;
                const last = idx === STATUS_STEPS.length - 1;
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        done ? "bg-indigo-600 text-white" : "bg-white/10 text-slate-500"
                      }`}>
                        {done ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={`text-xs mt-1 whitespace-nowrap ${done ? "text-indigo-400" : "text-slate-500"}`}>
                        {STATUS_STEP_LABELS[idx]}
                      </span>
                    </div>
                    {!last && (
                      <div className={`flex-1 h-px mx-1 mb-5 ${idx < currentIdx ? "bg-indigo-500" : "bg-white/10"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status wijzigen */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Status wijzigen</p>
            <div className="relative">
              <select
                value={ticketStatuses[panelTicket.id] || panelTicket.status}
                onChange={(e) => setTicketStatuses({ ...ticketStatuses, [panelTicket.id]: e.target.value })}
                className="w-full bg-[#1C1A2E] border border-white/10 text-white rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:border-indigo-500"
              >
                {STATUS_STEPS.map((s) => (
                  <option key={s} value={s}>{statusLabel[s]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Datum inplannen */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Technieker inplannen</p>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={plannedDates[panelTicket.id] || ""}
                onChange={(e) => setPlannedDates({ ...plannedDates, [panelTicket.id]: e.target.value })}
                className="w-full bg-[#1C1A2E] border border-white/10 text-white rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 [color-scheme:dark]"
              />
            </div>
            {plannedDates[panelTicket.id] && (
              <p className="text-xs text-emerald-400 mt-1">
                ✓ Technieker ingepland op {new Date(plannedDates[panelTicket.id]).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>

          {/* Chat preview */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Berichten</p>
            <div className="space-y-3 bg-[#0B0A14] rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white shrink-0">
                  {panelTicket.student?.charAt(0) || "S"}
                </div>
                <div className="bg-[#1C1A2E] border border-white/10 rounded-xl rounded-tl-none px-4 py-3 max-w-[80%]">
                  <p className="text-xs text-slate-500 mb-1">Student</p>
                  <p className="text-sm text-white">Goeiedag, dit probleem is al een tijdje bezig.</p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-indigo-600/20 border border-indigo-500/30 rounded-xl rounded-tr-none px-4 py-3 max-w-[80%]">
                  <p className="text-xs text-indigo-400 mb-1">Verhuurder (u)</p>
                  <p className="text-sm text-white">Bedankt voor de melding! We bekijken dit zo snel mogelijk.</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white shrink-0">V</div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-col items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  Alleen in de volledige versie
                </span>
                <p className="text-xs text-slate-500 text-center">Chatten met studenten is beschikbaar na registratie.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {tileDefs.map(({ key, label, count, iconBg, iconText, Icon }) => {
          const isActive = activeTile === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTile(isActive ? null : key)}
              className={`bg-[#161425] rounded-xl p-4 text-left transition-all ${
                isActive
                  ? `border-2 ${tileBorder[key]}`
                  : "border border-white/5 hover:border-white/10"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${iconText}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-sm text-slate-400">{label}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Ticket list */}
      <div className="bg-[#161425] border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
        {visibleTickets.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">Geen tickets voor dit filter</div>
        ) : (
          visibleTickets.map((ticket) => {
            const currentStatus = ticketStatuses[ticket.id] || ticket.status;
            return (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket.id)}
                className="w-full text-left p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {categoryIcon[ticket.category] || <HelpCircle className="w-4 h-4 text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-slate-500 font-mono">{ticket.ticket_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[currentStatus]}`}>
                        {statusLabel[currentStatus]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${urgencyStyle[ticket.urgency]}`}>
                        {ticket.urgency}
                      </span>
                      {ticket.isStudentCreated && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                          Nieuwe melding
                        </span>
                      )}
                    </div>
                    <p className="text-white font-medium group-hover:text-indigo-400 transition-colors truncate">
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{ticket.student}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ticket.date}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 shrink-0 transition-colors" />
                </div>
              </button>
            );
          })
        )}
      </div>

    </div>
  );
};

// ─── Main DemoPage ──────────────────────────────────────────────────────────

const DemoPage = () => {
  const [lead, setLead] = useState(() => {
    try { return JSON.parse(localStorage.getItem("kotklusser_demo_lead")); } catch { return null; }
  });
  const [leadForm, setLeadForm] = useState({ name: "", email: "" });
  const [leadErrors, setLeadErrors] = useState({});
  const [leadLoading, setLeadLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("verhuurder");
  const [sharedTickets, setSharedTickets] = useState([]);

  const submitLead = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!leadForm.name.trim()) errs.name = "Naam is verplicht";
    if (!leadForm.email.trim()) errs.email = "E-mailadres is verplicht";
    if (Object.keys(errs).length > 0) { setLeadErrors(errs); return; }
    setLeadLoading(true);
    try {
      await axios.post(`${API}/demo-signup`, leadForm);
      toast.success("Aanvraag ontvangen! We nemen spoedig contact op.");
      localStorage.setItem("kotklusser_demo_lead", JSON.stringify(leadForm));
      setLead(leadForm);
    } catch {
      toast.error("Er ging iets mis. Probeer opnieuw.");
    } finally {
      setLeadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      <LandingNav />

      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {!lead ? (
              /* ── Lead capture wall ── */
              <motion.div
                key="wall"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-sm mx-auto"
              >
                <div className="bg-[#161425] border border-white/5 rounded-2xl p-8">
                  <div className="text-center mb-6">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 mb-4 uppercase tracking-wider">
                      Demo
                    </span>
                    <h2 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
                      Bekijk de interactieve demo
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Laat uw naam en e-mailadres achter voor toegang tot de volledige demo.
                    </p>
                  </div>
                  <form onSubmit={submitLead} className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-slate-300 text-sm">Naam *</Label>
                      <Input
                        value={leadForm.name}
                        onChange={(e) => { setLeadForm({ ...leadForm, name: e.target.value }); setLeadErrors({}); }}
                        placeholder="Uw naam"
                        className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                      />
                      {leadErrors.name && <p className="text-xs text-red-400">{leadErrors.name}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-slate-300 text-sm">E-mailadres *</Label>
                      <Input
                        type="email"
                        value={leadForm.email}
                        onChange={(e) => { setLeadForm({ ...leadForm, email: e.target.value }); setLeadErrors({}); }}
                        placeholder="naam@email.com"
                        className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                      />
                      {leadErrors.email && <p className="text-xs text-red-400">{leadErrors.email}</p>}
                    </div>
                    <Button
                      type="submit"
                      disabled={leadLoading || !leadForm.name.trim() || !leadForm.email.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white glow-primary disabled:opacity-50"
                    >
                      {leadLoading ? "Even geduld..." : <><span>Bekijk de demo</span> <ArrowRight className="w-4 h-4 ml-2" /></>}
                    </Button>
                    <p className="text-center text-xs text-slate-500">
                      Geen spam. Enkel toegang tot de gratis demo.
                    </p>
                  </form>
                </div>
              </motion.div>
            ) : (
              /* ── Demo content ── */
              <motion.div
                key="demo"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Demo banner */}
                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl px-4 py-3 mb-6 text-center">
                  <p className="text-sm text-indigo-300">
                    🎭 Dit is een interactieve demo — geen echte data wordt opgeslagen.
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="flex justify-center mb-8">
                  <div className="inline-flex bg-[#161425] border border-white/10 rounded-xl p-1 gap-1">
                    <button
                      onClick={() => setActiveTab("student")}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "student"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      👤 Student
                    </button>
                    <button
                      onClick={() => setActiveTab("verhuurder")}
                      className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === "verhuurder"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      🏠 Verhuurder
                    </button>
                  </div>
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  {activeTab === "student" ? (
                    <motion.div
                      key="student"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <BrowserFrame url="kotklusser.be/student">
                        <StudentDemo sharedTickets={sharedTickets} setSharedTickets={setSharedTickets} />
                      </BrowserFrame>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="verhuurder"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <BrowserFrame url="kotklusser.be/verhuurder">
                        <VerhuurderDemo sharedTickets={sharedTickets} />
                      </BrowserFrame>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default DemoPage;
