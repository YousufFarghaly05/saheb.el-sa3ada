import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { Lang } from '../types.ts';

interface ScrollToTopButtonProps {
  lang: Lang;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ lang }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!isVisible) return null;

  const label = lang === 'ar' ? 'العودة إلى الأعلى' : 'Scroll to Top';

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={label}
      title={label}
      className="print:hidden fixed bottom-6 right-6 z-40 w-12 h-12 flex items-center justify-center bg-[#121212]/95 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border-2 border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
    >
      <ArrowUp className="w-5 h-5" aria-hidden="true" />
    </button>
  );
};
