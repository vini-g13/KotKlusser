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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, Send, Upload, Clock, MapPin, User, Image, X,
  Wrench, Zap, Flame, Wifi, ChefHat, HelpCircle, CalendarIcon, Check
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const categoryIcons = {
  sanitair: <Wrench className="w-5 h-5" />,
  elektriciteit: <Zap className="w-5 h-5" />,
  verwarming: <Flame className="w-5 h-5" />,
  internet: <Wifi className="w-5 h-5" />,
  keuken: <ChefHat className="w-5 h-5" />,
  anders: <HelpCircle className="w-5 h-5" />
};

const statusLabels = {
  ontvangen: "Ontvangen",
  in_behandeling: "In Behandeling",
  ingepland: "Ingepland",
  in_uitvoering: "In Uitvoering",
  opgelost: "Opgelost"
};

const statusOrder = ['ontvangen', 'in_behandeling', 'ingepland', 'in_uitvoering', 'opgelost'];

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
  const [selectedImage, setSelectedImage] = useState(null);
  const [scheduledDate, setScheduledDate] = useState(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!ticket) return null;

  const currentStatusIndex = statusOrder.indexOf(ticket.status);

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
          <Badge className={`status-${ticket.status}`}>
            {statusLabels[ticket.status]}
          </Badge>
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
              <p className="text-sm text-slate-400 mb-3">Status</p>
              <div className="flex items-center gap-2">
                {statusOrder.map((status, idx) => (
                  <div key={status} className="flex items-center">
                    <div 
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        idx <= currentStatusIndex 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-white/5 text-slate-500'
                      }`}
                    >
                      {idx < currentStatusIndex ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    {idx < statusOrder.length - 1 && (
                      <div className={`w-8 h-0.5 ${idx < currentStatusIndex ? 'bg-indigo-600' : 'bg-white/10'}`} />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>Ontvangen</span>
                <span>In Behandeling</span>
                <span>Ingepland</span>
                <span>In Uitvoering</span>
                <span>Opgelost</span>
              </div>
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
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5">
                  <MapPin className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Locatie</p>
                  <p className="text-white capitalize">{ticket.location}</p>
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
                <p className="text-sm text-slate-400 mb-3">Foto's</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {ticket.photos.map((photo, idx) => (
                    <Dialog key={idx}>
                      <DialogTrigger asChild>
                        <button className="shrink-0" data-testid={`photo-${idx}`}>
                          <img 
                            src={photo} 
                            alt={`Foto ${idx + 1}`}
                            className="w-24 h-24 object-cover rounded-lg hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#161425] border-white/10 max-w-3xl">
                        <img src={photo} alt={`Foto ${idx + 1}`} className="w-full h-auto rounded-lg" />
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>
              </div>
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
                        <SelectItem value="ontvangen">Ontvangen</SelectItem>
                        <SelectItem value="in_behandeling">In Behandeling</SelectItem>
                        <SelectItem value="ingepland">Ingepland</SelectItem>
                        <SelectItem value="in_uitvoering">In Uitvoering</SelectItem>
                        <SelectItem value="opgelost">Opgelost</SelectItem>
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
                messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[80%] p-3 ${
                        msg.sender_role === 'landlord' 
                          ? 'chat-bubble-landlord text-white' 
                          : 'chat-bubble-student text-slate-200'
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
