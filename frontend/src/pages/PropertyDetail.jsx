import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, Copy, RefreshCw, Users, Ticket, Trash2, 
  MapPin, Building2, Link as LinkIcon, Eye, ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const PropertyDetail = () => {
  const { id } = useParams();
  const { authAxios } = useAuth();
  const navigate = useNavigate();
  
  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [removingTenant, setRemovingTenant] = useState(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const reload = () => fetchProperty();
    window.addEventListener('propertiesUpdated', reload);
    window.addEventListener('focus', reload);
    return () => {
      window.removeEventListener('propertiesUpdated', reload);
      window.removeEventListener('focus', reload);
    };
  }, []);

  const fetchProperty = async () => {
    try {
      const propRes = await authAxios.get(`/properties/${id}`);
      setProperty(propRes.data);
    } catch (error) {
      // silently fail on background reload
    }
  };

  const fetchData = async () => {
    try {
      const [propRes, tenantsRes] = await Promise.all([
        authAxios.get(`/properties/${id}`),
        authAxios.get(`/properties/${id}/tenants`)
      ]);
      setProperty(propRes.data);
      setTenants(tenantsRes.data);
    } catch (error) {
      toast.error("Kon pand niet laden");
      navigate("/verhuurder");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} gekopieerd!`);
  };

  const regenerateCode = async () => {
    setRegenerating(true);
    try {
      const response = await authAxios.post(`/properties/${id}/regenerate-code`);
      setProperty(response.data);
      toast.success("Nieuwe join code gegenereerd!");
    } catch (error) {
      toast.error("Kon code niet regenereren");
    } finally {
      setRegenerating(false);
    }
  };

  const removeTenant = async (tenantId) => {
    try {
      await authAxios.delete(`/properties/${id}/tenants/${tenantId}`);
      setTenants(tenants.filter(t => t.id !== tenantId));
      toast.success("Huurder verwijderd uit pand");
    } catch (error) {
      toast.error("Kon huurder niet verwijderen");
    } finally {
      setRemovingTenant(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!property) return null;

  return (
    <div className="min-h-screen bg-[#0B0A14]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/verhuurder" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-medium truncate">{property.name}</h1>
            <p className="text-xs text-slate-400 truncate">{property.address}</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-24 pb-8 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Property Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-[#161425] border border-white/5 rounded-xl p-6"
          >
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-white mb-1">{property.name}</h2>
                <p className="text-slate-400 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {property.address}
                </p>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                {property.tenant_count} huurders
              </Badge>
            </div>

            {/* Join Code Section */}
            <div className="bg-[#1C1A2E] rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Uitnodigingscode</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={regenerateCode}
                  disabled={regenerating}
                  className="text-slate-400 hover:text-white"
                  data-testid="regenerate-code-btn"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                  Nieuwe code
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[#0B0A14] border border-white/10 rounded-lg px-4 py-3 font-mono text-lg text-white tracking-wider">
                  {property.join_code}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(property.join_code, "Code")}
                  className="border-white/10 text-slate-400 hover:text-white shrink-0"
                  data-testid="copy-code-btn"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>

              <p className="text-xs text-slate-500">
                Deel deze code met studenten zodat zij zich kunnen aanmelden bij dit pand.
              </p>
            </div>
          </motion.div>

          {/* Tenants Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-[#161425] border border-white/5 rounded-xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-white font-medium flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                Huurders ({tenants.length})
              </h3>
            </div>

            {tenants.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1C1A2E] flex items-center justify-center">
                  <Users className="w-8 h-8 text-slate-500" />
                </div>
                <h4 className="text-white font-medium mb-2">Nog geen huurders</h4>
                <p className="text-slate-400 text-sm mb-4">
                  Deel de uitnodigingscode met uw studenten
                </p>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(property.join_code, "Code")}
                  className="border-white/10 text-white"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Kopieer code
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tenants.map((tenant) => (
                  <div key={tenant.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-medium shrink-0">
                        {tenant.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium">{tenant.name}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>Kamer {tenant.room_number}</span>
                          <span>Verdieping {tenant.floor}</span>
                          <span>{tenant.ticket_count} meldingen</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link to={`/verhuurder?tenant=${tenant.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                            data-testid={`view-tickets-${tenant.id}`}
                          >
                            <Ticket className="w-4 h-4 mr-1" />
                            Meldingen
                          </Button>
                        </Link>
                        <Dialog open={removingTenant === tenant.id} onOpenChange={(open) => !open && setRemovingTenant(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              onClick={() => setRemovingTenant(tenant.id)}
                              data-testid={`remove-tenant-${tenant.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#161425] border-white/10">
                            <DialogHeader>
                              <DialogTitle className="text-white">Huurder verwijderen?</DialogTitle>
                            </DialogHeader>
                            <p className="text-slate-400">
                              Weet u zeker dat u <strong className="text-white">{tenant.name}</strong> wilt verwijderen uit dit pand? 
                              De student kan zich opnieuw aanmelden met een geldige uitnodigingscode.
                            </p>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setRemovingTenant(null)}
                                className="border-white/10 text-white"
                              >
                                Annuleren
                              </Button>
                              <Button
                                onClick={() => removeTenant(tenant.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                                data-testid="confirm-remove-tenant"
                              >
                                Verwijderen
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default PropertyDetail;
