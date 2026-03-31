import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { 
  Search, LogOut, User, Clock, Menu, X, Plus, Mail,
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle,
  CheckCircle, AlertCircle, Calendar, ArrowRight, BarChart3, Bell, Home, Building2, Users, MapPin, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const categoryIcons = {
  sanitair: <Wrench className="w-4 h-4" />,
  elektriciteit: <Zap className="w-4 h-4" />,
  verwarming: <Flame className="w-4 h-4" />,
  internet: <Wifi className="w-4 h-4" />,
  keuken: <ChefHat className="w-4 h-4" />,
  anders: <HelpCircle className="w-4 h-4" />
};

const statusLabels = {
  verstuurd: "Verstuurd",
  ontvangen: "Ontvangen",
  in_behandeling: "In Behandeling",
  opgelost: "Opgelost"
};

const LandlordDashboard = () => {
  const { user, logout, authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(searchParams.get('property') || 'all');
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // New property dialog
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [newPropertyData, setNewPropertyData] = useState({ name: "", address: "", floor_count: "" });
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [showFloorConfirm, setShowFloorConfirm] = useState(false);
  
  // Email change requests
  const [pendingEmailRequests, setPendingEmailRequests] = useState([]);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    const handlePropertiesUpdated = () => {
      fetchProperties();
    };
    window.addEventListener('propertiesUpdated', handlePropertiesUpdated);
    return () => window.removeEventListener('propertiesUpdated', handlePropertiesUpdated);
  }, []);

  useEffect(() => {
    if (properties.length > 0 || selectedProperty === 'all') {
      fetchData();
    }
  }, [selectedProperty, statusFilter, categoryFilter, urgencyFilter, properties]);

  const fetchProperties = async () => {
    try {
      const [propsRes, emailReqsRes] = await Promise.all([
        authAxios.get("/properties"),
        authAxios.get("/email-change-requests/pending")
      ]);
      setProperties(propsRes.data);
      setPendingEmailRequests(emailReqsRes.data);
    } catch (error) {
      console.error("Failed to fetch properties", error);
    }
  };

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (urgencyFilter !== 'all') params.append('urgency', urgencyFilter);
      if (selectedProperty !== 'all') params.append('property_id', selectedProperty);
      
      const [ticketsRes, statsRes] = await Promise.all([
        authAxios.get(`/tickets?${params.toString()}`),
        authAxios.get(`/stats/dashboard${selectedProperty !== 'all' ? `?property_id=${selectedProperty}` : ''}`)
      ]);
      setTickets(ticketsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error("Kon gegevens niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };

  const sendReminders = async () => {
    try {
      const response = await authAxios.post('/admin/send-reminders');
      toast.success(response.data.message);
    } catch (error) {
      toast.error("Kon herinneringen niet versturen");
    }
  };

  const submitNewProperty = async () => {
    setCreatingProperty(true);
    try {
      const response = await authAxios.post("/properties", newPropertyData);
      setProperties([...properties, response.data]);
      setNewPropertyData({ name: "", address: "", floor_count: "" });
      setShowNewProperty(false);
      await refreshUser();
      toast.success("Pand aangemaakt!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setCreatingProperty(false);
    }
  };

  const createProperty = async () => {
    if (!newPropertyData.name.trim() || !newPropertyData.address.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (newPropertyData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    if (newPropertyData.floor_count === 0) {
      setShowFloorConfirm(true);
      return;
    }
    await submitNewProperty();
  };

  const filteredTickets = tickets
    .filter(ticket =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.created_by_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aResolved = a.status === 'opgelost' ? 1 : 0;
      const bResolved = b.status === 'opgelost' ? 1 : 0;
      if (aResolved !== bResolved) return aResolved - bResolved;
      return 0;
    });

  const selectedPropertyName = selectedProperty === 'all' 
    ? 'Alle panden' 
    : properties.find(p => p.id === selectedProperty)?.name || 'Pand';

  return (
    <div className="min-h-screen bg-[#0B0A14] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#12111F] border-r border-white/5">
        <div className="flex items-center h-16 px-6 border-b border-white/5">
          <span className="text-xl font-bold text-white font-['Outfit']">
            Kot<span className="text-indigo-500">Klusser</span>
          </span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Dashboard link */}
          <button
            onClick={() => setSelectedProperty('all')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              selectedProperty === 'all' 
                ? 'bg-indigo-600/10 text-indigo-400' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
            data-testid="nav-all-properties"
          >
            <Home className="w-5 h-5" />
            Alle panden
          </button>

          {/* Properties section */}
          <div className="pt-4">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Panden
            </p>
            
            {properties.map((prop) => (
              <button
                key={prop.id}
                onClick={() => setSelectedProperty(prop.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  selectedProperty === prop.id 
                    ? 'bg-indigo-600/10 text-indigo-400' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
                data-testid={`nav-property-${prop.id}`}
              >
                <Building2 className="w-5 h-5" />
                <div className="flex-1 text-left min-w-0">
                  <p className="truncate">{prop.name}</p>
                  <p className="text-xs text-slate-500">{prop.tenant_count} huurders</p>
                </div>
              </button>
            ))}

            {/* Add property button */}
            <Dialog open={showNewProperty} onOpenChange={setShowNewProperty}>
              <DialogTrigger asChild>
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
                  data-testid="add-property-btn"
                >
                  <Plus className="w-5 h-5" />
                  Pand toevoegen
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#161425] border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white">Nieuw pand toevoegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Naam van het pand</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={newPropertyData.name}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, name: e.target.value })}
                        placeholder="Bijv. Studentenhuis De Brug"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                        data-testid="new-property-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Adres</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        value={newPropertyData.address}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, address: e.target.value })}
                        placeholder="Bijv. Naamsestraat 123, 3000 Leuven"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                        data-testid="new-property-address"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Aantal verdiepingen</Label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <Input
                        type="number"
                        min="0"
                        value={newPropertyData.floor_count === "" ? "" : newPropertyData.floor_count}
                        onChange={(e) => setNewPropertyData({ ...newPropertyData, floor_count: e.target.value === "" ? "" : Number(e.target.value) })}
                        placeholder="Bijv. 3"
                        className="pl-10 bg-[#1C1A2E] border-white/10 text-white placeholder:text-slate-500"
                        data-testid="new-property-floors"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      {newPropertyData.floor_count === "" || newPropertyData.floor_count === 0
                        ? "Genereert automatisch de verdiepingen van uw pand"
                        : `Genereert: Gelijkvloers + Verdieping 1 t/m ${newPropertyData.floor_count}`}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewProperty(false)}
                    className="border-white/10 text-white"
                  >
                    Annuleren
                  </Button>
                  <Button
                    onClick={createProperty}
                    disabled={creatingProperty}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                    data-testid="confirm-create-property"
                  >
                    Pand aanmaken
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link to="/verhuurder/profiel" className="flex items-center gap-3 mb-4 group" data-testid="landlord-profile-link">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors">{user?.name}</p>
              <p className="text-xs text-slate-400">Verhuurder</p>
            </div>
          </Link>
          <Button 
            variant="outline" 
            className="w-full border-white/10 text-slate-400 hover:text-white"
            onClick={handleLogout}
            data-testid="sidebar-logout-btn"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Uitloggen
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 glass">
        <div className="flex items-center justify-between h-16 px-4">
          <button onClick={() => setSidebarOpen(true)} className="text-white" data-testid="mobile-menu-btn">
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-xl font-bold text-white font-['Outfit']">
            Kot<span className="text-indigo-500">Klusser</span>
          </span>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-400">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 z-50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 25 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-[#12111F] z-50 overflow-y-auto"
            >
              <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                <span className="text-xl font-bold text-white font-['Outfit']">
                  Kot<span className="text-indigo-500">Klusser</span>
                </span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="px-4 py-6 space-y-2">
                <button
                  onClick={() => { setSelectedProperty('all'); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    selectedProperty === 'all' 
                      ? 'bg-indigo-600/10 text-indigo-400' 
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  Alle panden
                </button>

                <div className="pt-4">
                  <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Panden
                  </p>
                  {properties.map((prop) => (
                    <button
                      key={prop.id}
                      onClick={() => { setSelectedProperty(prop.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        selectedProperty === prop.id 
                          ? 'bg-indigo-600/10 text-indigo-400' 
                          : 'text-slate-400 hover:bg-white/5'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="truncate">{prop.name}</p>
                        <p className="text-xs text-slate-500">{prop.tenant_count} huurders</p>
                      </div>
                    </button>
                  ))}
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floor count confirmation dialog */}
      <Dialog open={showFloorConfirm} onOpenChange={setShowFloorConfirm}>
        <DialogContent className="bg-[#161425] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Bevestiging aantal verdiepingen</DialogTitle>
          </DialogHeader>
          <p className="text-slate-300 py-2">
            Uw pand heeft enkel een gelijkvloers, zonder extra verdiepingen. Klopt dit?
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFloorConfirm(false)}
              className="border-white/10 text-white"
            >
              Nee, aanpassen
            </Button>
            <Button
              onClick={() => { setShowFloorConfirm(false); submitNewProperty(); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="confirm-floor-zero"
            >
              Ja, bevestigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-20 lg:pt-8 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">
                  {selectedPropertyName}
                </h1>
                <p className="text-slate-400 mt-1">
                  {selectedProperty === 'all' ? 'Overzicht van alle meldingen' : 'Meldingen voor dit pand'}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedProperty !== 'all' && (
                  <Link to={`/pand/${selectedProperty}`}>
                    <Button variant="outline" className="border-white/10 text-white" data-testid="view-property-btn">
                      <Users className="w-4 h-4 mr-2" />
                      Huurders
                    </Button>
                  </Link>
                )}
                <Button 
                  onClick={sendReminders}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="send-reminders-btn"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Herinneringen
                </Button>
              </div>
            </div>

            {/* Pending Email Change Requests Banner */}
            {pendingEmailRequests.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-amber-400 font-medium">
                      {pendingEmailRequests.length} emailwijziging{pendingEmailRequests.length > 1 ? 'en' : ''} wacht{pendingEmailRequests.length > 1 ? 'en' : ''} op goedkeuring
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Studenten hebben aangevraagd hun emailadres te wijzigen
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pendingEmailRequests.map((req) => (
                        <Link key={req.id} to={`/email-wijziging/${req.approval_token || req.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 h-8"
                            data-testid={`email-request-${req.id}`}
                          >
                            {req.student_name}
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Stats cards */}
            {stats && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              >
                <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.total}</p>
                      <p className="text-sm text-slate-400">Totaal</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.open}</p>
                      <p className="text-sm text-slate-400">Open</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.urgent}</p>
                      <p className="text-sm text-slate-400">Urgent</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{stats.resolved}</p>
                      <p className="text-sm text-slate-400">Opgelost</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col sm:flex-row gap-4 mb-6"
            >
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <Input
                  type="text"
                  placeholder="Zoek op titel, nummer of student..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
                  data-testid="search-input"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-[#161425] border-white/10 text-white" data-testid="status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161425] border-white/10">
                    <SelectItem value="all">Alle status</SelectItem>
                    <SelectItem value="verstuurd">Verstuurd</SelectItem>
                    <SelectItem value="ontvangen">Ontvangen</SelectItem>
                    <SelectItem value="in_behandeling">In Behandeling</SelectItem>
                    <SelectItem value="opgelost">Opgelost</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[140px] bg-[#161425] border-white/10 text-white" data-testid="category-filter">
                    <SelectValue placeholder="Categorie" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161425] border-white/10">
                    <SelectItem value="all">Alle categorieën</SelectItem>
                    <SelectItem value="sanitair">Sanitair</SelectItem>
                    <SelectItem value="elektriciteit">Elektriciteit</SelectItem>
                    <SelectItem value="verwarming">Verwarming</SelectItem>
                    <SelectItem value="internet">Internet</SelectItem>
                    <SelectItem value="keuken">Keuken</SelectItem>
                    <SelectItem value="anders">Anders</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                  <SelectTrigger className="w-[130px] bg-[#161425] border-white/10 text-white" data-testid="urgency-filter">
                    <SelectValue placeholder="Urgentie" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161425] border-white/10">
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="hoog">Hoog</SelectItem>
                    <SelectItem value="normaal">Normaal</SelectItem>
                    <SelectItem value="laag">Laag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>

            {/* Tickets table/list */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-[#161425] border border-white/5 rounded-xl overflow-hidden"
            >
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1C1A2E] flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">Geen meldingen gevonden</h3>
                  <p className="text-slate-400">Pas uw filters aan of wacht op nieuwe meldingen</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredTickets.map((ticket, idx) => (
                    <Link key={ticket.id} to={`/ticket/${ticket.id}`}>
                      <div 
                        className="p-4 hover:bg-white/5 transition-colors group"
                        data-testid={`landlord-ticket-${ticket.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-${ticket.category === 'elektriciteit' ? 'yellow' : ticket.category === 'sanitair' ? 'blue' : ticket.category === 'verwarming' ? 'red' : ticket.category === 'internet' ? 'emerald' : 'purple'}-500/20`}>
                            <span className={`category-${ticket.category}`}>
                              {categoryIcons[ticket.category]}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-xs text-slate-500 font-mono">
                                {ticket.ticket_number}
                              </span>
                              <Badge className={`status-${ticket.status} text-xs`}>
                                {statusLabels[ticket.status]}
                              </Badge>
                              <Badge className={`priority-${ticket.urgency} text-xs`}>
                                {ticket.urgency}
                              </Badge>
                              {ticket.property_name && selectedProperty === 'all' && (
                                <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs">
                                  {ticket.property_name}
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors">
                              {ticket.title}
                            </h3>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {ticket.created_by_name}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                              </span>
                              {ticket.scheduled_date && (
                                <span className="flex items-center gap-1 text-indigo-400">
                                  <Calendar className="w-3 h-3" />
                                  Gepland: {format(new Date(ticket.scheduled_date), "d MMM", { locale: nl })}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandlordDashboard;
