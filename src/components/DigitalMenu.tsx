import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Flame,
  Heart,
  Search,
  X,
  LayoutGrid,
  UtensilsCrossed,
  Soup,
  Coffee,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Sparkles,
  FileText,
  ExternalLink,
  Layers,
  QrCode,
} from 'lucide-react';
import type { BranchCmsSettings, BranchConfig, Lang, MenuCategory, MenuItem } from '../types.ts';
import {
  INITIAL_BRANCH_STORES,
  MENU_PDF_LINKS,
  getBranchMenuDriveUrl,
  getBranchMenuQrUrl,
} from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';
import { ResilientImage } from './ResilientImage.tsx';
import { SpecialOffersBanner } from './SpecialOffersBanner.tsx';

function isPopularDish(item: MenuItem): boolean {
  return Boolean(item.popular || item.tags?.includes('popular') || item.featured);
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '')
    .trim();
}

export type FilterTabId = 'all' | MenuCategory | 'favorites';
export type SortOption = 'default' | 'popularity' | 'price_asc' | 'price_desc';

interface CategoryFilterTab {
  id: FilterTabId;
  label: string;
  count: number;
  icon: React.ReactNode;
}

interface MenuCategoryFilterProps {
  tabs: CategoryFilterTab[];
  selectedTab: FilterTabId;
  onSelectTab: (tabId: FilterTabId) => void;
  lang: Lang;
}

export const MenuCategoryFilter: React.FC<MenuCategoryFilterProps> = ({
  tabs,
  selectedTab,
  onSelectTab,
  lang,
}) => {
  return (
    <div
      role="tablist"
      aria-label={lang === 'ar' ? 'تصنيفات قائمة الطعام' : 'Menu categories'}
      className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none min-w-0 flex-1"
    >
      {tabs.map((tab) => {
        const isActive = selectedTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectTab(tab.id)}
            className={`group px-4 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer border flex items-center gap-2 shrink-0 ${
              isActive
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.28)]'
                : 'bg-[#1E1E1E] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]/60 hover:text-[#F7F3E9]'
            }`}
          >
            <span
              className={`transition-colors ${
                isActive ? 'text-[#121212]' : 'text-[#D4AF37] group-hover:text-[#D4AF37]'
              }`}
            >
              {tab.icon}
            </span>
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.5 text-[11px] font-mono tabular-nums transition-colors ${
                isActive
                  ? 'bg-[#121212]/20 text-[#121212] font-extrabold'
                  : 'bg-[#121212] text-[#D4AF37] border border-[#D4AF37]/25'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

interface DigitalMenuProps {
  lang: Lang;
  branchConfig: BranchConfig;
  cmsSettings?: Partial<BranchCmsSettings>;
  menu: MenuItem[];
  favoriteIds: string[];
  onToggleFavorite: (menuItemId: string) => void;
  onAddToCart: (item: MenuItem) => void;
  cartCount: number;
  cartTotal: number;
  onOpenOrderModal: () => void;
}

export const DigitalMenu: React.FC<DigitalMenuProps> = ({
  lang,
  branchConfig,
  cmsSettings,
  menu,
  favoriteIds,
  onToggleFavorite,
  onAddToCart,
  cartCount,
  cartTotal,
  onOpenOrderModal,
}) => {
  const t = getTranslations(lang).menu;
  const [selectedCat, setSelectedCat] = useState<FilterTabId>('all');
  const [selectedSubSection, setSelectedSubSection] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [addedId, setAddedId] = useState<string | null>(null);
  const [showMenuQr, setShowMenuQr] = useState(false);
  const featuredScrollRef = useRef<HTMLDivElement | null>(null);
  const featuredSectionRef = useRef<HTMLDivElement | null>(null);
  const [featuredVisible, setFeaturedVisible] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }
    return false;
  });

  const popularDishes = useMemo(
    () => menu.filter((item) => isPopularDish(item) && item.available),
    [menu]
  );

  useEffect(() => {
    if (featuredVisible) return;
    const node = featuredSectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setFeaturedVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setFeaturedVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [featuredVisible, popularDishes.length]);

  const scrollFeatured = (direction: 'prev' | 'next') => {
    const el = featuredScrollRef.current;
    if (!el) return;
    const step = 320;
    const sign = lang === 'ar' ? (direction === 'next' ? -1 : 1) : direction === 'next' ? 1 : -1;
    el.scrollBy({ left: sign * step, behavior: 'smooth' });
  };

  useEffect(() => {
    setSelectedSubSection('all');
  }, [branchConfig.id, selectedCat]);

  // Compute dynamic category counts directly from the `menu` prop
  const categoryTabs: CategoryFilterTab[] = useMemo(() => {
    const counts: Record<MenuCategory, number> = {
      mains: 0,
      appetizers: 0,
      drinks_desserts: 0,
      shisha: 0,
    };

    for (const item of menu) {
      if (counts[item.category] !== undefined) {
        counts[item.category] += 1;
      }
    }

    const favCount = menu.filter((item) => favoriteIds.includes(item.id)).length;

    const baseTabs: CategoryFilterTab[] = [
      {
        id: 'all',
        label: t.all,
        count: menu.length,
        icon: <LayoutGrid className="w-4 h-4" />,
      },
      {
        id: 'mains',
        label: t.categories.mains,
        count: counts.mains,
        icon: <UtensilsCrossed className="w-4 h-4" />,
      },
      {
        id: 'appetizers',
        label: t.categories.appetizers,
        count: counts.appetizers,
        icon: <Soup className="w-4 h-4" />,
      },
      {
        id: 'drinks_desserts',
        label: t.categories.drinks_desserts,
        count: counts.drinks_desserts,
        icon: <Coffee className="w-4 h-4" />,
      },
    ];

    if (counts.shisha > 0) {
      baseTabs.push({
        id: 'shisha',
        label: t.categories.shisha,
        count: counts.shisha,
        icon: <Sparkles className="w-4 h-4" />,
      });
    }

    baseTabs.push({
      id: 'favorites',
      label: t.favoritesFilter,
      count: favCount,
      icon: (
        <Heart
          className={`w-4 h-4 ${
            selectedCat === 'favorites' ? 'fill-[#121212]' : 'fill-[#D4AF37]'
          }`}
        />
      ),
    });

    return baseTabs;
  }, [menu, favoriteIds, t, selectedCat]);

  const subSectionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of menu) {
      const catMatches =
        selectedCat === 'all'
          ? true
          : selectedCat === 'favorites'
          ? favoriteIds.includes(item.id)
          : item.category === selectedCat;
      if (!catMatches) continue;
      if (item.prepNoteAr) {
        const displayLabel = lang === 'ar' ? item.prepNoteAr : item.prepNoteEn || item.prepNoteAr;
        if (!map.has(item.prepNoteAr)) {
          map.set(item.prepNoteAr, displayLabel);
        }
      }
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [menu, selectedCat, favoriteIds, lang]);

  const normalizedQuery = normalizeSearchText(searchQuery);

  const filteredMenu = useMemo(() => {
    const filtered = menu.filter((item) => {
      const matchesCat =
        selectedCat === 'all'
          ? true
          : selectedCat === 'favorites'
          ? favoriteIds.includes(item.id)
          : item.category === selectedCat;
      if (!matchesCat) return false;
      if (selectedSubSection !== 'all' && item.prepNoteAr !== selectedSubSection) {
        return false;
      }
      if (!normalizedQuery) return true;

      const normAr = normalizeSearchText(item.titleAr);
      const normEn = normalizeSearchText(item.titleEn || '');
      const normSub = normalizeSearchText(`${item.prepNoteAr || ''} ${item.prepNoteEn || ''}`);
      return (
        normAr.includes(normalizedQuery) ||
        normEn.includes(normalizedQuery) ||
        normSub.includes(normalizedQuery)
      );
    });

    if (sortBy === 'price_asc') {
      return [...filtered].sort((a, b) => a.price - b.price);
    }

    if (sortBy === 'price_desc') {
      return [...filtered].sort((a, b) => b.price - a.price);
    }

    if (sortBy === 'popularity') {
      return [...filtered].sort((a, b) => {
        const aScore = (isPopularDish(a) ? 2 : 0) + (favoriteIds.includes(a.id) ? 1 : 0);
        const bScore = (isPopularDish(b) ? 2 : 0) + (favoriteIds.includes(b.id) ? 1 : 0);
        return bScore - aScore;
      });
    }

    return filtered;
  }, [menu, selectedCat, selectedSubSection, favoriteIds, normalizedQuery, sortBy]);

  const handleAdd = (item: MenuItem) => {
    onAddToCart(item);
    setAddedId(item.id);
    setTimeout(() => {
      setAddedId((prev) => (prev === item.id ? null : prev));
    }, 900);
  };

  const activeCategoryLabel =
    categoryTabs.find((tab) => tab.id === selectedCat)?.label || t.all;

  return (
    <section
      id="menu"
      className="py-16 sm:py-20 bg-[#121212] border-b border-[#D4AF37]/20 print:bg-white print:text-[#121212] print:border-none print:py-0"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 print:hidden">
        {(() => {
          const fallbackCms = INITIAL_BRANCH_STORES[branchConfig.id].cmsSettings;
          const offerEnabled =
            cmsSettings?.specialOfferEnabled !== undefined
              ? Boolean(cmsSettings.specialOfferEnabled)
              : Boolean(fallbackCms?.specialOfferEnabled);
          const badge =
            lang === 'ar'
              ? cmsSettings?.specialOfferBadgeAr ?? fallbackCms?.specialOfferBadgeAr
              : cmsSettings?.specialOfferBadgeEn ||
                cmsSettings?.specialOfferBadgeAr ||
                fallbackCms?.specialOfferBadgeEn;
          const title =
            lang === 'ar'
              ? cmsSettings?.specialOfferTitleAr ?? fallbackCms?.specialOfferTitleAr
              : cmsSettings?.specialOfferTitleEn ||
                cmsSettings?.specialOfferTitleAr ||
                fallbackCms?.specialOfferTitleEn;
          const description =
            lang === 'ar'
              ? cmsSettings?.specialOfferDescAr ?? fallbackCms?.specialOfferDescAr
              : cmsSettings?.specialOfferDescEn ||
                cmsSettings?.specialOfferDescAr ||
                fallbackCms?.specialOfferDescEn;

          return (
            <SpecialOffersBanner
              lang={lang}
              enabled={offerEnabled}
              badgeText={badge}
              title={title}
              description={description}
              onExplorePopular={() => {
                setSelectedCat('all');
                setSelectedSubSection('all');
                setSortBy('popularity');
                document.getElementById('menu-sort-select')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            />
          );
        })()}

        {/* Prominent Top External Menu Links Bar */}
        <div className="mb-8 p-4 sm:p-5 bg-[#1E1E1E] border border-[#D4AF37]/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-[0_8px_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-bold text-[#F7F3E9]">
                {lang === 'ar'
                  ? 'قائمة الطعام الكاملة للفروع (PDF)'
                  : 'Complete Branch Menus (PDF)'}
              </p>
              <p className="text-xs text-[#C9C1B1]">
                {lang === 'ar'
                  ? 'افتح المنيو الكامل لأي فرع مباشرة في نافذة جديدة'
                  : 'Open the full menu for any branch directly in a new tab'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href={MENU_PDF_LINKS.moez}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn group inline-flex items-center justify-center gap-2.5 px-5 py-3 border text-xs sm:text-sm font-bold transition-all ${
                branchConfig.id === 'branch_moez'
                  ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.32)] hover:bg-[#e3be42]'
                  : 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]/70 hover:bg-[#D4AF37] hover:text-[#121212]'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تصفح المنيو الكامل لفرع المعز (PDF)'
                  : 'Browse Full El-Moez Menu (PDF)'}
              </span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-85 transition-transform group-hover:-translate-y-0.5" />
            </a>

            <a
              href={MENU_PDF_LINKS.tagamoaZayed}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn group inline-flex items-center justify-center gap-2.5 px-5 py-3 border text-xs sm:text-sm font-bold transition-all ${
                branchConfig.id === 'branch_tagamoa' || branchConfig.id === 'branch_zayed'
                  ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] shadow-[0_0_24px_rgba(212,175,55,0.32)] hover:bg-[#e3be42]'
                  : 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]/70 hover:bg-[#D4AF37] hover:text-[#121212]'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>
                {lang === 'ar'
                  ? 'تصفح المنيو الكامل لفرعي التجمع والشيخ زايد (PDF)'
                  : 'Browse Full Tagamoa & Sheikh Zayed Menu (PDF)'}
              </span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-85 transition-transform group-hover:-translate-y-0.5" />
            </a>

            <button
              type="button"
              onClick={() => setShowMenuQr((prev) => !prev)}
              aria-expanded={showMenuQr}
              className={`inline-flex items-center justify-center gap-2 px-4 py-3 border text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                showMenuQr
                  ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                  : 'bg-[#121212] text-[#D4AF37] border-[#D4AF37]/60 hover:bg-[#D4AF37]/15'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>{lang === 'ar' ? 'باركود المنيو (QR)' : 'Menu QR Code'}</span>
            </button>
          </div>
        </div>

        {showMenuQr && (
          <div className="-mt-5 mb-8 p-5 bg-[#181510] border border-t-0 border-[#D4AF37]/40 flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="space-y-2 text-center sm:text-start">
              <p className="text-sm sm:text-base font-bold text-[#D4AF37]">
                {lang === 'ar'
                  ? `امسح كود QR لفتح منيو ${branchConfig.shortNameAr} مباشرة (Google Drive PDF)`
                  : `Scan QR to open ${branchConfig.shortNameEn} Menu directly (Google Drive PDF)`}
              </p>
              <p className="text-xs text-[#C9C1B1] max-w-xl leading-relaxed">
                {lang === 'ar'
                  ? 'يفتح هذا الرمز ملف المنيو الرسمي مباشرة عبر Google Drive على هاتفك بدون أي أخطاء معاينة.'
                  : 'This QR code opens the official Google Drive PDF menu directly on your mobile device.'}
              </p>
              <a
                href={getBranchMenuDriveUrl(branchConfig.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#121212] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border border-[#D4AF37]/60 text-xs font-bold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'فتح رابط المنيو المباشر' : 'Open Direct Drive Link'}</span>
              </a>
            </div>

            <a
              href={getBranchMenuDriveUrl(branchConfig.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-2.5 border-2 border-[#D4AF37] shrink-0 block"
              aria-label={lang === 'ar' ? 'رمز QR للمنيو المباشر' : 'Direct Menu QR Code'}
            >
              <img
                src={getBranchMenuQrUrl(branchConfig.id)}
                alt={`${branchConfig.shortNameEn} Menu QR`}
                width={140}
                height={140}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-[140px] h-[140px] object-contain block"
              />
            </a>
          </div>
        )}

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <span className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider block mb-1">
              {lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn}
            </span>
            <h2 className="font-display-serif text-3xl sm:text-4xl font-bold text-[#F7F3E9]">
              {t.sectionTitle}
            </h2>
            <p className="text-[#C9C1B1] mt-2 text-sm sm:text-base max-w-2xl">
              {t.sectionSubtitle}
            </p>
          </div>

          {/* Real-Time Search Input Bar (Arabic & English Name Filter) */}
          <div className="w-full md:w-80 space-y-1.5">
            <div className="relative">
              <Search
                className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                  lang === 'ar' ? 'right-3.5' : 'left-3.5'
                }`}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className={`w-full py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#F7F3E9] placeholder-[#9E9585] text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50 transition-all ${
                  lang === 'ar' ? 'pr-10 pl-9' : 'pl-10 pr-9'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={lang === 'ar' ? 'مسح البحث' : 'Clear search'}
                  className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#9E9585] hover:text-[#D4AF37] transition-colors cursor-pointer ${
                    lang === 'ar' ? 'left-2.5' : 'right-2.5'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {normalizedQuery && (
              <div className="flex items-center justify-between text-xs text-[#D4AF37] px-1">
                <span>
                  {lang === 'ar'
                    ? `نتائج البحث بالاسم: ${filteredMenu.length} صنف`
                    : `Matching dishes: ${filteredMenu.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="underline hover:text-[#F7F3E9] cursor-pointer"
                >
                  {lang === 'ar' ? 'عرض الكل' : 'Show all'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Featured / Popular Dishes Showcase Section ('الأطباق المميزة') */}
        {popularDishes.length > 0 && (
          <div
            ref={featuredSectionRef}
            aria-label={lang === 'ar' ? 'الأطباق المميزة' : 'Featured Dishes'}
            className={`mb-10 bg-gradient-to-b from-[#1E1A10] via-[#181611] to-[#151310] border border-[#D4AF37]/45 p-5 sm:p-6 shadow-[0_14px_40px_rgba(0,0,0,0.55)] transition-all duration-700 ease-out will-change-[opacity,transform] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
              featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-5 border-b border-[#D4AF37]/25">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-11 h-11 bg-gradient-to-br from-[#D4AF37] via-[#F2D574] to-[#B8860B] text-[#121212] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.35)]">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#F7F3E9]">
                      {lang === 'ar' ? 'الأطباق المميزة' : 'Featured Dishes'}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#D4AF37]/15 border border-[#D4AF37]/60 text-[#D4AF37] text-[11px] font-bold">
                      <Sparkles className="w-3 h-3" />
                      <span>
                        {lang === 'ar'
                          ? `${popularDishes.length} صنف مختار`
                          : `${popularDishes.length} Popular Picks`}
                      </span>
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1">
                    {lang === 'ar'
                      ? `أشهر الأطباق والمشروبات وأكثرها طلباً من ضيوف ${branchConfig.shortNameAr}`
                      : `Guest favorites and most-ordered signature picks at ${branchConfig.shortNameEn}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => scrollFeatured('prev')}
                  aria-label={lang === 'ar' ? 'السابق' : 'Previous'}
                  className="w-9 h-9 bg-[#121212] border border-[#D4AF37]/45 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] flex items-center justify-center transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => scrollFeatured('next')}
                  aria-label={lang === 'ar' ? 'التالي' : 'Next'}
                  className="w-9 h-9 bg-[#121212] border border-[#D4AF37]/45 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] flex items-center justify-center transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div
              ref={featuredScrollRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
            >
              {popularDishes.map((item, index) => {
                const title = lang === 'ar' ? item.titleAr : item.titleEn || item.titleAr;
                const desc =
                  lang === 'ar' ? item.descriptionAr : item.descriptionEn || item.descriptionAr;
                const isAdded = addedId === item.id;
                const isFavorite = favoriteIds.includes(item.id);
                const categoryBadgeLabel = t.categories[item.category];
                const staggerDelayMs = Math.min(index, 5) * 90;

                return (
                  <article
                    key={`featured-${item.id}`}
                    style={{ transitionDelay: featuredVisible ? `${staggerDelayMs}ms` : '0ms' }}
                    className={`w-[265px] sm:w-[285px] shrink-0 snap-start group bg-[#121212] border border-[#D4AF37]/40 hover:border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all duration-500 ease-out flex flex-col justify-between overflow-hidden motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
                      featuredVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  >
                    <div>
                      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#0E0D0B]">
                        <ResilientImage
                          src={item.imageUrl}
                          alt={title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-black/35" />

                        {/* Elegant Gold Popular Badge */}
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#D4AF37] via-[#F2D574] to-[#D4AF37] text-[#121212] border border-[#FFF5CC]/60 text-[11px] font-extrabold shadow-[0_4px_14px_rgba(212,175,55,0.45)]">
                          <Crown className="w-3.5 h-3.5 shrink-0" />
                          <span>{lang === 'ar' ? 'طبق مميز' : 'Popular'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item.id)}
                          aria-label={t.favoriteAria}
                          title={t.favoriteAria}
                          className={`absolute top-3 left-3 w-8 h-8 flex items-center justify-center border transition-all cursor-pointer ${
                            isFavorite
                              ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                              : 'bg-[#121212]/80 text-[#F7F3E9] border-[#D4AF37]/40 hover:border-[#D4AF37]'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#121212]' : ''}`} />
                        </button>

                        <div className="absolute bottom-2.5 left-3 bg-[#121212]/95 border border-[#D4AF37]/70 px-2.5 py-1 text-[#D4AF37] font-bold text-sm tabular-nums">
                          {item.price} <span className="text-[11px] font-normal">{t.currency}</span>
                        </div>

                        <span className="absolute bottom-2.5 right-3 bg-[#121212]/85 border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] text-[#C9C1B1]">
                          {categoryBadgeLabel}
                        </span>
                      </div>

                      <div className="p-4">
                        <h4 className="font-bold text-base text-[#F7F3E9] group-hover:text-[#D4AF37] transition-colors line-clamp-1">
                          {title}
                        </h4>
                        <p className="text-xs text-[#C9C1B1] mt-1.5 line-clamp-2 leading-relaxed">
                          {desc}
                        </p>
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-1">
                      <button
                        type="button"
                        onClick={() => handleAdd(item)}
                        className={`w-full py-2 px-3 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                          isAdded
                            ? 'bg-[#10B981] text-[#121212] border-[#10B981]'
                            : 'bg-[#1E1E1E] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border-[#D4AF37]/45 hover:border-[#D4AF37]'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>{lang === 'ar' ? 'تمت الإضافة ✓' : 'Added ✓'}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t.addToOrder}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Filter & Sort Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 mb-8 border-b border-[#D4AF37]/20">
          <MenuCategoryFilter
            tabs={categoryTabs}
            selectedTab={selectedCat}
            onSelectTab={setSelectedCat}
            lang={lang}
          />

          {/* Sub-Section Filter & Sorting Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {subSectionOptions.length > 1 && (
              <div className="relative min-w-[175px]">
                <Layers
                  className={`w-3.5 h-3.5 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                    lang === 'ar' ? 'right-3' : 'left-3'
                  }`}
                />
                <select
                  value={selectedSubSection}
                  onChange={(e) => setSelectedSubSection(e.target.value)}
                  aria-label={lang === 'ar' ? 'تصفية حسب القسم الفرعي' : 'Filter by sub-section'}
                  className={`w-full appearance-none py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/40 hover:border-[#D4AF37] focus:border-[#D4AF37] focus:outline-none text-[#F7F3E9] text-xs font-bold cursor-pointer transition-colors ${
                    lang === 'ar' ? 'pr-8 pl-8' : 'pl-8 pr-8'
                  }`}
                >
                  <option value="all" className="bg-[#1E1E1E] text-[#F7F3E9]">
                    {lang === 'ar' ? 'كل الأقسام الفرعية' : 'All Sub-sections'}
                  </option>
                  {subSectionOptions.map((sub) => (
                    <option
                      key={sub.value}
                      value={sub.value}
                      className="bg-[#1E1E1E] text-[#F7F3E9]"
                    >
                      {sub.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                    lang === 'ar' ? 'left-2.5' : 'right-2.5'
                  }`}
                />
              </div>
            )}

            <label
              htmlFor="menu-sort-select"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9E9585] whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{t.sortLabel}:</span>
            </label>

            <div className="relative min-w-[185px]">
              <select
                id="menu-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label={t.sortLabel}
                className={`w-full appearance-none py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/40 hover:border-[#D4AF37] focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/50 text-[#F7F3E9] text-xs sm:text-sm font-bold cursor-pointer transition-colors ${
                  lang === 'ar' ? 'pr-3.5 pl-9' : 'pl-3.5 pr-9'
                }`}
              >
                <option value="default" className="bg-[#1E1E1E] text-[#F7F3E9]">
                  {t.sortDefault}
                </option>
                <option value="popularity" className="bg-[#1E1E1E] text-[#F7F3E9]">
                  {t.sortPopularity}
                </option>
                <option value="price_asc" className="bg-[#1E1E1E] text-[#F7F3E9]">
                  {t.sortPriceAsc}
                </option>
                <option value="price_desc" className="bg-[#1E1E1E] text-[#F7F3E9]">
                  {t.sortPriceDesc}
                </option>
              </select>
              <ChevronDown
                className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                  lang === 'ar' ? 'left-3' : 'right-3'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        {filteredMenu.length === 0 ? (
          <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-12 text-center space-y-3 animate-menu-fade-in">
            <Search className="w-10 h-10 text-[#D4AF37]/50 mx-auto" />
            <p className="text-[#F7F3E9] font-bold text-base">{t.emptySearch}</p>
            {(searchQuery || selectedCat !== 'all' || selectedSubSection !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCat('all');
                  setSelectedSubSection('all');
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] text-[#121212] font-bold text-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إلغاء الفلترة وعرض كل القائمة' : 'Reset Filters'}</span>
              </button>
            )}
          </div>
        ) : (
          <div
            key={`${selectedCat}-${selectedSubSection}-${normalizedQuery}-${sortBy}`}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6"
          >
            {filteredMenu.map((item, idx) => {
              const title = lang === 'ar' ? item.titleAr : item.titleEn || item.titleAr;
              const desc =
                lang === 'ar' ? item.descriptionAr : item.descriptionEn || item.descriptionAr;
              const prepNote = lang === 'ar' ? item.prepNoteAr : item.prepNoteEn;
              const isAdded = addedId === item.id;
              const isFavorite = favoriteIds.includes(item.id);
              const categoryBadgeLabel = t.categories[item.category];

              return (
                <article
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
                  className="animate-menu-fade-in group bg-[#1E1E1E] border border-[#D4AF37]/25 hover:border-[#D4AF37] transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div>
                    {/* Dish Photo */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#121212]">
                      <ResilientImage
                        src={item.imageUrl}
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] via-transparent to-black/30" />

                      {/* Favorite Toggle Button */}
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(item.id)}
                        aria-label={t.favoriteAria}
                        title={t.favoriteAria}
                        className={`absolute top-3 left-3 w-9 h-9 flex items-center justify-center border transition-all cursor-pointer ${
                          isFavorite
                            ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                            : 'bg-[#121212]/80 text-[#F7F3E9] border-[#D4AF37]/40 hover:border-[#D4AF37]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#121212]' : ''}`} />
                      </button>

                      {isPopularDish(item) && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-[#D4AF37] via-[#F2D574] to-[#D4AF37] border border-[#FFF5CC]/60 text-[#121212] text-xs font-extrabold shadow-[0_4px_14px_rgba(212,175,55,0.4)]">
                          <Flame className="w-3.5 h-3.5 fill-[#121212]" />
                          {lang === 'ar' ? 'طبق مميز · الأكثر طلباً' : 'Popular'}
                        </span>
                      )}

                      {/* Price Tag */}
                      <div className="absolute bottom-3 left-3 bg-[#121212]/95 border border-[#D4AF37]/60 px-3 py-1 text-[#D4AF37] font-bold text-base tabular-nums">
                        {item.price} <span className="text-xs font-normal">{t.currency}</span>
                      </div>

                      {/* Category Tag */}
                      <span className="absolute bottom-3 right-3 bg-[#121212]/85 border border-[#D4AF37]/30 px-2 py-0.5 text-[11px] text-[#C9C1B1]">
                        {categoryBadgeLabel}
                      </span>
                    </div>

                    {/* Dish Info */}
                    <div className="p-5">
                      <h3 className="font-bold text-lg text-[#F7F3E9] group-hover:text-[#D4AF37] transition-colors">
                        {title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#C9C1B1] mt-2 line-clamp-2 leading-relaxed">
                        {desc}
                      </p>
                      {prepNote && (
                        <p className="text-[11px] text-[#D4AF37]/80 mt-2 font-medium">{prepNote}</p>
                      )}
                    </div>
                  </div>

                  {/* Action Footer */}
                  <div className="px-5 pb-5 pt-2">
                    <button
                      type="button"
                      disabled={!item.available}
                      onClick={() => handleAdd(item)}
                      className={`w-full py-2.5 px-4 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                        !item.available
                          ? 'bg-[#121212] text-[#9E9585] border-[#9E9585]/30 cursor-not-allowed'
                          : isAdded
                          ? 'bg-[#10B981] text-[#121212] border-[#10B981]'
                          : 'bg-[#121212] hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border-[#D4AF37]/40 hover:border-[#D4AF37]'
                      }`}
                    >
                      {!item.available ? (
                        <span>{t.unavailable}</span>
                      ) : isAdded ? (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'تمت الإضافة للسلة ✓' : 'Added to Cart ✓'}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>{t.addToOrder}</span>
                        </>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Official Service Charge & VAT Notice */}
        <div className="mt-6 px-4 py-3 bg-[#1A1814] border border-[#D4AF37]/25 text-xs text-[#C9C1B1] flex flex-wrap items-center justify-between gap-2">
          <span>
            {lang === 'ar'
              ? '• جميع الأسعار المذكورة يضاف إليها ١٢٪ خدمة و ١٤٪ ضريبة القيمة المضافة.'
              : '• All listed prices are subject to 12% service charge and 14% VAT.'}
            {branchConfig.id === 'branch_moez' &&
              (lang === 'ar'
                ? ' في حالة حضور العروض الفنية صباحاً أو مساءً يتم إضافة رسوم الحفلة لكل فرد.'
                : ' Show fees apply per guest during morning or evening live performances.')}
          </span>
          <span className="text-[#D4AF37] font-mono font-bold">
            {filteredMenu.length} {t.itemsCount}
          </span>
        </div>

        {/* Floating / Sticky Cart Bar when items are in Cart */}
        {cartCount > 0 && (
          <div className="mt-8 bg-[#1E1E1E] border-2 border-[#D4AF37] p-4 flex flex-wrap items-center justify-between gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#D4AF37] text-[#121212] flex items-center justify-center font-bold">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base text-[#F7F3E9]">
                  {t.cartBanner} ({cartCount} {t.itemsCount})
                </h4>
                <p className="text-xs sm:text-sm text-[#D4AF37] font-bold tabular-nums">
                  {cartTotal} {t.currency}{' '}
                  <span className="text-[11px] font-normal text-[#C9C1B1]">
                    ({lang === 'ar' ? '+ ١٢٪ خدمة و ١٤٪ ضريبة' : '+ 12% service & 14% VAT'})
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenOrderModal}
              className="px-6 py-3 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm transition-colors cursor-pointer"
            >
              {t.completeOrder}
            </button>
          </div>
        )}
      </div>

      {/* Dedicated A4-Sized Printable Menu Document */}
      <div className="hidden print:block w-full max-w-[186mm] mx-auto text-[#121212] bg-white p-2">
        {/* A4 Header */}
        <header className="border-b-2 border-[#B8860B] pb-4 mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#8A6508]">
              {branchConfig.districtTagEn}
            </p>
            <h1 className="font-display-serif text-2xl font-bold text-[#121212] mt-0.5">
              {lang === 'ar' ? branchConfig.nameAr : branchConfig.nameEn}
            </h1>
            <p className="text-xs font-semibold text-[#4A4338] mt-1">
              {t.printDocTitle} — {activeCategoryLabel}
              {searchQuery.trim() ? ` (${searchQuery.trim()})` : ''}
            </p>
          </div>

          <div className="text-end text-[11px] text-[#3A342B] space-y-0.5 leading-snug">
            <p className="font-bold text-[#121212]">
              {lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn}
            </p>
            <p dir="ltr" className="font-mono font-bold text-[#8A6508]">
              ☎ {branchConfig.phone}
            </p>
            <p>{lang === 'ar' ? branchConfig.hoursAr : branchConfig.hoursEn}</p>
          </div>
        </header>

        {/* Printable Items Table/Grid (Clean 2-Column A4 Layout) */}
        {filteredMenu.length === 0 ? (
          <p className="text-center text-sm py-8 text-[#555]">{t.emptySearch}</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {filteredMenu.map((item) => {
              const primaryTitle = lang === 'ar' ? item.titleAr : item.titleEn;
              const secondaryTitle = lang === 'ar' ? item.titleEn : item.titleAr;
              const desc =
                lang === 'ar' ? item.descriptionAr : item.descriptionEn || item.descriptionAr;
              const categoryName = t.categories[item.category];

              return (
                <div
                  key={`print-${item.id}`}
                  className="break-inside-avoid border-b border-[#D4AF37]/45 pb-3 flex flex-col justify-between"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-[#121212] leading-snug">
                        {primaryTitle}
                      </h2>
                      {secondaryTitle && (
                        <p className="text-[10px] text-[#6B5B3E] font-medium">
                          {secondaryTitle}
                        </p>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[#8A6508] whitespace-nowrap tabular-nums shrink-0">
                      {item.price} {t.currency}
                    </div>
                  </div>

                  <p className="text-[11px] text-[#3A342B] mt-1 leading-relaxed">
                    {desc}
                  </p>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#6E6558]">
                    <span className="font-semibold text-[#8A6508]">{categoryName}</span>
                    {!item.available ? (
                      <span className="italic">{t.unavailable}</span>
                    ) : isPopularDish(item) ? (
                      <span className="font-bold text-[#121212]">
                        ★ {lang === 'ar' ? 'طبق مميز · الأكثر طلباً' : 'Popular'}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* A4 Footer */}
        <footer className="mt-6 pt-3 border-t border-[#B8860B]/60 flex items-center justify-between text-[10px] text-[#4A4338]">
          <span>
            {lang === 'ar'
              ? `للطلبات السريعة عبر الواتساب (${branchConfig.shortNameAr}): ${branchConfig.phone} · التوصيل والسفري متاح يومياً`
              : `WhatsApp Orders & Delivery (${branchConfig.shortNameEn}): ${branchConfig.phone} · Takeaway & Delivery Daily`}
          </span>
          <span className="font-mono">
            {filteredMenu.length} {t.itemsCount}
          </span>
        </footer>
      </div>
    </section>
  );
};
