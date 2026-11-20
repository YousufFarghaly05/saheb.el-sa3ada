import React from 'react';
import {
  Star,
  Clock,
  Sparkles,
  UtensilsCrossed,
  CalendarCheck,
  Compass,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import type { BranchConfig, BranchId, Lang } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';
import { BRANCH_CONFIGS, BRANCH_ORDER } from '../data/initialData.ts';

interface HeroSectionProps {
  lang: Lang;
  activeBranch: BranchId;
  branchConfig: BranchConfig;
  branchConfigs?: Record<BranchId, BranchConfig>;
  onSwitchBranch: (branchId: BranchId) => void;
  onOpenReserve: () => void;
  onOpenOrder: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang,
  activeBranch,
  branchConfig,
  branchConfigs = BRANCH_CONFIGS,
  onSwitchBranch,
  onOpenReserve,
  onOpenOrder,
}) => {
  const t = getTranslations(lang).hero;

  const tagline = lang === 'ar' ? branchConfig.heroTaglineAr : branchConfig.heroTaglineEn;
  const headline = lang === 'ar' ? branchConfig.heroHeadlineAr : branchConfig.heroHeadlineEn;
  const subheadline =
    lang === 'ar' ? branchConfig.heroSubheadlineAr : branchConfig.heroSubheadlineEn;
  const hoursValue = lang === 'ar' ? branchConfig.hoursAr : branchConfig.hoursEn;
  const priceValue = lang === 'ar' ? branchConfig.priceRangeAr : branchConfig.priceRangeEn;

  return (
    <section
      id="top"
      className="relative min-h-[86vh] flex items-center overflow-hidden border-b border-[#D4AF37]/20"
    >
      {/* Background Image with Luxury Dark Oriental Gradient */}
      <div className="absolute inset-0 z-0">
        <img
          src={branchConfig.heroImageUrl}
          alt={lang === 'ar' ? branchConfig.nameAr : branchConfig.nameEn}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const img = e.currentTarget;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src =
                'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=80';
            }
          }}
          className="w-full h-full object-cover object-center scale-105 transition-all duration-700"
        />
        <div
          className={`absolute inset-0 ${
            lang === 'ar'
              ? 'bg-gradient-to-l from-[#121212] via-[#121212]/90 to-[#121212]/65'
              : 'bg-gradient-to-r from-[#121212] via-[#121212]/90 to-[#121212]/65'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-[#121212]/55" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-12 md:py-16 w-full space-y-8">
        {/* Quick Branch Selection Portal Cards */}
        <div className="bg-[#121212]/85 backdrop-blur-md border border-[#D4AF37]/35 p-3 sm:p-4 max-w-4xl">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] sm:text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              {lang === 'ar'
                ? 'بوابة اختيار الفرع السريعة — اختر الفرع لعرض قائمته وعروضه المستقلة'
                : 'Quick Branch Portal — Select a branch for its dedicated menu, offers & delivery'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {BRANCH_ORDER.map((bId) => {
              const b = branchConfigs[bId];
              const isSelected = activeBranch === bId;
              return (
                <button
                  key={`portal-${bId}`}
                  type="button"
                  onClick={() => onSwitchBranch(bId)}
                  className={`p-3.5 text-start border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.2)]'
                      : 'bg-[#1A1815]/90 border-[#D4AF37]/25 hover:border-[#D4AF37]/70'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-[#D4AF37]' : 'text-[#9E9585]'
                        }`}
                      />
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isSelected ? 'text-[#D4AF37]' : 'text-[#F7F3E9]'
                        }`}
                      >
                        {lang === 'ar' ? b.portalLabelAr : b.portalLabelEn}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#C9C1B1] line-clamp-1">
                      {lang === 'ar' ? b.addressAr : b.addressEn}
                    </p>
                    <p dir="ltr" className="text-[11px] font-mono text-[#D4AF37]/90">
                      ☎ {b.phone}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-w-3xl space-y-6">
          {/* Top Oriental Tagline */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-[#1E1E1E]/90 border border-[#D4AF37]/40 text-[#D4AF37] text-xs sm:text-sm font-medium tracking-wide">
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>{tagline}</span>
          </div>

          {/* Main Display Title */}
          <h1
            style={{ textWrap: 'balance' }}
            className="font-display-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-[#F7F3E9] leading-[1.2] tracking-tight"
          >
            {headline}
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#C9C1B1] leading-relaxed max-w-2xl">
            {subheadline}
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onOpenReserve}
              className="inline-flex items-center gap-3 px-7 py-4 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-base sm:text-lg transition-all shadow-[0_0_30px_rgba(212,175,55,0.35)] cursor-pointer"
            >
              <CalendarCheck className="w-5 h-5" />
              <span>{t.ctaReserve}</span>
            </button>

            <button
              type="button"
              onClick={onOpenOrder}
              className="inline-flex items-center gap-2.5 px-7 py-4 bg-[#1E1E1E]/95 hover:bg-[#D4AF37]/15 text-[#F7F3E9] border border-[#D4AF37] font-bold text-base sm:text-lg transition-all cursor-pointer"
            >
              <UtensilsCrossed className="w-5 h-5 text-[#D4AF37]" />
              <span>{t.ctaOrderOnline}</span>
            </button>
          </div>

          {/* Key Architectural Ledger Bar (4 Metrics) */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#D4AF37]/25 border border-[#D4AF37]/25">
            <div className="bg-[#121212]/95 p-4">
              <div className="flex items-center gap-1.5 text-[#D4AF37] font-bold text-sm sm:text-base tabular-nums">
                <Star className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37] shrink-0" />
                <span>{branchConfig.ratingValue}</span>
              </div>
              <p className="text-xs text-[#9E9585] mt-1">{t.stats.ratingLabel}</p>
            </div>

            <div className="bg-[#121212]/95 p-4">
              <div className="flex items-center gap-1.5 text-[#F7F3E9] font-bold text-sm sm:text-base">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{hoursValue}</span>
              </div>
              <p className="text-xs text-[#10B981] mt-1 font-medium">
                {lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn}
              </p>
            </div>

            <div className="bg-[#121212]/95 p-4">
              <div className="text-[#D4AF37] font-bold text-sm sm:text-base tabular-nums">
                {priceValue}
              </div>
              <p className="text-xs text-[#9E9585] mt-1">{t.stats.priceLabel}</p>
            </div>

            <div className="bg-[#121212]/95 p-4">
              <div className="flex items-center gap-1.5 text-[#F7F3E9] font-bold text-sm sm:text-base">
                <Compass className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{t.stats.servicesValue}</span>
              </div>
              <p className="text-xs text-[#9E9585] mt-1">{t.stats.servicesLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
