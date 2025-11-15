import { useState } from "react";

interface AvatarProps {
  src: string | null;
  alt: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

export function Avatar({ src, alt, size = "md", className = "" }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Si no hay imagen o hubo error, mostrar silueta genérica
  if (!src || imageError) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} flex items-center justify-center rounded-full bg-slate-200 text-slate-500`}
        title={alt}
      >
        <svg
          className="w-2/3 h-2/3"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      </div>
    );
  }

  // Mostrar imagen de perfil
  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClasses[size]} ${className} rounded-full object-cover bg-slate-100`}
      onError={() => setImageError(true)}
      loading="lazy"
    />
  );
}
