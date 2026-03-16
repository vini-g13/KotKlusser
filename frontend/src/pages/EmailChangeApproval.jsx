import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  Mail, User, Building2, Check, X, Clock, ArrowLeft, Shield, AlertCircle
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const EmailChangeApproval = () => {
  const { token } = useParams();
  const { authAxios } = useAuth();
  const navigate = useNavigate();
  
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    fetchRequest();
  }, [token]);

  const fetchRequest = async () => {
    try {
      const response = await authAxios.get(`/email-change-requests/by-token/${token}`);
      setRequest(response.data);
    } catch (error) {
      toast.error("Verzoek niet gevonden of link is verlopen");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      await authAxios.post(`/email-change-requests/${token}/process`, {
        approved: true
      });
      toast.success("Emailwijziging is goedgekeurd en doorgevoerd");
      navigate("/verhuurder");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon verzoek niet verwerken");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await authAxios.post(`/email-change-requests/${token}/process`, {
        approved: false,
        reason: rejectionReason || null
      });
      toast.success("Emailwijziging is afgewezen");
      navigate("/verhuurder");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon verzoek niet verwerken");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/20 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            Verzoek niet gevonden
          </h1>
          <p className="text-slate-400 mb-6">
            Dit emailwijzigingsverzoek bestaat niet of de link is verlopen.
          </p>
          <Link to="/verhuurder">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar dashboard
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // Already processed
  if (request.status !== 'pending') {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
            request.status === 'approved' ? 'bg-emerald-500/20' : 'bg-red-500/20'
          }`}>
            {request.status === 'approved' ? (
              <Check className="w-8 h-8 text-emerald-400" />
            ) : (
              <X className="w-8 h-8 text-red-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit'] mb-2">
            Verzoek al verwerkt
          </h1>
          <p className="text-slate-400 mb-6">
            Dit emailwijzigingsverzoek is al {request.status === 'approved' ? 'goedgekeurd' : 'afgewezen'}.
          </p>
          <Link to="/verhuurder">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
              Naar dashboard
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/verhuurder" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-white font-medium">Emailwijziging beoordelen</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <Shield className="w-7 h-7 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white font-['Outfit']">
                  Emailwijziging aanvraag
                </h2>
                <p className="text-slate-400">
                  Een student wil zijn/haar emailadres wijzigen
                </p>
              </div>
            </div>
          </motion.div>

          {/* Request Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6 mb-6 space-y-6"
          >
            {/* Student Info */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-medium text-lg">
                {request.student_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-medium">{request.student_name}</p>
                <p className="text-sm text-slate-400">Student</p>
              </div>
            </div>

            {/* Email Details */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400 text-sm">Huidig emailadres</Label>
                <div className="flex items-center gap-3 p-3 bg-[#0B0A14] border border-white/5 rounded-lg">
                  <Mail className="w-5 h-5 text-slate-500" />
                  <span className="text-white">{request.student_email}</span>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 text-indigo-400 rotate-[-90deg]" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-400 text-sm">Nieuw emailadres</Label>
                <div className="flex items-center gap-3 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                  <Mail className="w-5 h-5 text-indigo-400" />
                  <span className="text-white font-medium">{request.new_email}</span>
                </div>
              </div>
            </div>

            {/* Property */}
            {request.property_name && (
              <div className="flex items-center gap-3 p-3 bg-[#0B0A14] border border-white/5 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-xs text-slate-500">Pand</p>
                  <p className="text-white">{request.property_name}</p>
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              Aangevraagd op {format(new Date(request.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-4"
          >
            {!showRejectForm ? (
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-12"
                  data-testid="approve-email-change-btn"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Verwerken...
                    </span>
                  ) : (
                    <>
                      <Check className="w-5 h-5 mr-2" />
                      Goedkeuren
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowRejectForm(true)}
                  variant="outline"
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 h-12"
                  data-testid="show-reject-form-btn"
                >
                  <X className="w-5 h-5 mr-2" />
                  Afwijzen
                </Button>
              </div>
            ) : (
              <div className="bg-[#161425] border border-red-500/30 rounded-xl p-6 space-y-4">
                <h3 className="text-red-400 font-medium flex items-center gap-2">
                  <X className="w-5 h-5" />
                  Verzoek afwijzen
                </h3>
                <div className="space-y-2">
                  <Label className="text-slate-300">Reden (optioneel)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Voeg een reden toe waarom het verzoek is afgewezen..."
                    className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 resize-none"
                    rows={3}
                    data-testid="rejection-reason-input"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowRejectForm(false)}
                    variant="outline"
                    className="flex-1 border-white/10 text-white"
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={processing}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    data-testid="confirm-reject-btn"
                  >
                    {processing ? "Verwerken..." : "Afwijzen"}
                  </Button>
                </div>
              </div>
            )}

            {/* Info text */}
            <p className="text-center text-sm text-slate-500">
              Na goedkeuring kan de student inloggen met het nieuwe emailadres.
              De student ontvangt een bevestigingsmail.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default EmailChangeApproval;
