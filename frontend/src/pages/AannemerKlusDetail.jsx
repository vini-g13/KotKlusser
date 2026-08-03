import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Tag, Hammer, CheckCircle2, Clock, Building2
} from "lucide-react";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import TicketStatusStepper from "../components/TicketStatusStepper";
import TicketPhotoGallery from "../components/TicketPhotoGallery";
import UrgencyBadge from "../components/UrgencyBadge";

// Cleanup sprint 5 (2026-07): foto's staan niet meer als base64 embedded in de
// ticket-rij, maar in een private Supabase Storage bucket ("ticket-photos").
// De backend geeft in `klus.photos` al kant-en-klare, tijdelijke signed URLs
// terug (1u geldig) — hier hoeft dus geen URL meer opgebouwd te worden.

// Sub-project B2 (kotklusser-cleanup-plan.md sectie 3.4): stepper, fotogalerij
// en urgentie-badge zijn verhuisd naar gedeelde componenten, zie
// docs/superpowers/specs/2026-07-21-ticket-detail-shared-subcomponents-design.md.

const formatDate = (iso) => {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric" });
};

const AannemerKlusDetail = () => {
  const { ticket_id } = useParams();
  const navigate = useNavigate();
  const { authAxios } = useAuth();
  const [klus, setKlus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchKlus();
  }, [ticket_id]);

  const fetchKlus = async () => {
    try {
      const res = await authAxios.get(`/contractor/tickets/${ticket_id}`);
      setKlus(res.data);
    } catch {
      toast.error("Klus niet gevonden");
      navigate("/aannemer");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (nieuwStatus) => {
    setUpdating(true);
    try {
      await authAxios.patch(`/contractor/tickets/${ticket_id}/status`, { status: nieuwStatus });
      setKlus(prev => ({ ...prev, status: nieuwStatus }));
      toast.success(`Status bijgewerkt naar "${nieuwStatus.replace("_", " ")}"`);
    } catch {
      toast.error("Status bijwerken mislukt");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!klus) return null;

  const isInBehandeling = klus.status === "in_progress";
  const isOpgelost = klus.status === "resolved";

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Topbar */}
      <header className="sticky top-0 z-40 bg-[#0B0A14]/80 backdrop-blur border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate("/aannemer")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Mijn klussen</span>
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-300 font-mono">{klus.ticket_number}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Titel + badges */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <UrgencyBadge urgency={klus.urgency} />
            <span className="text-xs text-slate-500 font-mono">{klus.ticket_number}</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">{klus.title}</h1>
          <p className="text-slate-400 text-sm mt-1">Toegewezen op {formatDate(klus.contractor_assigned_at)}</p>
        </motion.div>

        {/* Status stepper */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="bg-[#161425] border border-white/5 rounded-xl p-5"
        >
          <TicketStatusStepper status={klus.status} />
        </motion.div>

        {/* Acties */}
        {!isOpgelost && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-5"
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Status bijwerken</p>
            <div className="flex flex-col sm:flex-row gap-3">
              {!isInBehandeling && (
                <Button
                  onClick={() => updateStatus("in_progress")}
                  disabled={updating}
                  className="flex-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/25 hover:border-amber-500/40"
                >
                  <Hammer className="w-4 h-4 mr-2" />
                  In behandeling
                </Button>
              )}
              <Button
                onClick={() => updateStatus("resolved")}
                disabled={updating}
                className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Markeer als opgelost
              </Button>
            </div>
          </motion.div>
        )}

        {isOpgelost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-sm text-emerald-300">Deze klus is afgerond.</p>
          </motion.div>
        )}

        {/* Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="bg-[#161425] border border-white/5 rounded-xl p-5 space-y-4"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Details</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Pand</p>
                <p className="text-sm text-white">{klus.property_name || "–"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Locatie</p>
                <p className="text-sm text-white">{klus.location || "–"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Tag className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Categorie</p>
                <p className="text-sm text-white">{klus.category || "–"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500">Gemeld op</p>
                <p className="text-sm text-white">{formatDate(klus.created_at)}</p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5">
            <p className="text-xs text-slate-500 mb-2">Beschrijving</p>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{klus.description || "–"}</p>
          </div>
        </motion.div>

        {/* Foto's */}
        {klus.photos?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-5"
          >
            <TicketPhotoGallery photos={klus.photos} />
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default AannemerKlusDetail;
