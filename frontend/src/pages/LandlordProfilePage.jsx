import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from "../components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, User, Mail, Phone, Building2, MapPin,
  Save, AlertCircle, Clock, Check, X, Edit3, Lock, Trash2, HardHat
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";
import { formatPropertyAddress } from "../lib/utils";

const LandlordProfilePage = () => {
  const { user, authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    company_name: ""
  });
  const [hasChanges, setHasChanges] = useState(false);
  
  // Properties
  const [properties, setProperties] = useState([]);
  const [editingProperty, setEditingProperty] = useState(null);
  const [editPropertyData, setEditPropertyData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: 0,
  });
  const [savingProperty, setSavingProperty] = useState(false);
  const [pendingDeleteProperty, setPendingDeleteProperty] = useState(null);

  // Contractors ("Mijn Aannemers")
  const [contractors, setContractors] = useState([]);
  const [editingContractorScope, setEditingContractorScope] = useState(null);
  const [scopeMode, setScopeMode] = useState("all"); // "all" | "specific"
  const [selectedPropertyIds, setSelectedPropertyIds] = useState([]);
  const [savingScope, setSavingScope] = useState(false);

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
      const [profileRes, requestsRes, propsRes, contractorsRes] = await Promise.all([
        authAxios.get("/profile"),
        authAxios.get("/profile/landlord-email-change-requests"),
        authAxios.get("/properties"),
        authAxios.get("/contractors/my-list")
      ]);
      setProfile(profileRes.data);
      setFormData({
        first_name: profileRes.data.first_name || "",
        last_name: profileRes.data.last_name || "",
        phone: profileRes.data.phone || "",
        company_name: profileRes.data.company_name || ""
      });
      setEmailRequests(requestsRes.data);
      setProperties(propsRes.data);
      setContractors(contractorsRes.data);
    } catch (error) {
      toast.error("Kon profiel niet laden");
      navigate("/verhuurder");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProperty = (prop) => {
    setEditingProperty(prop);
    setEditPropertyData({
      name: prop.name, street: prop.street, house_number: prop.house_number,
      postal_code: prop.postal_code, city: prop.city, floor_count: prop.floor_count ?? 0,
    });
  };

  const submitSaveProperty = async () => {
    setSavingProperty(true);
    try {
      const response = await authAxios.patch(`/properties/${editingProperty.id}`, {
        name: editPropertyData.name,
        street: editPropertyData.street,
        house_number: editPropertyData.house_number,
        postal_code: editPropertyData.postal_code,
        city: editPropertyData.city,
        floor_count: editPropertyData.floor_count,
      });
      setProperties(properties.map(p => p.id === editingProperty.id ? response.data : p));
      setEditingProperty(null);
      toast.success("Pand succesvol bijgewerkt");
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet opslaan");
    } finally {
      setSavingProperty(false);
    }
  };

  const handleEditContractorScope = (contractor) => {
    setEditingContractorScope(contractor);
    if (contractor.scope_property_ids.length === 0) {
      setScopeMode("all");
      setSelectedPropertyIds([]);
    } else {
      setScopeMode("specific");
      setSelectedPropertyIds(contractor.scope_property_ids);
    }
  };

  const togglePropertySelection = (propertyId) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(propertyId) ? prev.filter((id) => id !== propertyId) : [...prev, propertyId]
    );
  };

  const handleSaveContractorScope = async () => {
    setSavingScope(true);
    try {
      const propertyIds = scopeMode === "all" ? [] : selectedPropertyIds;
      await authAxios.put(`/contractors/${editingContractorScope.id}/property-scope`, { property_ids: propertyIds });
      setContractors(contractors.map((c) =>
        c.id === editingContractorScope.id ? { ...c, scope_property_ids: propertyIds } : c
      ));
      setEditingContractorScope(null);
      toast.success("Scope bijgewerkt");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon scope niet opslaan");
    } finally {
      setSavingScope(false);
    }
  };

  const { showConfirm: showFloorConfirm, requestSubmit: requestSaveProperty, cancel: cancelFloorConfirm, confirm: confirmFloorConfirm } =
    useFloorCountConfirm(submitSaveProperty);

  const handleSaveProperty = () => {
    if (!editPropertyData.name.trim() || !editPropertyData.street.trim() || !editPropertyData.house_number.trim()
        || !editPropertyData.postal_code.trim() || !editPropertyData.city.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    requestSaveProperty(editPropertyData.floor_count);
  };

  const handleDeleteProperty = async () => {
    try {
      await authAxios.delete(`/properties/${pendingDeleteProperty.id}`);
      setProperties(properties.filter(p => p.id !== pendingDeleteProperty.id));
      setPendingDeleteProperty(null);
      toast.success("Pand verwijderd");
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet verwijderen");
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Voer een geldig emailadres in");
      return;
    }

    setRequestingEmail(true);
    try {
      await authAxios.post("/profile/landlord-request-email-change", { new_email: newEmail });
      toast.success("Bevestigingslink is verstuurd naar het nieuwe emailadres");
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
      await authAxios.delete("/profile/landlord-email-change-request");
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
          <Link to="/verhuurder" className="text-slate-400 hover:text-white">
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
              <>
                <Save className="w-4 h-4 mr-2" />
                Wijzigingen opslaan
              </>
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
              {profile?.first_name?.charAt(0)?.toUpperCase() || "V"}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white font-['Outfit']">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-slate-400">Verhuurder</p>
              {profile?.company_name && (
                <p className="text-sm text-indigo-400">{profile.company_name}</p>
              )}
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

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-slate-300">
                  Bedrijfsnaam <span className="text-slate-500">(optioneel)</span>
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => handleInputChange("company_name", e.target.value)}
                    placeholder="Bijv. Vastgoed BV"
                    className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500 h-12"
                    data-testid="company-name-input"
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
                      <p className="text-amber-400 font-medium">Wacht op bevestiging</p>
                      <p className="text-sm text-slate-400 mt-1">
                        Een bevestigingslink is verstuurd naar:{" "}
                        <span className="text-white">{pendingRequest.new_email}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Klik op de link in de email om de wijziging te bevestigen.
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
                        U ontvangt een bevestigingslink op het nieuwe emailadres.
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
                          U ontvangt een bevestigingslink op het nieuwe emailadres. De link is 24 uur geldig.
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

          {/* Email Change History */}
          {emailRequests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
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
                      request.status === 'confirmed' 
                        ? 'bg-emerald-500/10 border-emerald-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {request.status === 'confirmed' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm font-medium ${
                        request.status === 'confirmed' ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {request.status === 'confirmed' ? 'Bevestigd' : 'Verlopen'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Wijziging naar: {request.new_email}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {format(new Date(request.confirmed_at || request.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Mijn Panden */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              Mijn Panden
            </h3>

            {properties.length === 0 ? (
              <p className="text-sm text-slate-500">Geen panden gevonden. Voeg een pand toe via het dashboard.</p>
            ) : (
              <div className="space-y-3">
                {properties.map((prop) => (
                  <div key={prop.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#1C1A2E] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{prop.name}</p>
                      <p className="text-sm text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        <span className="truncate">{formatPropertyAddress(prop)}</span>
                      </p>
                      <div className="flex gap-2 mt-1.5">
                        <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs">
                          {prop.floor_count ?? 0} verdiepingen
                        </Badge>
                        <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">
                          {prop.tenant_count} huurders
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditProperty(prop)}
                        className="text-slate-400 hover:text-white hover:bg-white/5"
                        data-testid={`edit-property-${prop.id}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPendingDeleteProperty(prop)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        data-testid={`delete-property-${prop.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Mijn Aannemers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.38 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-6 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-indigo-400" />
              Mijn Aannemers
            </h3>

            {contractors.length === 0 ? (
              <p className="text-sm text-slate-500">Nog geen aannemers gekoppeld. Wijs er één toe via een melding, of nodig er één uit.</p>
            ) : (
              <div className="space-y-3">
                {contractors.map((contractor) => (
                  <div key={contractor.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#1C1A2E] border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">{contractor.name}</p>
                      <p className="text-sm text-slate-400 truncate">
                        {[contractor.specialty, contractor.region].filter(Boolean).join(' · ') || contractor.email}
                      </p>
                      <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs mt-1.5">
                        {contractor.scope_property_ids.length === 0
                          ? "Alle panden"
                          : `${contractor.scope_property_ids.length} specifiek${contractor.scope_property_ids.length === 1 ? "" : "e"} pand${contractor.scope_property_ids.length === 1 ? "" : "en"}`}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditContractorScope(contractor)}
                      className="text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
                      data-testid={`edit-contractor-scope-${contractor.id}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Account Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <h3 className="text-white font-medium mb-4">Account informatie</h3>
            <p className="text-sm text-slate-400">
              Account aangemaakt op {profile?.created_at && format(new Date(profile.created_at), "d MMMM yyyy", { locale: nl })}
            </p>
          </motion.div>
        </div>
      </main>

      {/* Edit Property Dialog */}
      <Dialog open={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)}>
        <DialogContent className="bg-[#161425] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Pand bewerken</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <PropertyFormFields
              formData={editPropertyData}
              onChange={(field, value) => setEditPropertyData({ ...editPropertyData, [field]: value })}
              testIdPrefix="edit-property"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingProperty(null)}
              className="border-white/10 text-white"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSaveProperty}
              disabled={savingProperty}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingProperty ? "Opslaan..." : "Wijzigingen opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />

      {/* Edit Contractor Scope Dialog */}
      <Dialog open={!!editingContractorScope} onOpenChange={(open) => !open && setEditingContractorScope(null)}>
        <DialogContent className="bg-[#161425] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Scope aanpassen — {editingContractorScope?.name}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setScopeMode("all")}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                  scopeMode === "all"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "bg-[#1C1A2E] border-white/10 text-slate-400 hover:border-white/20"
                }`}
                data-testid="scope-mode-all"
              >
                Alle panden
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("specific")}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm transition-colors ${
                  scopeMode === "specific"
                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-400"
                    : "bg-[#1C1A2E] border-white/10 text-slate-400 hover:border-white/20"
                }`}
                data-testid="scope-mode-specific"
              >
                Specifieke panden
              </button>
            </div>

            {scopeMode === "specific" && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {properties.map((prop) => (
                  <label
                    key={prop.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1C1A2E] border border-white/5 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedPropertyIds.includes(prop.id)}
                      onCheckedChange={() => togglePropertySelection(prop.id)}
                      data-testid={`scope-property-${prop.id}`}
                    />
                    <span className="text-sm text-white">{prop.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingContractorScope(null)}
              className="border-white/10 text-white"
            >
              Annuleren
            </Button>
            <Button
              onClick={handleSaveContractorScope}
              disabled={savingScope || (scopeMode === "specific" && selectedPropertyIds.length === 0)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {savingScope ? "Opslaan..." : "Wijzigingen opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Property AlertDialog */}
      <AlertDialog open={!!pendingDeleteProperty} onOpenChange={(open) => !open && setPendingDeleteProperty(null)}>
        <AlertDialogContent className="bg-[#161425] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Pand verwijderen?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Bent u zeker dat u <strong className="text-white">{pendingDeleteProperty?.name}</strong> wilt verwijderen? Dit kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white bg-transparent hover:bg-white/5">
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProperty}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LandlordProfilePage;
