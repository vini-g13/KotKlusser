import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";
import { 
  Search, LogOut, User, Clock, Menu, X,
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle, 
  CheckCircle, AlertCircle, Calendar, ArrowRight, BarChart3, Bell, Home
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
  ontvangen: "Ontvangen",
  in_behandeling: "In Behandeling",
  ingepland: "Ingepland",
  in_uitvoering: "In Uitvoering",
  opgelost: "Opgelost"
};

const LandlordDashboard = () => {
  const { user, logout, authAxios } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [statusFilter, categoryFilter, urgencyFilter]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (urgencyFilter !== 'all') params.append('urgency', urgencyFilter);
      
      const [ticketsRes, statsRes] = await Promise.all([
        authAxios.get(`/tickets?${params.toString()}`),
        authAxios.get('/stats/dashboard')
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

  const filteredTickets = tickets.filter(ticket => 
    ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.created_by_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0B0A14] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#12111F] border-r border-white/5">
        <div className="flex items-center h-16 px-6 border-b border-white/5">
          <span className="text-xl font-bold text-white font-['Outfit']">
            Kot<span className="text-indigo-500">Melding</span>
          </span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <Link to="/verhuurder" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-600/10 text-indigo-400">
            <Home className="w-5 h-5" />
            Dashboard
          </Link>
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400">Verhuurder</p>
            </div>
          </div>
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
            Kot<span className="text-indigo-500">Melding</span>
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
              className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-[#12111F] z-50"
            >
              <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                <span className="text-xl font-bold text-white font-['Outfit']">
                  Kot<span className="text-indigo-500">Melding</span>
                </span>
                <button onClick={() => setSidebarOpen(false)} className="text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="px-4 py-6 space-y-2">
                <Link to="/verhuurder" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-600/10 text-indigo-400">
                  <Home className="w-5 h-5" />
                  Dashboard
                </Link>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        <div className="pt-20 lg:pt-8 pb-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">
                  Dashboard
                </h1>
                <p className="text-slate-400 mt-1">Overzicht van alle meldingen</p>
              </div>
              <Button 
                onClick={sendReminders}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="send-reminders-btn"
              >
                <Bell className="w-4 h-4 mr-2" />
                Verstuur herinneringen
              </Button>
            </div>

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
                    <SelectItem value="ontvangen">Ontvangen</SelectItem>
                    <SelectItem value="in_behandeling">In Behandeling</SelectItem>
                    <SelectItem value="ingepland">Ingepland</SelectItem>
                    <SelectItem value="in_uitvoering">In Uitvoering</SelectItem>
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
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-slate-500 font-mono">
                                {ticket.ticket_number}
                              </span>
                              <Badge className={`status-${ticket.status} text-xs`}>
                                {statusLabels[ticket.status]}
                              </Badge>
                              <Badge className={`priority-${ticket.urgency} text-xs`}>
                                {ticket.urgency}
                              </Badge>
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
