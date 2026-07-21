import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { motion } from "framer-motion";
import {
  Wrench, ChevronRight, LogOut, AlertTriangle, Clock, CheckCircle2, Hammer
} from "lucide-react";
import { toast } from "sonner";

// Cleanup sprint 5 (2026-07): keys hernoemd van NL naar EN om te matchen met de
// nieuwe backend-enumwaarden. "kritiek" bestond vroeger enkel op de
// aannemer-pagina's als aparte, hoogste urgentietier naast "urgent" elders in
// de app — dat was een inconsistentie; beide zijn nu samengevoegd tot "urgent"
// (zie supabase/migrations/20260716120000_initial_schema.sql, opmerking 1).
const URGENCY_CONFIG = {
  low:    { label: "Laag",   color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  normal: { label: "Normaal",color: "text-amber-400   bg-amber-500/10   border-amber-500/20" },
  high:   { label: "Hoog",   color: "text-orange-400  bg-orange-500/10  border-orange-500/20" },
  urgent: { label: "Urgent", color: "text-red-400     bg-red-500/10     border-red-500/20" },
};

const STATUS_CONFIG = {
  sent:        { label: "Verstuurd",        icon: Clock,        color: "text-slate-400  bg-slate-500/10  border-slate-500/20" },
  received:    { label: "Ontvangen",        icon: Clock,        color: "text-blue-400   bg-blue-500/10   border-blue-500/20" },
  in_progress: { label: "In behandeling",   icon: Hammer,       color: "text-amber-400  bg-amber-500/10  border-amber-500/20" },
  resolved:    { label: "Opgelost",          icon: CheckCircle2, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, icon: Clock, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const UrgencyBadge = ({ urgency }) => {
  const cfg = URGENCY_CONFIG[urgency] || { label: urgency, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const formatDate = (iso) => {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
};

const AannemerDashboard = () => {
  const { user, authAxios, logout } = useAuth();
  const navigate = useNavigate();
  const [klussen, setKlussen] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKlussen();
  }, []);

  const fetchKlussen = async () => {
    try {
      const res = await authAxios.get(`/contractor/tickets`);
      setKlussen(res.data);
    } catch {
      toast.error("Klussen laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const openKlussen  = klussen.filter(k => k.status !== "resolved");
  const gesloten     = klussen.filter(k => k.status === "resolved");

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-[#0B0A14]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-lg font-bold text-white font-['Outfit']">
            Kot<span className="text-indigo-500">Klusser</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400 hidden sm:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Uitloggen
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white font-['Outfit']">Mijn klussen</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            {openKlussen.length} open · {gesloten.length} afgerond
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : klussen.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Wrench className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">Nog geen klussen toegewezen.</p>
            <p className="text-slate-500 text-sm mt-1">Je wordt hier automatisch geïnformeerd wanneer je een klus krijgt.</p>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {openKlussen.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Open</h2>
                <div className="space-y-2">
                  {openKlussen.map((klus, i) => (
                    <KlusCard key={klus.id} klus={klus} delay={i * 0.05} onClick={() => navigate(`/aannemer/klus/${klus.id}`)} />
                  ))}
                </div>
              </section>
            )}
            {gesloten.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Afgerond</h2>
                <div className="space-y-2 opacity-60">
                  {gesloten.map((klus, i) => (
                    <KlusCard key={klus.id} klus={klus} delay={i * 0.05} onClick={() => navigate(`/aannemer/klus/${klus.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const KlusCard = ({ klus, delay, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    onClick={onClick}
    className="w-full text-left bg-[#161425] border border-white/5 rounded-xl p-4 hover:border-indigo-500/25 transition-colors group"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-xs text-slate-500 font-mono">{klus.ticket_number}</span>
          <StatusBadge status={klus.status} />
          {klus.urgency && klus.urgency !== "normal" && <UrgencyBadge urgency={klus.urgency} />}
          {klus.urgency === "urgent" && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
        </div>
        <p className="text-white font-medium truncate">{klus.title}</p>
        <p className="text-slate-400 text-sm mt-0.5 truncate">{klus.property_name} · {klus.category}</p>
        <p className="text-slate-500 text-xs mt-1">Toegewezen {formatDate(klus.contractor_assigned_at)}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 flex-shrink-0 mt-1 transition-colors" />
    </div>
  </motion.button>
);

export default AannemerDashboard;
