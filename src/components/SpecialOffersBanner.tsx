import React from 'react';
import { Sparkles, Tag, ArrowLeft, ArrowRight } from 'lucide-react';
import type { Lang } from '../types.ts';

interface SpecialOffersBannerProps {
  lang: Lang;
  enabled: boolean;
  badgeText?: string;
  title?: string;
  description?: string;
  onExplorePopular?: () => void;
}

export const SpecialOffersBanner: React.FC<SpecialOffersBannerProps> = ({
  lang,
  enabled,
  badgeText,
  title,
  description,
  onExplorePopular,
}) => {
  if (!enabled) return null;
  const cleanTitle = title?.trim() || '';
  const cleanDesc = description?.trim() || '';
  if (!cleanTitle && !cleanDesc) return null;

  const cleanBadge =
    badgeText?.trim() || (lang === 'ar' ? 'عروض موسمية خاصة' : 'Seasonal Special Offers');

  return (
    <div
      role="region"
      aria-label={cleanBadge}
      className="print:hidden relative mb-8 overflow-hidden border-2 border-[#D4AF37]/70 bg-gradient-to-l from-[#241D11] via-[#1B1710] to-[#14120E] p-5 sm:p-6 shadow-[0_10px_36px_rgba(212,175,55,0.16)]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-[#D4AF37]/10 blur-2xl"
      />
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1 text-[11px] sm:text-xs font-bold text-[#D4AF37]">
            <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{cleanBadge}</span>
          </div>

          {cleanTitle && (
            <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#F7F3E9] leading-snug">
              {cleanTitle}
            </h3>
          )}

          {cleanDesc && (
            <p className="text-xs sm:text-sm text-[#D6CEC0] leading-relaxed">
              {cleanDesc}
            </p>
          )}
        </div>

        {onExplorePopular && (
          <button
            type="button"
            onClick={onExplorePopular}
            className="inline-flex items-center justify-center gap-2 self-start md:self-center bg-[#D4AF37] hover:bg-[#E7C85A] px-5 py-3 text-xs sm:text-sm font-bold text-[#121212] shadow-[0_0_18px_rgba(212,175,55,0.3)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shrink-0"
          >
            <Tag className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{lang === 'ar' ? 'استكشف الأصناف المميزة' : 'Explore Featured Dishes'}</span>
            {lang === 'ar' ? (
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
