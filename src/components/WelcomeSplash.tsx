import { useEffect, useState } from "react";

interface WelcomeSplashProps {
  userName?: string;
  onComplete: () => void;
}

export default function WelcomeSplash({ userName = "Usuario", onComplete }: WelcomeSplashProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2 seconds
    const timer = setTimeout(() => {
      setIsAnimatingOut(true);
    }, 2000);

    // Complete and hide after animation finishes
    const completeTimer = setTimeout(() => {
      setIsVisible(false);
      onComplete();
    }, 2600);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden transition-opacity duration-600 ${
        isAnimatingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="bubble bubble-1"></div>
        <div className="bubble bubble-2"></div>
        <div className="bubble bubble-3"></div>
        <div className="bubble bubble-4"></div>
        <div className="bubble bubble-5"></div>
        <div className="bubble bubble-6"></div>
      </div>

      <div
        className={`relative z-10 transform transition-all duration-600 ${
          isAnimatingOut ? "scale-110 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="glass-card rounded-3xl px-12 py-10 shadow-2xl border border-white/20 backdrop-blur-xl bg-white/10">
          <div className="text-center space-y-6">
            {/* Welcome Icon with pulse */}
            <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-xl animate-pulse-glow">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Welcome Text */}
            <div className="space-y-3">
              <h2 className="text-4xl font-bold text-white animate-fade-in">
                ¡Bienvenido!
              </h2>
              <p className="text-2xl font-semibold text-white/90 animate-fade-in-delay">
                {userName}
              </p>
            </div>

            {/* Loading Dots */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 animate-pulse" style={{ animationDelay: "0ms" }}></div>
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 animate-pulse" style={{ animationDelay: "200ms" }}></div>
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-orange-500 to-yellow-500 animate-pulse" style={{ animationDelay: "400ms" }}></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-80px) translateX(60px) rotate(90deg) scale(1.2); }
          50% { transform: translateY(-40px) translateX(-60px) rotate(180deg) scale(0.8); }
          75% { transform: translateY(-100px) translateX(40px) rotate(270deg) scale(1.1); }
        }

        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 20px rgba(249, 211, 73, 0.5);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 40px rgba(249, 211, 73, 0.8);
          }
        }

        @keyframes glow {
          0%, 100% {
            filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
          }
          50% {
            filter: drop-shadow(0 4px 20px rgba(249, 211, 73, 0.8));
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s infinite ease-in-out;
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }

        .animate-fade-in-delay {
          animation: fade-in 0.8s ease-out 0.3s backwards;
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
          width: 220px;
          height: 220px;
          top: 60%;
          right: 15%;
          animation-delay: 2s;
          animation-duration: 10s;
          background: linear-gradient(135deg, rgba(249, 211, 73, 0.7), rgba(214, 84, 54, 0.6));
        }

        .bubble-3 {
          width: 260px;
          height: 260px;
          bottom: 15%;
          left: 15%;
          animation-delay: 4s;
          animation-duration: 14s;
        }

        .bubble-4 {
          width: 200px;
          height: 200px;
          top: 25%;
          right: 20%;
          animation-delay: 6s;
          animation-duration: 9s;
          background: linear-gradient(135deg, rgba(255, 165, 0, 0.7), rgba(255, 215, 0, 0.7));
        }

        .bubble-5 {
          width: 240px;
          height: 240px;
          bottom: 20%;
          right: 10%;
          animation-delay: 8s;
          animation-duration: 13s;
        }

        .bubble-6 {
          width: 180px;
          height: 180px;
          top: 45%;
          left: 8%;
          animation-delay: 10s;
          animation-duration: 11s;
          background: linear-gradient(135deg, rgba(214, 84, 54, 0.7), rgba(249, 211, 73, 0.6));
        }

        .glass-card {
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
}
