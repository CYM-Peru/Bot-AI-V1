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
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-indigo-100 transition-opacity duration-600 ${
        isAnimatingOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`transform transition-all duration-600 ${
          isAnimatingOut ? "scale-110 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl px-12 py-10 shadow-2xl border border-blue-200/50">
          <div className="text-center space-y-4">
            {/* Welcome Icon */}
            <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg animate-bounce-slow">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Welcome Text */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent animate-fade-in">
                Bienvenido
              </h1>
              <p className="text-2xl font-semibold text-slate-800 animate-fade-in-delay">
                {userName}
              </p>
            </div>

            {/* Loading Dots */}
            <div className="flex items-center justify-center gap-2 pt-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "0ms" }}></div>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "200ms" }}></div>
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: "400ms" }}></div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s infinite ease-in-out;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-fade-in-delay {
          animation: fade-in 0.6s ease-out 0.2s backwards;
        }
      `}</style>
    </div>
  );
}
