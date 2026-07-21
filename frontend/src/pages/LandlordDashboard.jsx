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
import PropertyFormFields from "../components/PropertyFormFields";
import FloorCountConfirmDialog from "../components/FloorCountConfirmDialog";
import { useFloorCountConfirm } from "../hooks/useFloorCountConfirm";
import {
  Search, LogOut, User, Clock, Menu, X, Plus, Mail,
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle,
  CheckCircle, AlertCircle, Calendar, ArrowRight, BarChart3, Home, Building2, Users,
  BarChart2, Send, Inbox, AlertTriangle, MessageSquare, Settings
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
  sent: "Verstuurd",
  received: "Ontvangen",
  in_progress: "In Behandeling",
  resolved: "Opgelost"
};

const TILE_DEFINITIONS = {
  total:       { defaultName: 'Totaal',          color: 'indigo',  Icon: BarChart2 },
  open:        { defaultName: 'Open',            color: 'blue',    Icon: Clock },
  urgent:      { defaultName: 'Urgent',          color: 'red',     Icon: Flame },
  resolved:    { defaultName: 'Opgelost',        color: 'emerald', Icon: CheckCircle },
  sent:        { defaultName: 'Verstuurd',       color: 'violet',  Icon: Send },
  received:    { defaultName: 'Ontvangen',       color: 'cyan',    Icon: Inbox },
  in_progress: { defaultName: 'In Behandeling',  color: 'orange',  Icon: Wrench },
  high:        { defaultName: 'Hoog',            color: 'amber',   Icon: AlertTriangle },
  unread:      { defaultName: 'Ongelezen',       color: 'pink',    Icon: MessageSquare },
};

const TILE_COLORS = {
  indigo:  { bg: 'bg-indigo-500/20',  text: 'text-indigo-400',  border: 'border-indigo-500' },
  blue:    { bg: 'bg-blue-500/20',    text: 'text-blue-400',    border: 'border-blue-500' },
  red:     { bg: 'bg-red-500/20',     text: 'text-red-400',     border: 'border-red-500' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500' },
  violet:  { bg: 'bg-violet-500/20',  text: 'text-violet-400',  border: 'border-violet-500' },
  cyan:    { bg: 'bg-cyan-500/20',    text: 'text-cyan-400',    border: 'border-cyan-500' },
  orange:  { bg: 'bg-orange-500/20',  text: 'text-orange-400',  border: 'border-orange-500' },
  amber:   { bg: 'bg-amber-500/20',   text: 'text-amber-400',   border: 'border-amber-500' },
  pink:    { bg: 'bg-pink-500/20',    text: 'text-pink-400',    border: 'border-pink-500' },
};

const DEFAULT_TILES = [
  { key: 'total', label: 'Totaal' },
  { key: 'open', label: 'Open' },
  { key: 'urgent', label: 'Urgent' },
  { key: 'resolved', label: 'Opgelost' },
];

const LandlordDashboard = () => {
  const { user, logout, authAxios, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(searchParams.get('property') || 'all');
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // New property dialog
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [newPropertyData, setNewPropertyData] = useState({
    name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "",
  });
  const [creatingProperty, setCreatingProperty] = useState(false);
  
  // Email change requests
  const [pendingEmailRequests, setPendingEmailRequests] = useState([]);

  // Tile config
  const [activeTileKey, setActiveTileKey] = useState(null);
  const [tileConfig, setTileConfig] = useState(DEFAULT_TILES);
  const [showTileModal, setShowTileModal] = useState(false);
  const [modalTiles, setModalTiles] = useState(DEFAULT_TILES);

  useEffect(() => {
    fetchProperties();
    const loadTileConfig = async () => {
      try {
        const res = await authAxios.get('/auth/me');
        if (res.data.tile_config?.length) {
          setTileConfig(res.data.tile_config);
        }
      } catch {}
    };
    loadTileConfig();
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
    setActiveTileKey(null);
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
      
      const [ticketsRes, statsRes, unreadRes] = await Promise.all([
        authAxios.get(`/tickets?${params.toString()}`),
        authAxios.get(`/stats/dashboard${selectedProperty !== 'all' ? `?property_id=${selectedProperty}` : ''}`),
        authAxios.get('/tickets/unread-counts')
      ]);
      setTickets(ticketsRes.data);
      setStats(statsRes.data);
      setUnreadCounts(unreadRes.data);
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

  const submitNewProperty = async () => {
    setCreatingProperty(true);
    try {
      const response = await authAxios.post("/properties", newPropertyData);
      setProperties([...properties, response.data]);
      setNewPropertyData({ name: "", street: "", house_number: "", postal_code: "", city: "", floor_count: "" });
      setShowNewProperty(false);
      await refreshUser();
      window.dispatchEvent(new CustomEvent('propertiesUpdated'));
      toast.success("Pand aangemaakt!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon pand niet aanmaken");
    } finally {
      setCreatingProperty(false);
    }
  };

  const { showConfirm: showFloorConfirm, requestSubmit: requestCreateProperty, cancel: cancelFloorConfirm, confirm: confirmFloorConfirm } =
    useFloorCountConfirm(submitNewProperty);

  const createProperty = async () => {
    if (!newPropertyData.name.trim() || !newPropertyData.street.trim() || !newPropertyData.house_number.trim()
        || !newPropertyData.postal_code.trim() || !newPropertyData.city.trim()) {
      toast.error("Vul alle velden in");
      return;
    }
    if (newPropertyData.floor_count === "") {
      toast.error("Vul het aantal verdiepingen in");
      return;
    }
    requestCreateProperty(newPropertyData.floor_count);
  };

  const tileStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status !== 'resolved').length,
    urgent: tickets.filter(t => t.urgency === 'urgent').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    sent: tickets.filter(t => t.status === 'sent').length,
    received: tickets.filter(t => t.status === 'received').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    high: tickets.filter(t => t.urgency === 'high').length,
    unread: tickets.filter(t => (unreadCounts[t.id] || 0) > 0).length,
  };

  const getTileFilterFn = (key) => {
    const fns = {
      total: () => true,
      open: t => t.status !== 'resolved',
      urgent: t => t.urgency === 'urgent',
      resolved: t => t.status === 'resolved',
      sent: t => t.status === 'sent',
      received: t => t.status === 'received',
      in_progress: t => t.status === 'in_progress',
      high: t => t.urgency === 'high',
      unread: t => (unreadCounts[t.id] || 0) > 0,
    };
    return fns[key] || (() => true);
  };

  const saveTileConfig = async () => {
    try {
      await authAxios.put('/users/tile-config', { tile_config: modalTiles });
      setTileConfig(modalTiles);
      setShowTileModal(false);
      toast.success('Tegels opgeslagen');
    } catch {
      toast.error('Kon tegels niet opslaan');
    }
  };

  const filteredTickets = tickets
    .filter(ticket =>
      ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.created_by_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(ticket => activeTileKey ? getTileFilterFn(activeTileKey)(ticket) : true)
    .sort((a, b) => {
      const aResolved = a.status === 'resolved' ? 1 : 0;
      const bResolved = b.status === 'resolved' ? 1 : 0;
      if (aResolved !== bResolved) return aResolved - bResolved;
      return 0;
    });

  const selectedPropertyName = selectedProperty === 'all' 
    ? 'Alle panden' 
    : properties.find(p => p.id === selectedProperty)?.name || 'Pand';

  return (
    <div className="min-h-screen bg-[#0B0A14] flex overflow-x-hidden">
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
                <div className="py-4">
                  <PropertyFormFields
                    formData={newPropertyData}
                    onChange={(field, value) => setNewPropertyData({ ...newPropertyData, [field]: value })}
                    testIdPrefix="new-property"
                  />
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
                <button
                  onClick={() => { setShowNewProperty(true); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-500 hover:bg-white/5 hover:text-slate-300 transition-colors"
                  data-testid="mobile-add-property-btn"
                >
                  <Plus className="w-5 h-5" />
                  Pand toevoegen
                </button>
                <div className="border-t border-white/5 mt-4 pt-4">
                  <Link
                    to="/verhuurder/profiel"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg mb-2 group text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
                    data-testid="mobile-profile-link"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium shrink-0">
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
                    onClick={() => { setSidebarOpen(false); handleLogout(); }}
                    data-testid="mobile-sidebar-logout-btn"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Uitloggen
                  </Button>
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floor count confirmation dialog */}
      <FloorCountConfirmDialog open={showFloorConfirm} onCancel={cancelFloorConfirm} onConfirm={confirmFloorConfirm} />

      {/* Main content */}
      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="pt-20 lg:pt-8 pb-8 px-4 sm:px-6 lg:px-8 w-full min-w-0">
          <div className="max-w-6xl mx-auto w-full min-w-0">
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

            {/* Stats tiles */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 w-full"
            >
              {tileConfig.map(({ key, label }) => {
                const def = TILE_DEFINITIONS[key];
                if (!def) return null;
                const colors = TILE_COLORS[def.color];
                const isActive = activeTileKey === key;
                const IconComp = def.Icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTileKey(isActive ? null : key)}
                    className={`bg-[#161425] rounded-xl p-4 text-left transition-all ${
                      isActive
                        ? `border-2 ${colors.border}`
                        : 'border border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
                        <IconComp className={`w-5 h-5 ${colors.text}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">{tileStats[key] ?? 0}</p>
                        <p className="text-sm text-slate-400">{label}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Gear tile */}
              <button
                onClick={() => { setModalTiles(tileConfig); setShowTileModal(true); }}
                className="bg-[#161425] border border-white/10 border-dashed rounded-xl p-4 text-left hover:border-white/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Aanpassen</p>
                  </div>
                </div>
              </button>
            </motion.div>

            {/* Tile personalization modal */}
            <Dialog open={showTileModal} onOpenChange={setShowTileModal}>
              <DialogContent className="bg-[#161425] border-white/10 max-w-md max-h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="text-white">Tegels aanpassen</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-6 py-2">
                  {/* Active tiles */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Actieve tegels</p>
                    <div className="space-y-2">
                      {modalTiles.map(({ key, label }, idx) => {
                        const def = TILE_DEFINITIONS[key];
                        if (!def) return null;
                        const colors = TILE_COLORS[def.color];
                        const IconComp = def.Icon;
                        return (
                          <div key={key} className="flex items-center gap-3 bg-[#1C1A2E] rounded-lg px-3 py-2">
                            <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                              <IconComp className={`w-4 h-4 ${colors.text}`} />
                            </div>
                            <Input
                              value={label}
                              onChange={(e) => {
                                const updated = [...modalTiles];
                                updated[idx] = { ...updated[idx], label: e.target.value };
                                setModalTiles(updated);
                              }}
                              className="flex-1 h-8 bg-transparent border-white/10 text-white text-sm px-2"
                            />
                            <button
                              onClick={() => setModalTiles(modalTiles.filter((_, i) => i !== idx))}
                              className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {modalTiles.length === 0 && (
                        <p className="text-sm text-slate-500 italic">Geen actieve tegels</p>
                      )}
                    </div>
                  </div>

                  {/* Available tiles */}
                  {Object.entries(TILE_DEFINITIONS).filter(([key]) => !modalTiles.some(t => t.key === key)).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Beschikbare tegels</p>
                      <div className="space-y-2">
                        {Object.entries(TILE_DEFINITIONS)
                          .filter(([key]) => !modalTiles.some(t => t.key === key))
                          .map(([key, def]) => {
                            const colors = TILE_COLORS[def.color];
                            const IconComp = def.Icon;
                            return (
                              <div key={key} className="flex items-center gap-3 bg-[#1C1A2E]/50 rounded-lg px-3 py-2">
                                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                                  <IconComp className={`w-4 h-4 ${colors.text}`} />
                                </div>
                                <span className="flex-1 text-sm text-slate-300">{def.defaultName}</span>
                                <button
                                  onClick={() => setModalTiles([...modalTiles, { key, label: def.defaultName }])}
                                  className="text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="border-t border-white/10 pt-4">
                  <Button variant="outline" onClick={() => setShowTileModal(false)} className="border-white/10 text-white">
                    Annuleren
                  </Button>
                  <Button onClick={saveTileConfig} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Opslaan
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
              <div className="flex flex-wrap gap-2 w-full">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] bg-[#161425] border-white/10 text-white" data-testid="status-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#161425] border-white/10">
                    <SelectItem value="all">Alle status</SelectItem>
                    <SelectItem value="sent">Verstuurd</SelectItem>
                    <SelectItem value="received">Ontvangen</SelectItem>
                    <SelectItem value="in_progress">In Behandeling</SelectItem>
                    <SelectItem value="resolved">Opgelost</SelectItem>
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
                    <SelectItem value="high">Hoog</SelectItem>
                    <SelectItem value="normal">Normaal</SelectItem>
                    <SelectItem value="low">Laag</SelectItem>
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
                  {(() => {
                    const sortedTickets = [...filteredTickets].sort((a, b) => {
                      const aResolved = a.status === 'resolved' ? 1 : 0;
                      const bResolved = b.status === 'resolved' ? 1 : 0;
                      if (aResolved !== bResolved) return aResolved - bResolved;
                      const aUnread = unreadCounts[a.id] || 0;
                      const bUnread = unreadCounts[b.id] || 0;
                      if (bUnread !== aUnread) return bUnread - aUnread;
                      return new Date(b.created_at) - new Date(a.created_at);
                    });
                    return sortedTickets.map((ticket, idx) => (
                    <Link key={ticket.id} to={`/ticket/${ticket.id}`}
                      onClick={() => {
                        if (unreadCounts[ticket.id] > 0) {
                          authAxios.post(`/tickets/${ticket.id}/mark-read`);
                          setUnreadCounts(prev => {
                            const updated = { ...prev };
                            delete updated[ticket.id];
                            return updated;
                          });
                        }
                      }}
                    >
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
                          {unreadCounts[ticket.id] > 0 && (
                            <div className="flex items-center justify-center bg-indigo-600 text-white text-xs font-semibold rounded-full min-w-[20px] h-5 px-1.5 shrink-0">
                              {unreadCounts[ticket.id]}
                            </div>
                          )}
                          <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all shrink-0" />
                        </div>
                      </div>
                    </Link>
                  ));
                  })()}
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
