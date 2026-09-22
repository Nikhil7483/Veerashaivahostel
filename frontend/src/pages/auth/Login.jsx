import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  KeyRound, 
  AlertCircle, 
  MapPin, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  ArrowRight, 
  ShieldCheck, 
  HelpCircle,
  X,
  Building2,
  Mail
} from 'lucide-react';
import basavannaImg from '../../assets/basavanna.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(username, password);
      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid login credentials. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between bg-[#030712] text-slate-100 overflow-x-hidden selection:bg-blue-600 selection:text-white">
      {/* ── Ambient Background Lighting & Effects ── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Radial Glow 1 - Amber Top Right */}
        <div 
          className="absolute -top-24 -right-24 w-[500px] h-[500px] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, rgba(245,158,11,0) 70%)' }} 
        />
        {/* Radial Glow 2 - Deep Blue Bottom Left */}
        <div 
          className="absolute -bottom-32 -left-24 w-[550px] h-[550px] rounded-full blur-3xl opacity-25"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, rgba(37,99,235,0) 70%)' }} 
        />
        {/* Radial Glow 3 - Center Indigo Accent */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[140px] opacity-15"
          style={{ background: 'radial-gradient(circle, #4f46e5 0%, rgba(79,70,229,0) 70%)' }} 
        />
        {/* Subtle grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />
      </div>

      {/* ── Top Header Bar ── */}
      <header className="relative z-10 w-full px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between border-b border-slate-800/60 backdrop-blur-xl bg-slate-950/40">
        <Link 
          to="/"
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 backdrop-blur-md transition-all duration-200 shadow-sm group active:scale-95"
          title="Return to Home"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>Home</span>
        </Link>

        {/* Institution Badge */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/40 bg-slate-900 p-0.5 shrink-0 shadow-sm shadow-amber-500/10">
            <img src={basavannaImg} alt="Emblem" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-200 tracking-tight leading-none">
              Veerashaiva Lingayath Boys Hostel
            </span>
            <span className="text-[10px] text-amber-400 font-medium flex items-center justify-end space-x-1 mt-0.5">
              <MapPin className="w-2.5 h-2.5 inline" />
              <span>Shivamogga</span>
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Centered Login Section ── */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-[420px] rounded-3xl backdrop-blur-2xl bg-slate-900/85 border border-slate-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300">
          
          {/* Glowing Top Gradient Edge */}
          <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-amber-400 to-indigo-600" />

          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Header / Brand Emblem */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400/15 via-blue-500/15 to-indigo-600/15 border border-amber-400/30 p-1.5 shadow-lg shadow-amber-500/5 mb-1 group">
                <img 
                  src={basavannaImg} 
                  alt="Hostel Emblem" 
                  className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300" 
                />
              </div>

              <h2 className="text-2xl sm:text-[26px] font-black text-white tracking-tight">
                Sign In to Your Account
              </h2>
              
              <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed font-normal max-w-xs mx-auto">
                Enter your email or Student ID to access the hostel portal.
              </p>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/30 rounded-xl flex items-start space-x-2.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Field 1: Email / Student ID / USN */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Email / Student ID / USN
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter Email / Student ID / USN"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-200 shadow-inner"
                  />
                </div>
              </div>

              {/* Field 2: Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-amber-400 hover:text-amber-300 hover:underline font-medium transition cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all duration-200 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer group mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 text-amber-300" />
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4 ml-0.5 opacity-80 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Security Badge */}
            <div className="pt-2 border-t border-slate-800/70 flex items-center justify-center space-x-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>256-bit Encrypted Official Hostel Portal</span>
            </div>

          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-4 px-4 text-center border-t border-slate-800/50 backdrop-blur-md bg-slate-950/30">
        <p className="text-xs text-slate-400 font-medium">
          © 2026 Veerashaiva Lingayath Boys Hostel, Shivamogga. All rights reserved.
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          Developed by Nikhilharsha <span className="text-rose-500">❤️</span>
        </p>
      </footer>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 p-6 shadow-2xl space-y-4">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <HelpCircle className="w-5 h-5" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Forgot Password?</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                For security reasons, credential resets are handled directly by the hostel office.
              </p>
            </div>

            <div className="space-y-2.5 text-xs bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-start space-x-2.5 text-slate-300">
                <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Hostel Administrative Office, Krushi Nagar, Shivamogga</span>
              </div>
              <div className="flex items-center space-x-2.5 text-slate-300">
                <Mail className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Contact Warden in person or via Office</span>
              </div>
            </div>

            <button
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
