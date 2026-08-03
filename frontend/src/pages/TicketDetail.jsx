import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Upload, Clock, MapPin, User, X,
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle, CalendarIcon, Bell,
  Search, UserPlus, UserMinus, HardHat
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import TicketStatusStepper, { STATUS_ORDER, STATUS_LABELS } from "../components/TicketStatusStepper";
import TicketPhotoGallery from "../components/TicketPhotoGallery";
import UrgencyBadge from "../components/UrgencyBadge";

const categoryIcons = {
  sanitair: <Wrench className="w-5 h-5" />,
  elektriciteit: <Zap className="w-5 h-5" />,
  verwarming: <Flame className="w-5 h-5" />,
  internet: <Wifi className="w-5 h-5" />,
  keuken: <ChefHat className="w-5 h-5" />,
  anders: <HelpCircle className="w-5 h-5" />
};

const TicketDetail = () => {
  const { id } = useParams();
  const { user, authAxios } = useAuth();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [aannemerSearch, setAannemerSearch] = useState("");
  const [aannemerResults, setAannemerResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchData = async () => {
    try {
      const [ticketRes, messagesRes] = await Promise.all([
        authAxios.get(`/tickets/${id}`),
        authAxios.get(`/tickets/${id}/messages`)
      ]);
      setTicket(ticketRes.data);
      setMessages(messagesRes.data);
      if (ticketRes.data.scheduled_date) {
        setScheduledDate(new Date(ticketRes.data.scheduled_date));
      }
      if (user?.role === 'student') {
        try {
          await authAxios.post(`/tickets/${id}/mark-read-student`);
        } catch (err) {
          console.error('Mark read error:', err);
        }
      }
    } catch (error) {
      toast.error("Kon ticket niet laden");
      navigate(user?.role === 'landlord' ? '/verhuurder' : '/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await authAxios.post(`/tickets/${id}/messages`, {
        content: newMessage
      });
      setMessages([...messages, response.data]);
      setNewMessage("");
      toast.success("Bericht verzonden");
    } catch (error) {
      toast.error("Kon bericht niet verzenden");
    } finally {
      setSending(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    try {
      const response = await authAxios.patch(`/tickets/${id}`, {
        status: newStatus,
        scheduled_date: scheduledDate?.toISOString()
      });
      setTicket(response.data);
      toast.success("Status bijgewerkt");
    } catch (error) {
      toast.error("Kon status niet bijwerken");
    } finally {
      setUpdating(false);
    }
  };

  const handleScheduleDate = async (date) => {
    setScheduledDate(date);
    setUpdating(true);
    try {
      const response = await authAxios.patch(`/tickets/${id}`, {
        scheduled_date: date?.toISOString()
      });
      setTicket(response.data);
      toast.success("Reparatiedatum ingepland");
    } catch (error) {
      toast.error("Kon datum niet opslaan");
    } finally {
      setUpdating(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await authAxios.post(`/tickets/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await fetchData();
      toast.success("Foto toegevoegd");
    } catch (error) {
      toast.error("Kon foto niet uploaden");
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      const response = await authAxios.post(`/tickets/${id}/send-reminder`);
      if (response.data.reminder_message) {
        setMessages(prev => [...prev, response.data.reminder_message]);
      }
      toast.success(response.data.message);
      setShowReminderDialog(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Kon herinnering niet versturen");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleSearchAannemers = async (q) => {
    setAannemerSearch(q);
    if (q.length < 2) { setAannemerResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await authAxios.get(`/contractors/search?q=${encodeURIComponent(q)}`);
      setAannemerResults(res.data);
    } catch {
      setAannemerResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAssignAannemer = async (aannemer) => {
    setAssignLoading(true);
    try {
      await authAxios.post(`/tickets/${id}/assign-contractor`, { contractor_id: aannemer.id });
      setTicket(prev => ({ ...prev, assigned_to: aannemer.id, assigned_to_name: aannemer.name, assigned_to_specialty: aannemer.specialty }));
      setAannemerSearch("");
      setAannemerResults([]);
      toast.success(`${aannemer.name} toegewezen`);
    } catch {
      toast.error("Toewijzen mislukt");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveAannemer = async () => {
    setAssignLoading(true);
    try {
      await authAxios.delete(`/tickets/${id}/assign-contractor`);
      setTicket(prev => ({ ...prev, assigned_to: null, assigned_to_name: null, assigned_to_specialty: null }));
      toast.success("Aannemer verwijderd");
    } catch {
      toast.error("Verwijderen mislukt");
    } finally {
      setAssignLoading(false);
    }
  };

  const getMessageDateLabel = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const dayBefore = new Date(today); dayBefore.setDate(today.getDate() - 2);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = format(date, "HH:mm", { locale: nl });

    if (msgDay.getTime() === today.getTime()) return `Vandaag ${timeStr}`;
    if (msgDay.getTime() === yesterday.getTime()) return `Gisteren ${timeStr}`;
    if (msgDay.getTime() === dayBefore.getTime()) return `Eergisteren ${timeStr}`;
    return format(date, "d MMMM yyyy", { locale: nl });
  };

  const shouldShowDateSeparator = (messages, index) => {
    if (index === 0) return true;
    const current = new Date(messages[index].created_at);
    const previous = new Date(messages[index - 1].created_at);
    return current.toDateString() !== previous.toDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="min-h-screen bg-[#0B0A14] flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            to={user?.role === 'landlord' ? '/verhuurder' : '/dashboard'}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 font-mono">{ticket.ticket_number}</p>
            <h1 className="text-white font-medium truncate">{ticket.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <UrgencyBadge urgency={ticket.urgency} />
            <Badge className={`status-${ticket.status}`}>
              {STATUS_LABELS[ticket.status]}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pt-20 pb-24">
        <div className="max-w-4xl mx-auto px-4">
          {/* Ticket info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6 mb-6"
          >
            {/* Status timeline */}
            <div className="mb-6">
              <TicketStatusStepper status={ticket.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-${ticket.category === 'elektriciteit' ? 'yellow' : 'indigo'}-500/20`}>
                  <span className={`category-${ticket.category}`}>
                    {categoryIcons[ticket.category]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Categorie</p>
                  <p className="text-white capitalize">{ticket.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 shrink-0">
                  <MapPin className="w-5 h-5 text-slate-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400">Locatie</p>
                  <p className="text-white capitalize">
                    {ticket.location === 'gemeenschappelijk' ? (
                      <>
                        <span className="sm:hidden">Gem. ruimte</span>
                        <span className="hidden sm:inline">Gemeenschappelijk</span>
                      </>
                    ) : (
                      ticket.location
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Gemeld door</p>
                  <p className="text-white">{ticket.created_by_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Aangemaakt</p>
                  <p className="text-white">{format(new Date(ticket.created_at), "d MMM yyyy", { locale: nl })}</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-slate-400 mb-2">Beschrijving</p>
              <p className="text-slate-300">{ticket.description}</p>
            </div>

            {/* Estimated repair date */}
            {ticket.estimated_repair_date && (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg mb-6">
                <p className="text-sm text-indigo-400 mb-1">Geschatte reparatiedatum</p>
                <p className="text-white font-medium">
                  {format(new Date(ticket.estimated_repair_date), "d MMMM yyyy", { locale: nl })}
                </p>
              </div>
            )}

            {/* Photos */}
            {ticket.photos?.length > 0 && (
              <div className="mb-6">
                <TicketPhotoGallery photos={ticket.photos} />
              </div>
            )}

            {user?.role === 'student' && ticket.status !== 'resolved' && (
              <>
                <div className="border-t border-white/5 pt-6">
                  <Button
                    variant="outline"
                    className="border-white/10 text-white hover:bg-white/5"
                    onClick={() => setShowReminderDialog(true)}
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Stuur herinnering naar verhuurder
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">
                    Stuur een herinnering naar uw verhuurder. Maximum 1 per 24 uur per ticket.
                  </p>
                </div>

                <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
                  <DialogContent className="bg-[#161425] border-white/10">
                    <DialogHeader>
                      <DialogTitle className="text-white">Herinnering versturen</DialogTitle>
                    </DialogHeader>
                    <p className="text-slate-300 py-2">
                      Weet u zeker dat u een herinnering wilt sturen naar uw verhuurder voor ticket <strong className="text-white">{ticket.ticket_number}</strong>? Dit verschijnt als bericht in de chat en de verhuurder ontvangt een melding.
                    </p>
                    <DialogFooter className="gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowReminderDialog(false)}
                        className="border-white/10 text-white"
                      >
                        Annuleren
                      </Button>
                      <Button
                        onClick={handleSendReminder}
                        disabled={sendingReminder}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        <Bell className="w-4 h-4 mr-2" />
                        Versturen
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {/* Landlord controls */}
            {user?.role === 'landlord' && (
              <div className="border-t border-white/5 pt-6 space-y-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-slate-400 mb-2">Status wijzigen</p>
                    <Select
                      value={ticket.status}
                      onValueChange={handleStatusUpdate}
                      disabled={updating}
                    >
                      <SelectTrigger className="bg-[#1C1A2E] border-white/10 text-white" data-testid="status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#161425] border-white/10">
                        {STATUS_ORDER.map((s) => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-slate-400 mb-2">Reparatie inplannen</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start bg-[#1C1A2E] border-white/10 text-white hover:bg-white/5"
                          data-testid="schedule-date-btn"
                        >
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {scheduledDate ? format(scheduledDate, "d MMMM yyyy", { locale: nl }) : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-[#161425] border-white/10" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={handleScheduleDate}
                          locale={nl}
                          className="bg-[#161425]"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-slate-400 mb-2">Foto toevoegen</p>
                  <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-white/10 rounded-lg cursor-pointer hover:border-indigo-500/50 transition-colors">
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-400">Klik om foto toe te voegen</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      data-testid="landlord-photo-input"
                    />
                  </label>
                </div>

                {/* Aannemer toewijzen */}
                <div className="border-t border-white/5 pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <HardHat className="w-4 h-4 text-slate-400" />
                    <p className="text-sm text-slate-400">Aannemer</p>
                  </div>

                  {ticket.assigned_to_name ? (
                    <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{ticket.assigned_to_name}</p>
                        {ticket.assigned_to_specialty && (
                          <p className="text-xs text-slate-400 mt-0.5">{ticket.assigned_to_specialty}</p>
                        )}
                      </div>
                      <button
                        onClick={handleRemoveAannemer}
                        disabled={assignLoading}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <UserMinus className="w-4 h-4" />
                        Verwijderen
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          type="text"
                          value={aannemerSearch}
                          onChange={(e) => handleSearchAannemers(e.target.value)}
                          placeholder="Zoek op naam, e-mail, specialiteit of regio..."
                          className="w-full pl-9 pr-4 py-2.5 bg-[#1C1A2E] border border-white/10 rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                        {searchLoading && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>

                      {aannemerResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-[#1C1A2E] border border-white/10 rounded-lg overflow-hidden shadow-xl">
                          {aannemerResults.map((a) => (
                            <button
                              key={a.id}
                              onClick={() => handleAssignAannemer(a)}
                              disabled={assignLoading}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                            >
                              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <UserPlus className="w-4 h-4 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-white font-medium">{a.name}</p>
                                <p className="text-xs text-slate-400 truncate">{a.specialty || a.email}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {aannemerSearch.length >= 2 && !searchLoading && aannemerResults.length === 0 && (
                        <p className="text-xs text-slate-500 mt-2 px-1">
                          Geen aannemers gevonden. Nodig er één uit via het profielscherm.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          {/* Messages */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#161425] border border-white/5 rounded-xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/5">
              <h2 className="text-white font-medium">Berichten</h2>
            </div>

            <div className="p-4 min-h-[300px] max-h-[400px] overflow-y-auto space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Nog geen berichten</p>
                  <p className="text-sm">Start een gesprek over dit ticket</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div key={msg.id}>
                    {shouldShowDateSeparator(messages, index) && (
                      <div className="flex items-center justify-center gap-3 my-4 px-8">
                        <div className="h-px bg-white/10 w-16" />
                        <span className="text-xs text-slate-500 shrink-0">
                          {getMessageDateLabel(msg.created_at)}
                        </span>
                        <div className="h-px bg-white/10 w-16" />
                      </div>
                    )}
                    <div
                      className={`flex ${msg.is_reminder ? '' : msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.is_reminder ? (
                        <div className="flex justify-center my-2 w-full">
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2 text-center max-w-[75%]">
                            <p className="text-amber-400 text-sm">{msg.content}</p>
                            <p className="text-xs text-amber-500/50 mt-1">
                              {format(new Date(msg.created_at), "HH:mm", { locale: nl })}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[80%] p-3 rounded-2xl ${
                            msg.sender_id === user?.id
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-[#2A2840] text-slate-200 rounded-bl-sm'
                          }`}
                          data-testid={`message-${msg.id}`}
                        >
                          {msg.sender_id !== user?.id && (
                            <p className="text-xs opacity-70 mb-1">{msg.sender_name}</p>
                          )}
                          <p className="text-sm">{msg.content}</p>
                          <p className="text-xs opacity-50 mt-1 text-right">
                            {format(new Date(msg.created_at), "HH:mm", { locale: nl })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Message input */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#12111F]/80 backdrop-blur-lg border-t border-white/5 p-4">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-3">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Typ een bericht..."
            className="flex-1 bg-[#161425] border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500"
            data-testid="message-input"
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6"
            data-testid="send-message-btn"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default TicketDetail;
