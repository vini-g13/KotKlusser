import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, User, Mail, Phone, Building2, DoorOpen, Layers, 
  Save, AlertCircle, Clock, Check, X, Edit3, Lock
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const ProfilePage = () => {
  const { user, authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: ""
  });
  const [hasChanges, setHasChanges] = useState(false);
  
  // Email change request
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [requestingEmail, setRequestingEmail] = useState(false);
  const [emailRequests, setEmailRequests] = useState([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const [profileRes, requestsRes] = await Promise.all([
        authAxios.get("/profile"),
        authAxios.get("/profile/email-change-requests")
      ]);
      setProfile(profileRes.data);
      setFormData({
        first_name: profileRes.data.first_name || "",
        last_name: profileRes.data.last_name || "",
        phone: profileRes.data.phone || ""
      });
      setEmailRequests(requestsRes.data);
    } catch (error) {
      toast.error("Kon profiel niet laden");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await authAxios.patch("/profile", formData);
      setProfile(response.data);
      setHasChanges(false);
      await refreshUser();
      toast.success("Profiel succesvol bijgewerkt");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon profiel niet opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!newEmail.trim()) {
      toast.error("Voer een geldig emailadres in");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Voer een geldig emailadres in");
      return;
    }

    setRequestingEmail(true);
    try {
      await authAxios.post("/profile/request-email-change", { new_email: newEmail });
      toast.success("Wijzigingsverzoek is ingediend");
      setShowEmailDialog(false);
      setNewEmail("");
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon verzoek niet indienen");
    } finally {
      setRequestingEmail(false);
    }
  };

  const handleCancelEmailRequest = async () => {
    try {
      await authAxios.delete("/profile/email-change-request");
      toast.success("Verzoek geannuleerd");
      await fetchProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon verzoek niet annuleren");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  const pendingRequest = profile?.pending_email_change;

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/dashboard" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-white font-medium">Mijn profiel</h1>
          </div>
          {hasChanges && (
            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="save-profile-btn"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Opslaan...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Opslaan
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Avatar section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {profile?.first_name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white font-['Outfit']">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-slate-400">Student</p>
            </div>
          </motion.div>

          {/* Personal Info Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-6 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-400" />
              Persoonlijke gegevens
            </h3>

            <div className="space-y-5">
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-slate-300">Voornaam</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    placeholder="Uw voornaam"
                    className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                    data-testid="first-name-input"
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-slate-300">Achternaam</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    placeholder="Uw achternaam"
                    className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                    data-testid="last-name-input"
                  />
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300">Telefoonnummer</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    placeholder="+32 xxx xx xx xx"
                    className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                    data-testid="phone-input"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Email Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              Emailadres
            </h3>

            <div className="space-y-4">
              {/* Current Email - Read Only */}
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  Huidig emailadres
                  <Lock className="w-3 h-3 text-slate-500" />
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    value={profile?.email || ""}
                    disabled
                    className="pl-10 bg-[#0B0A14] border-white/5 text-slate-400 h-12 cursor-not-allowed"
                    data-testid="email-display"
                  />
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Dit emailadres is gekoppeld aan uw account en kan niet rechtstreeks worden aangepast.
                </p>
              </div>

              {/* Pending Request Banner */}
              {pendingRequest && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-400 font-medium">Wijzigingsverzoek in behandeling</p>
                      <p className="text-sm text-slate-400 mt-1">
                        U heeft een aanvraag ingediend om uw emailadres te wijzigen naar:{" "}
                        <span className="text-white">{pendingRequest.new_email}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Aangevraagd op {format(new Date(pendingRequest.created_at), "d MMMM yyyy 'om' HH:mm", { locale: nl })}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelEmailRequest}
                        className="mt-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-3"
                        data-testid="cancel-email-request-btn"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Annuleren
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Request Email Change Button */}
              {!pendingRequest && (
                <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-white/10 text-white hover:bg-white/5"
                      data-testid="request-email-change-btn"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Emailadres wijzigen aanvragen
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#161425] border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white">Emailadres wijzigen</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Uw verhuurder moet de wijziging goedkeuren voordat deze wordt doorgevoerd.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Huidig emailadres</Label>
                        <Input
                          value={profile?.email || ""}
                          disabled
                          className="bg-[#0B0A14] border-white/5 text-slate-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">Nieuw emailadres</Label>
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="nieuw@email.com"
                          className="bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
                          data-testid="new-email-input"
                        />
                      </div>
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <p className="text-sm text-indigo-300">
                          <AlertCircle className="w-4 h-4 inline-block mr-1" />
                          Na het indienen ontvangt uw verhuurder een email met de mogelijkheid om uw aanvraag goed te keuren.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowEmailDialog(false)}
                        className="border-white/10 text-white"
                      >
                        Annuleren
                      </Button>
                      <Button
                        onClick={handleRequestEmailChange}
                        disabled={requestingEmail || !newEmail.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        data-testid="submit-email-request-btn"
                      >
                        {requestingEmail ? "Verzenden..." : "Verzoek indienen"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </motion.div>

          {/* Property/Location Section - Read Only */}
          {profile?.property_id && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-[#161425] border border-white/5 rounded-xl p-6"
            >
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                Kamer / locatie
                <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30 text-xs ml-2">
                  Alleen-lezen
                </Badge>
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Pand</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={profile?.property_name || ""}
                        disabled
                        className="pl-10 bg-[#0B0A14] border-white/5 text-slate-400 h-12 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Kamernummer</Label>
                    <div className="relative">
                      <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={profile?.room_number || ""}
                        disabled
                        className="pl-10 bg-[#0B0A14] border-white/5 text-slate-400 h-12 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Verdieping</Label>
                  <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <Input
                      value={profile?.floor || ""}
                      disabled
                      className="pl-10 bg-[#0B0A14] border-white/5 text-slate-400 h-12 cursor-not-allowed"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Neem contact op met uw verhuurder om kamer- of locatiegegevens te wijzigen.
                </p>
              </div>
            </motion.div>
          )}

          {/* Email Change History */}
          {emailRequests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="bg-[#161425] border border-white/5 rounded-xl p-6"
            >
              <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                Emailwijzigingen geschiedenis
              </h3>

              <div className="space-y-3">
                {emailRequests.filter(r => r.status !== 'pending').slice(0, 5).map((request) => (
                  <div 
                    key={request.id} 
                    className={`p-3 rounded-lg border ${
                      request.status === 'approved' 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {request.status === 'approved' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        request.status === 'approved' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {request.status === 'approved' ? 'Goedgekeurd' : 'Afgewezen'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Wijziging naar: {request.new_email}
                    </p>
                    {request.rejection_reason && (
                      <p className="text-xs text-slate-500 mt-1">
                        Reden: {request.rejection_reason}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(request.processed_at || request.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Account Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-4">Account informatie</h3>
            <p className="text-sm text-slate-400">
              Account aangemaakt op {profile?.created_at && format(new Date(profile.created_at), "d MMMM yyyy", { locale: nl })}
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
