import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./lib/supabaseClient";

// Components
import SessionExpiredScreen from "./components/SessionExpiredScreen";
import CookieConsent from "./components/CookieConsent";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import StudentDashboard from "./pages/StudentDashboard";
import LandlordDashboard from "./pages/LandlordDashboard";
import NewReport from "./pages/NewReport";
import TicketDetail from "./pages/TicketDetail";
import PropertyOnboarding from "./pages/PropertyOnboarding";
import PropertyDetail from "./pages/PropertyDetail";
import JoinProperty from "./pages/JoinProperty";
import ProfilePage from "./pages/ProfilePage";
import LandlordProfilePage from "./pages/LandlordProfilePage";
import EmailChangeApproval from "./pages/EmailChangeApproval";
import ConfirmEmail from "./pages/ConfirmEmail";
import OverOnsPage from "./pages/OverOnsPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import ContactPage from "./pages/ContactPage";
import DemoPage from "./pages/DemoPage";
import PricingPage from "./pages/PricingPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import AannemerDashboard from "./pages/AannemerDashboard";
import AannemerKlusDetail from "./pages/AannemerKlusDetail";
import NotFoundPage from "./pages/NotFoundPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Cleanup sprint 5 (2026-07, kotklusser-cleanup-plan.md sectie 6.1): deze
// AuthProvider praatte voorheen met de eigen backend voor /auth/register,
// /auth/login, /auth/refresh en /auth/logout (custom JWT + refresh_token in
// localStorage). Dat is nu Supabase Auth via supabase-js: sessieopslag en
// automatisch verversen van tokens gebeurt door de Supabase-client zelf
// (zie lib/supabaseClient.js), niet meer handmatig hier. `token` hieronder is
// dus altijd het huidige Supabase access token, opgehaald uit de actieve sessie.
// Bewaarplaats voor profielgegevens uit RegisterPage wanneer Supabase
// "Confirm email" aanstaat: signUp() geeft dan meteen geen sessie terug,
// dus complete-registration kan nog niet aangeroepen worden. We bewaren de
// ingevulde profielgegevens hier tot er wél een sessie is (na het volgen van
// de bevestigingsmail, of bij een latere login), zie fetchProfile hieronder.
const PENDING_REGISTRATION_KEY = 'kotklusser_pending_registration';

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Probeert de profiles-rij alsnog aan te maken voor een account dat wél een
  // geldige Supabase-sessie heeft maar nog geen profiel (zie register()
  // hieronder). Enkel zinvol als er nog bewaarde registratiegegevens klaarstaan
  // voor dit apparaat/browser.
  const tryCompletePendingRegistration = async (accessToken) => {
    const raw = localStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!raw) return null;
    try {
      const profileData = JSON.parse(raw);
      const response = await axios.post(
        `${API}/profile/complete-registration`,
        profileData,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      localStorage.removeItem(PENDING_REGISTRATION_KEY);
      setUser(response.data);
      return response.data;
    } catch (e) {
      console.error("Failed to complete pending registration", e);
      return null;
    }
  };

  const fetchProfile = async (accessToken) => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setUser(response.data);
      return response.data;
    } catch (e) {
      // Profiel bestaat nog niet — kan bv. gebeuren net na het bevestigen van
      // de e-mail bij registratie (zie register()). Probeer dan alsnog de
      // bewaarde registratiegegevens te gebruiken om het profiel aan te maken
      // voor we opgeven.
      if (e.response?.status === 401) {
        const completed = await tryCompletePendingRegistration(accessToken);
        if (completed) return completed;

        // Nog steeds geen profiel en niks om alsnog aan te maken: dit is een
        // "zombie"-sessie (bv. een oud testaccount van vóór deze fix, of een
        // registratie die nooit is afgerond). Zo'n sessie laten hangen zorgt
        // ervoor dat user null blijft maar token wél gezet is, wat elders in
        // de app (ProtectedRoute, /login-/register-redirects) tot een leeg
        // scherm kan leiden. Log expliciet uit zodat de gebruiker een schone,
        // duidelijke inlogpagina te zien krijgt in plaats van een lege pagina.
        console.error("Geen profiel voor deze sessie — sessie wordt beëindigd.", e);
        await supabase.auth.signOut();
        return null;
      }
      console.error("Failed to fetch profile", e);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        setToken(session.access_token);
        await fetchProfile(session.access_token);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session) {
        setToken(session.access_token);
        if (event !== 'TOKEN_REFRESHED') {
          await fetchProfile(session.access_token);
        }
      } else {
        setToken(null);
        setUser(null);
        if (event === 'SIGNED_OUT') {
          // onAuthStateChange vuurt ook SIGNED_OUT na een expliciete logout()
          // hieronder — sessionExpired hoort dan niet aangezet te worden, dat
          // doen we expliciet enkel bij een mislukte token-refresh (zie
          // supabaseClient.js: autoRefreshToken faalt stil, de sessie wordt
          // dan gewoon null via deze listener).
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw { response: { data: { detail: error.message } } };
    }
    setToken(data.session.access_token);
    const profile = await fetchProfile(data.session.access_token);
    if (!profile) {
      // fetchProfile probeert intern al eventuele bewaarde registratiegegevens
      // te gebruiken (zie tryCompletePendingRegistration) — als er dan nog
      // steeds geen profiel is, is er echt iets mis (bv. registratie op een
      // ander apparaat afgebroken vóór bevestiging).
      throw {
        response: {
          data: {
            detail: 'Geen profiel gevonden voor dit account. Bevestig uw e-mailadres of neem contact op via contact@kotklusser.be.'
          }
        }
      };
    }
    return profile;
  };

  // Two-step registratie (zie backend server.py, sectie AUTH ROUTES): eerst
  // supabase.auth.signUp() clientside (maakt de auth.users-rij aan), daarna
  // POST /api/profile/complete-registration met de verse sessietoken (maakt
  // de profiles-rij aan met rol/pand-koppeling/invite-validatie — dat vereist
  // servervalidatie tegen andere gebruikers/panden en kan niet clientside).
  const register = async (data) => {
    const { email, password, ...profileData } = data;
    // De ingevulde profielgegevens gaan mee als Supabase user_metadata (sleutel
    // "kotklusser_registration"). Dat komt terecht in élk geldig access token
    // voor dit account, ongeacht op welk (sub)domein de sessie tot stand komt
    // (bv. na de bevestigingslink op www.kotklusser.be terwijl geregistreerd
    // werd op kotklusser.be) — zie backend server.py get_current_user(), die
    // het profiel hieruit alsnog aanmaakt als "Confirm email" aanstaat en er
    // dus nog geen sessie was op het moment van signUp() hieronder.
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { kotklusser_registration: profileData } },
    });
    if (signUpError) {
      throw { response: { data: { detail: signUpError.message } } };
    }

    const accessToken = signUpData.session?.access_token;
    if (!accessToken) {
      // Gebeurt als "Confirm email" aanstaat in het Supabase-dashboard — er is
      // dan nog geen sessie tot de gebruiker de bevestigingsmail volgt. Bewaar
      // de gegevens ook lokaal als extra vangnet (zie fetchProfile hierboven)
      // voor het geval dit exacte apparaat/browser de sessie tot stand brengt
      // — de user_metadata hierboven is echter de eigenlijke fix en werkt ook
      // als dat op een ander (sub)domein of apparaat gebeurt.
      localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(profileData));
      return { pendingConfirmation: true };
    }

    setToken(accessToken);
    const response = await axios.post(
      `${API}/profile/complete-registration`,
      profileData,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    setUser(response.data);
    return { user: response.data, token: accessToken };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
  };

  const clearSessionExpired = () => setSessionExpired(false);

  const refreshUser = async () => {
    if (token) {
      return await fetchProfile(token);
    }
    return null;
  };

  const authAxios = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  authAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401 && !error.config._retry) {
        error.config._retry = true;
        // supabase-js ververst het access token zelf op de achtergrond
        // (autoRefreshToken: true); we vragen hier gewoon de actuele sessie op
        // i.p.v. zelf een refresh-call te doen.
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setToken(session.access_token);
          error.config.headers['Authorization'] = `Bearer ${session.access_token}`;
          return axios(error.config);
        }
        setSessionExpired(true);
      }
      return Promise.reject(error);
    }
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, sessionExpired, login, register, logout, refreshUser, clearSessionExpired, authAxios }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback = user.role === 'landlord' ? '/verhuurder' : user.role === 'contractor' ? '/aannemer' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
};

// Page transition wrapper
const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    {children}
  </motion.div>
);

function AppRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          user ? (
            <Navigate to={user.role === 'landlord' ? '/verhuurder' : '/dashboard'} replace />
          ) : (
            <PageWrapper><LandingPage /></PageWrapper>
          )
        } />
        <Route path="/login" element={
          user ? (
            <Navigate to={user.role === 'landlord' ? '/verhuurder' : '/dashboard'} replace />
          ) : (
            <PageWrapper><LoginPage /></PageWrapper>
          )
        } />
        <Route path="/register" element={
          user ? (
            <Navigate to={user.role === 'landlord' ? '/verhuurder' : '/dashboard'} replace />
          ) : (
            <PageWrapper><RegisterPage /></PageWrapper>
          )
        } />
        <Route path="/wachtwoord-vergeten" element={
          user ? (
            <Navigate to={user.role === 'landlord' ? '/verhuurder' : '/dashboard'} replace />
          ) : (
            <PageWrapper><ForgotPasswordPage /></PageWrapper>
          )
        } />
        <Route path="/wachtwoord-resetten" element={
          <PageWrapper><ResetPasswordPage /></PageWrapper>
        } />
        <Route path="/join/:code" element={
          <PageWrapper><JoinProperty /></PageWrapper>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <PageWrapper><StudentDashboard /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/verhuurder" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            {user && !user.has_property ? (
              <Navigate to="/onboarding/pand" replace />
            ) : (
              <PageWrapper><LandlordDashboard /></PageWrapper>
            )}
          </ProtectedRoute>
        } />
        <Route path="/onboarding/pand" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            <PageWrapper><PropertyOnboarding /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/pand/:id" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            <PageWrapper><PropertyDetail /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/nieuw-melding" element={
          <ProtectedRoute allowedRoles={['student']}>
            <PageWrapper><NewReport /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/ticket/:id" element={
          <ProtectedRoute>
            <PageWrapper><TicketDetail /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/profiel" element={
          <ProtectedRoute allowedRoles={['student']}>
            <PageWrapper><ProfilePage /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/email-wijziging/:token" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            <PageWrapper><EmailChangeApproval /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/verhuurder/profiel" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            <PageWrapper><LandlordProfilePage /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/bevestig-email/:token" element={
          <PageWrapper><ConfirmEmail /></PageWrapper>
        } />
        <Route path="/over-ons" element={<PageWrapper><OverOnsPage /></PageWrapper>} />
        <Route path="/privacybeleid" element={<PageWrapper><PrivacyPage /></PageWrapper>} />
        <Route path="/algemene-voorwaarden" element={<PageWrapper><TermsPage /></PageWrapper>} />
        <Route path="/contact" element={<PageWrapper><ContactPage /></PageWrapper>} />
        <Route path="/demo" element={<PageWrapper><DemoPage /></PageWrapper>} />
        <Route path="/prijzen" element={<PageWrapper><PricingPage /></PageWrapper>} />
        <Route path="/betaling/succes" element={<PageWrapper><PaymentSuccessPage /></PageWrapper>} />
        <Route path="/betaling/geannuleerd" element={<PageWrapper><PaymentCancelPage /></PageWrapper>} />
        <Route path="/aannemer" element={
          <ProtectedRoute allowedRoles={['contractor']}>
            <AannemerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/aannemer/klus/:ticket_id" element={
          <ProtectedRoute allowedRoles={['contractor']}>
            <AannemerKlusDetail />
          </ProtectedRoute>
        } />
        <Route path="*" element={<PageWrapper><NotFoundPage /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function SessionExpiredOverlay() {
  const { sessionExpired } = useAuth();
  if (!sessionExpired) return null;
  return <SessionExpiredScreen />;
}

function App() {
  return (
    <div className="noise-overlay">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <SessionExpiredOverlay />
          <CookieConsent />
          <Toaster
            position="bottom-right" 
            toastOptions={{
              style: {
                background: '#161425',
                color: '#F8FAFC',
                border: '1px solid rgba(255,255,255,0.08)'
              }
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
