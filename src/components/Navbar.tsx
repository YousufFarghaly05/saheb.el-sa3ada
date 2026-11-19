import { useState } from 'react';
import { Menu, X, MapPin, Phone, Megaphone } from 'lucide-react';
import type { BranchConfig, BranchId, Lang } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';
import { BRANCH_CONFIGS, BRANCH_ORDER } from '../data/initialData.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface NavbarProps {
  lang: Lang;
  activeBranch: BranchId;
  branchConfigs?: Record<BranchId, BranchConfig>;
  onSwitchBranch: (branchId: BranchId) => void;
  customerName?: string;
  announcementBanner?: {
    enabled: boolean;
    textAr: string;
    textEn: string;
  };
  onNavigateHome: (sectionId?: string) => void;
  onNavigateAdmin: () => void;
  onOpenAccount: () => void;
}

export function Navbar({
  lang,
  activeBranch,
  branchConfigs = BRANCH_CONFIGS,
  onSwitchBranch,
  customerName,
  announcementBanner,
  onNavigateHome,
  onNavigateAdmin,
  onOpenAccount,
}: NavbarProps) {
  const t = getTranslations(lang);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentBranch = branchConfigs[activeBranch];
  const bannerText = announcementBanner?.enabled
    ? (lang === 'ar' ? announcementBanner.textAr : announcementBanner.textEn || announcementBanner.textAr).trim()
    : '';

  const handleSectionClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    onNavigateHome(sectionId);
  };

  const accountLabel = customerName
    ? customerName.split(' ')[0]
    : t.nav.account;

  return (
    <header className="sticky top-0 z-40 border-b border-[#D4AF37]/20 bg-[#121212]/95 backdrop-blur-md">
      {/* Dynamic Restaurant Announcement Banner (CMS Controlled) */}
      {bannerText && (
        <div className="bg-gradient-to-l from-[#1C160C] via-[#261E10] to-[#1C160C] border-b border-[#D4AF37]/35">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-1.5 flex items-center justify-center gap-2 text-center">
            <Megaphone className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" aria-hidden="true" />
            <p className="text-[11px] sm:text-xs font-semibold text-[#F7F3E9] leading-snug">
              {bannerText}
            </p>
          </div>
        </div>
      )}

      {/* Luxury 3-Branch Switcher Strip */}
      <div className="bg-[#0B0A08] border-b border-[#D4AF37]/25">
        <div className="mx-auto max-w-[1200px] px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label={lang === 'ar' ? 'اختيار بوابة الفرع' : 'Select Branch Portal'}
            className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-center md:justify-start"
          >
            {BRANCH_ORDER.map((bId) => {
              const b = branchConfigs[bId];
              const isSelected = activeBranch === bId;
              return (
                <button
                  key={bId}
                  type="button"
                  onClick={() => onSwitchBranch(bId)}
                  aria-pressed={isSelected}
                  className={`px-2.5 sm:px-3.5 py-1 text-[11px] sm:text-xs font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-[0_0_16px_rgba(212,175,55,0.35)]'
                      : 'bg-[#1A1713] text-[#D9D0C1] border-[#D4AF37]/30 hover:border-[#D4AF37] hover:text-[#F7F3E9]'
                  }`}
                >
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{lang === 'ar' ? b.portalLabelAr : b.portalLabelEn}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-4 text-[11px] text-[#C9C1B1]">
            <span className="truncate max-w-[320px]">
              {lang === 'ar' ? currentBranch.addressAr : currentBranch.addressEn}
            </span>
            <a
              href={`tel:${currentBranch.phone}`}
              dir="ltr"
              className="inline-flex items-center gap-1 text-[#D4AF37] font-mono font-bold hover:underline shrink-0"
            >
              <Phone className="w-3 h-3" />
              <span>{currentBranch.phone}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main 3-Zone Navigation Row */}
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1200px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onNavigateHome('top');
          }}
          className="w-[163.766px] font-display-serif text-[18px] not-italic font-bold tracking-tight text-[#D4AF37] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#D4AF37] rounded-sm"
        >
          {t.brandName}
        </a>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav
          aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main Navigation'}
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#E4DDD3]"
        >
          <a
            href="#menu"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('menu');
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors duration-150"
          >
            {t.nav.menu}
          </a>
          <a
            href="#gallery"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('gallery');
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors duration-150"
          >
            {t.nav.gallery}
          </a>
          <a
            href="#shows"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('shows');
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors duration-150"
          >
            {t.nav.shows}
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAccount();
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors duration-150 cursor-pointer"
          >
            {accountLabel}
          </button>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              onNavigateAdmin();
            }}
            className="whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors duration-150"
          >
            {t.nav.admin}
          </a>
        </nav>

        {/* Zone 3: PWA Install + mobile menu trigger */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <PWAInstallButton lang={lang} />
          <button
            type="button"
            aria-label={lang === 'ar' ? 'فتح القائمة' : 'Toggle menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#D4AF37]/25 text-[#F5F0E6] hover:border-[#D4AF37] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#D4AF37]/15 bg-[#161616] px-4 py-4 space-y-2">
          <a
            href="#menu"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('menu');
            }}
            className="block rounded-md px-3 py-2.5 text-base font-medium text-[#F5F0E6] hover:bg-[#222222]"
          >
            {t.nav.menu}
          </a>
          <a
            href="#gallery"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('gallery');
            }}
            className="block rounded-md px-3 py-2.5 text-base font-medium text-[#F5F0E6] hover:bg-[#222222]"
          >
            {t.nav.gallery}
          </a>
          <a
            href="#shows"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('shows');
            }}
            className="block rounded-md px-3 py-2.5 text-base font-medium text-[#F5F0E6] hover:bg-[#222222]"
          >
            {t.nav.shows}
          </a>
          <a
            href="#location"
            onClick={(e) => {
              e.preventDefault();
              handleSectionClick('location');
            }}
            className="block rounded-md px-3 py-2.5 text-base font-medium text-[#F5F0E6] hover:bg-[#222222]"
          >
            {t.nav.location}
          </a>
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAccount();
            }}
            className="block w-full text-start rounded-md px-3 py-2.5 text-base font-medium text-[#F5F0E6] hover:bg-[#222222] cursor-pointer"
          >
            {accountLabel}
          </button>
          <a
            href="/admin"
            onClick={(e) => {
              e.preventDefault();
              setMobileMenuOpen(false);
              onNavigateAdmin();
            }}
            className="block rounded-md px-3 py-2.5 text-base font-medium text-[#D4AF37] hover:bg-[#222222]"
          >
            {t.nav.admin}
          </a>
        </div>
      )}
    </header>
  );
}
