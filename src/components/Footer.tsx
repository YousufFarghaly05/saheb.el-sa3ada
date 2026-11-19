import type { ReactNode } from 'react';
import { Instagram, Facebook } from 'lucide-react';
import type { BranchCmsSettings, BranchConfig, Lang } from '../types.ts';
import { INITIAL_BRANCH_STORES } from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';

interface FooterProps {
  lang: Lang;
  branchConfig: BranchConfig;
  cmsSettings?: Partial<BranchCmsSettings>;
  onChangeLang: (lang: Lang) => void;
  onNavigateHome: (sectionId?: string) => void;
  onOpenAccount: () => void;
  onNavigateAdmin: () => void;
}

function TikTokIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.76a8.18 8.18 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1-.15z" />
    </svg>
  );
}

function normalizeExternalUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function Footer({
  lang,
  branchConfig,
  cmsSettings,
  onChangeLang,
  onNavigateHome,
  onOpenAccount,
  onNavigateAdmin,
}: FooterProps) {
  const t = getTranslations(lang);
  const branchTagline =
    lang === 'ar'
      ? `${branchConfig.nameAr} · ${branchConfig.addressAr}`
      : `${branchConfig.nameEn} · ${branchConfig.addressEn}`;

  const fallbackCms = INITIAL_BRANCH_STORES[branchConfig.id].cmsSettings;

  const instagramHref = normalizeExternalUrl(
    cmsSettings?.instagramUrl !== undefined
      ? cmsSettings.instagramUrl
      : fallbackCms?.instagramUrl
  );
  const facebookHref = normalizeExternalUrl(
    cmsSettings?.facebookUrl !== undefined
      ? cmsSettings.facebookUrl
      : fallbackCms?.facebookUrl
  );
  const tiktokHref = normalizeExternalUrl(
    cmsSettings?.tiktokUrl !== undefined
      ? cmsSettings.tiktokUrl
      : fallbackCms?.tiktokUrl
  );

  const socialLinks = [
    instagramHref
      ? {
          key: 'instagram',
          label: 'Instagram',
          href: instagramHref,
          icon: <Instagram className="w-4 h-4 shrink-0" />,
        }
      : null,
    facebookHref
      ? {
          key: 'facebook',
          label: 'Facebook',
          href: facebookHref,
          icon: <Facebook className="w-4 h-4 shrink-0" />,
        }
      : null,
    tiktokHref
      ? {
          key: 'tiktok',
          label: 'TikTok',
          href: tiktokHref,
          icon: <TikTokIcon className="w-4 h-4 shrink-0" />,
        }
      : null,
  ].filter(Boolean) as Array<{
    key: string;
    label: string;
    href: string;
    icon: ReactNode;
  }>;

  const branchShortLabel =
    lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;

  return (
    <footer className="border-t border-[#D4AF37]/20 bg-[#101010] py-10 text-sm text-[#A89E92]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 space-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-display-serif text-lg font-bold text-[#D4AF37]">
              {t.brandName}
            </div>
            <p className="mt-1 text-xs text-[#8E857B]">{branchTagline}</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#C7BEB2]">
            <button
              type="button"
              onClick={() => onNavigateHome('menu')}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.menu}
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('gallery')}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.gallery}
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('shows')}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.shows}
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('location')}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.location}
            </button>
            <button
              type="button"
              onClick={onOpenAccount}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.account}
            </button>
            <button
              type="button"
              onClick={onNavigateAdmin}
              className="hover:text-[#D4AF37] transition-colors cursor-pointer"
            >
              {t.nav.admin}
            </button>
            <button
              type="button"
              onClick={() => onChangeLang(lang === 'ar' ? 'en' : 'ar')}
              className="text-[#D4AF37] hover:underline cursor-pointer"
            >
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-[#D4AF37]/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-medium text-[#8E857B]">
                {lang === 'ar'
                  ? `تابعونا (${branchShortLabel}):`
                  : `Follow (${branchShortLabel}):`}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                {socialLinks.map((social) => (
                  <a
                    key={social.key}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${social.label} — ${branchShortLabel}`}
                    className="inline-flex items-center gap-2 border border-[#D4AF37]/30 bg-[#171717] px-3 py-1.5 text-xs font-medium text-[#E5DEC9] hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] transition-colors"
                  >
                    <span className="text-[#D4AF37]">{social.icon}</span>
                    <span>{social.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-[#7E766D]">
            <span>© 2026 {t.brandName}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{t.footer.rights}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
