import { useState } from "react";
import { apiUrl } from "../lib/apiBase";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Usuario o contraseña incorrectos");
        return;
      }

      if (data.token) {
        localStorage.setItem("token", data.token);
        console.log('[Login] Token saved to localStorage');
      }

      onLoginSuccess();
    } catch (err) {
      setError("Error de conexión. Por favor intenta de nuevo.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      {/* Animated Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
        <div className="bubble bubble-6"></div>
        <div className="bubble bubble-7"></div>
        <div className="bubble bubble-8"></div>
      </div>

      {/* Glassmorphism Login Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="glass-card rounded-3xl p-8 backdrop-blur-xl bg-gradient-to-br from-slate-800/95 via-slate-900/95 to-slate-800/95 border border-white/20 shadow-2xl">
          {/* Logos Animados */}
          <div className="mb-8 text-center">
            <div style={{
              position: 'relative',
              display: 'inline-block',
              height: '90px',
              width: '300px'
            }}>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes loginLogoFade {
                  0%, 45% { opacity: 1; transform: scale(1); }
                  50%, 95% { opacity: 0; transform: scale(0.95); }
                  100% { opacity: 1; transform: scale(1); }
                }
                .login-logo-azaleia {
                  animation: loginLogoFade 8s ease-in-out infinite;
                }
                .login-logo-olympikus {
                  animation: loginLogoFade 8s ease-in-out infinite;
                  animation-delay: 4s;
                }
              `}} />

              {/* Logo Azaleia */}
              <div className="login-logo-azaleia" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src="/logos/azaleia-logo.svg"
                  alt="Azaleia"
                  style={{
                    height: '70px',
                    width: 'auto',
                    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
                  }}
                />
              </div>

              {/* Logo Olympikus */}
              <div className="login-logo-olympikus" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0
              }}>
                <img
                  src="/logos/olympikus-logo.png"
                  alt="Olympikus"
                  style={{
                    height: '85px',
                    width: 'auto',
                    filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))'
                  }}
                />
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Input */}
            <div className="group">
              <label htmlFor="username" className="block text-sm font-semibold text-white/90 mb-2">
                Usuario
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full rounded-xl bg-white/20 border border-white/30 pl-12 pr-4 py-3 text-white placeholder-white/50 focus:bg-white/25 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all duration-300"
                  placeholder="Ingresa tu usuario"
                  required
                  autoFocus
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="group">
              <label htmlFor="password" className="block text-sm font-semibold text-white/90 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl bg-white/20 border border-white/30 pl-12 pr-4 py-3 text-white placeholder-white/50 focus:bg-white/25 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-orange-400/50 transition-all duration-300"
                  placeholder="Ingresa tu contraseña"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl bg-red-500/20 backdrop-blur-sm border border-red-500/30 p-3 text-sm text-red-200 animate-shake">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className="relative overflow-hidden rounded-xl bg-gradient-to-r from-orange-600 via-orange-700 to-orange-600 px-8 py-3.5 font-bold text-white shadow-md shadow-orange-900/20 transition-all duration-300 hover:shadow-lg hover:shadow-orange-800/30 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:ring-offset-2 focus:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    Iniciar Sesión
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-white/40">
            © 2025 Azaleia • Todos los derechos reservados
          </p>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-80px) translateX(60px) rotate(90deg) scale(1.2); }
          50% { transform: translateY(-40px) translateX(-60px) rotate(180deg) scale(0.8); }
          75% { transform: translateY(-100px) translateX(40px) rotate(270deg) scale(1.1); }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        .bubble {
          position: absolute;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(214, 84, 54, 0.7), rgba(249, 211, 73, 0.7));
          filter: blur(20px);
          animation: float 15s ease-in-out infinite;
          opacity: 0.8;
        }

        .bubble-1 {
          width: 300px;
          height: 300px;
          top: 10%;
          left: 10%;
          animation-delay: 0s;
          animation-duration: 12s;
        }

        .bubble-2 {
          width: 200px;
          height: 200px;
          top: 60%;
          right: 15%;
          animation-delay: 2s;
          animation-duration: 10s;
          background: linear-gradient(135deg, rgba(249, 211, 73, 0.7), rgba(214, 84, 54, 0.6));
        }

        .bubble-3 {
          width: 250px;
          height: 250px;
          bottom: 20%;
          left: 20%;
          animation-delay: 4s;
          animation-duration: 14s;
        }

        .bubble-4 {
          width: 180px;
          height: 180px;
          top: 30%;
          right: 25%;
          animation-delay: 6s;
          animation-duration: 9s;
          background: linear-gradient(135deg, rgba(255, 165, 0, 0.7), rgba(255, 215, 0, 0.7));
        }

        .bubble-5 {
          width: 220px;
          height: 220px;
          bottom: 10%;
          right: 10%;
          animation-delay: 8s;
          animation-duration: 13s;
        }

        .bubble-6 {
          width: 150px;
          height: 150px;
          top: 50%;
          left: 5%;
          animation-delay: 10s;
          animation-duration: 11s;
          background: linear-gradient(135deg, rgba(214, 84, 54, 0.7), rgba(249, 211, 73, 0.6));
        }

        .bubble-7 {
          width: 280px;
          height: 280px;
          top: 5%;
          right: 5%;
          animation-delay: 12s;
          animation-duration: 15s;
        }

        .bubble-8 {
          width: 190px;
          height: 190px;
          bottom: 30%;
          left: 40%;
          animation-delay: 14s;
          animation-duration: 10s;
          background: linear-gradient(135deg, rgba(249, 211, 73, 0.7), rgba(255, 140, 0, 0.7));
        }

        .glass-card {
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: white !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(255, 255, 255, 0.1) inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
}
