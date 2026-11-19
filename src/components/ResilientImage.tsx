import { useState, useEffect } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { resolveMediaUrl } from '../data/mediaAssets.ts';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackCategory?: string;
}

export function ResilientImage({ src, alt, className = '' }: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = resolveMediaUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  if (hasError || !resolvedSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#241E19] via-[#1B1714] to-[#141210] text-[#D4AF37]/70 p-4 ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="w-8 h-8 mb-2 opacity-70" strokeWidth={1.5} />
        <span className="text-xs text-[#B5ACA0] text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}
