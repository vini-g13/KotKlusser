import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { 
  Plus, Search, LogOut, User, Clock, 
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle, 
  CheckCircle, AlertCircle, Calendar, ArrowRight
} from "lucide-react";
import { motion } from "framer-motion";
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

const StudentDashboard = () => {
  const { user, logout, authAxios } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await authAxios.get("/tickets");
      setTickets(response.data);
    } catch (error) {
      toast.error("Kon meldingen niet laden");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
    toast.success("U bent uitgelogd");
  };

  const filteredTickets = tickets.filter(ticket => 
    ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openTickets = tickets.filter(t => t.status !== 'opgelost').length;
  const resolvedTickets = tickets.filter(t => t.status === 'opgelost').length;

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="text-xl font-bold text-white font-['Outfit']">
                Kot<span className="text-indigo-500">Melding</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.name}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleLogout}
                className="text-slate-400 hover:text-white"
                data-testid="logout-btn"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Welcome section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-['Outfit']">
              Hallo, {user?.name?.split(' ')[0]}!
            </h1>
            <p className="text-slate-400 mt-1">Beheer uw defectmeldingen</p>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="grid grid-cols-2 gap-4 mb-8"
          >
            <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{openTickets}</p>
                  <p className="text-sm text-slate-400">Open meldingen</p>
                </div>
              </div>
            </div>
            <div className="bg-[#161425] border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{resolvedTickets}</p>
                  <p className="text-sm text-slate-400">Opgelost</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-6"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <Input
                type="text"
                placeholder="Zoek op titel of ticketnummer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
                data-testid="search-input"
              />
            </div>
          </motion.div>

          {/* Tickets list */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : filteredTickets.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#161425] flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Geen meldingen gevonden</h3>
                <p className="text-slate-400 mb-6">
                  {searchQuery ? "Probeer een andere zoekterm" : "Begin door een nieuwe melding aan te maken"}
                </p>
                {!searchQuery && (
                  <Link to="/nieuw-melding">
                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="empty-new-report-btn">
                      <Plus className="w-4 h-4 mr-2" />
                      Nieuwe melding
                    </Button>
                  </Link>
                )}
              </motion.div>
            ) : (
              filteredTickets.map((ticket, idx) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                >
                  <Link to={`/ticket/${ticket.id}`}>
                    <div 
                      className="bg-[#161425] border border-white/5 rounded-xl p-4 hover:border-indigo-500/30 transition-colors group"
                      data-testid={`ticket-card-${ticket.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`category-${ticket.category}`}>
                              {categoryIcons[ticket.category]}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {ticket.ticket_number}
                            </span>
                          </div>
                          <h3 className="text-white font-medium truncate group-hover:text-indigo-400 transition-colors">
                            {ticket.title}
                          </h3>
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                            {ticket.description}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(ticket.created_at), "d MMM yyyy", { locale: nl })}
                            </span>
                            {ticket.scheduled_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Gepland: {format(new Date(ticket.scheduled_date), "d MMM", { locale: nl })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={`status-${ticket.status} text-xs`}>
                            {statusLabels[ticket.status]}
                          </Badge>
                          <Badge className={`priority-${ticket.urgency} text-xs`}>
                            {ticket.urgency}
                          </Badge>
                          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all mt-2" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <Link to="/nieuw-melding">
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-lg glow-primary flex items-center justify-center text-white z-40"
          data-testid="fab-new-report-btn"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </Link>
    </div>
  );
};

export default StudentDashboard;
