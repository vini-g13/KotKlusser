import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import StudentDashboard from "./pages/StudentDashboard";
import LandlordDashboard from "./pages/LandlordDashboard";
import NewReport from "./pages/NewReport";
import TicketDetail from "./pages/TicketDetail";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
        } catch (e) {
          localStorage.removeItem("token");
          setToken(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    localStorage.setItem("token", response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const register = async (data) => {
    const response = await axios.post(`${API}/auth/register`, data);
    localStorage.setItem("token", response.data.token);
    setToken(response.data.token);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const authAxios = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authAxios }}>
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
    return <Navigate to={user.role === 'landlord' ? '/verhuurder' : '/dashboard'} replace />;
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
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['student']}>
            <PageWrapper><StudentDashboard /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/verhuurder" element={
          <ProtectedRoute allowedRoles={['landlord']}>
            <PageWrapper><LandlordDashboard /></PageWrapper>
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
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <div className="noise-overlay">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
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
