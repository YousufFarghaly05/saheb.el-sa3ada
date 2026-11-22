import { useState, useEffect } from 'react';
import { Clock, Megaphone, UtensilsCrossed } from 'lucide-react';
import type { BranchConfig, Lang, ShowSchedule } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';

const PRIMARY_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=75';
const SECONDARY_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=75';

function normalizeAnnouncementImageUrl(url?: string): string {
  if (!url) return PRIMARY_FALLBACK_IMAGE;
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  return PRIMARY_FALLBACK_IMAGE;
}

interface AnnouncementImageProps {
  src?: string;
  alt: string;
  className?: string;
}

function AnnouncementImage({ src, alt, className = 'h-full w-full object-cover' }: AnnouncementImageProps) {
  const normalized = normalizeAnnouncementImageUrl(src);
  const [imgSrc, setImgSrc] = useState<string>(normalized);
  const [fallbackStep, setFallbackStep] = useState<number>(0);

  useEffect(() => {
    setImgSrc(normalizeAnnouncementImageUrl(src));
    setFallbackStep(0);
  }, [src]);

  if (fallbackStep >= 2) {
    return (
      <div
        role="img"
        aria-label={alt}
        className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#261F15] via-[#1B1712] to-[#12100E] text-[#D4AF37]/70"
      >
        <UtensilsCrossed className="h-9 w-9" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (fallbackStep === 0) {
          setFallbackStep(1);
          setImgSrc(
            imgSrc === PRIMARY_FALLBACK_IMAGE ? SECONDARY_FALLBACK_IMAGE : PRIMARY_FALLBACK_IMAGE
          );
        } else {
          setFallbackStep(2);
        }
      }}
      className={className}
    />
  );
}

interface ShowsScheduleProps {
  lang: Lang;
  branchConfig: BranchConfig;
  shows: ShowSchedule[];
}

export function ShowsSchedule({
  lang,
  branchConfig,
  shows,
}: ShowsScheduleProps) {
  const t = getTranslations(lang);
  const activeShows = shows.filter((s) => s.active);
  const stageCaption = lang === 'ar' ? branchConfig.stageCaptionAr : branchConfig.stageCaptionEn;

  return (
    <section id="shows" className="border-b border-[#D4AF37]/15 bg-[#181512] py-16 sm:py-20">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-1.5">
            {lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn}
          </p>
          <h2
            style={{ textWrap: 'balance' }}
            className="font-display-serif text-3xl sm:text-4xl font-bold text-[#F5F0E6]"
          >
            {t.shows.sectionTitle}
          </h2>
          <p className="mt-3 text-base text-[#C4BAB0] leading-relaxed">
            {t.shows.sectionSubtitle}
          </p>
        </div>

        {/* 2-Column Split with items-stretch balance */}
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Left/Visual Showcase Column */}
          <div className="lg:col-span-5 flex flex-col overflow-hidden rounded-lg border border-[#D4AF37]/20 bg-[#141210]">
            <div className="relative flex-1 min-h-[300px]">
              <AnnouncementImage
                src={branchConfig.stageImageUrl}
                alt={stageCaption}
                className="h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#141210] via-[#141210]/30 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-6">
                <p className="text-sm font-semibold text-[#D4AF37]">{stageCaption}</p>
              </div>
            </div>
          </div>

          {/* Right/Schedule Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {activeShows.map((show) => {
              const day = lang === 'ar' ? show.dayAr : show.dayEn;
              const singer = lang === 'ar' ? show.singerAr : show.singerEn;
              const note = lang === 'ar' ? show.noteAr : show.noteEn;

              return (
                <article
                  key={show.id}
                  className="flex flex-col justify-between overflow-hidden rounded-lg border border-[#D4AF37]/15 bg-[#1E1A16] hover:border-[#D4AF37]/40 transition-colors"
                >
                  <div>
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#141210] border-b border-[#D4AF37]/15">
                      <AnnouncementImage
                        src={show.imageUrl || branchConfig.stageImageUrl}
                        alt={singer}
                        className="h-full w-full object-cover"
                      />
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gradient-to-t from-[#1E1A16]/85 via-transparent to-transparent"
                      />
                      <span className="absolute bottom-2.5 inset-x-3 flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="rounded bg-[#141210]/85 border border-[#D4AF37]/40 px-2 py-0.5 text-[#D4AF37]">
                          {day}
                        </span>
                        <span className="font-tabular rounded bg-[#141210]/80 px-2 py-0.5 text-[#E7DFD3] tabular-nums">
                          {show.tanouraTime} · {show.bandTime}
                        </span>
                      </span>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start gap-2 text-sm font-semibold text-[#F5F0E6]">
                        <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                        <span>{singer}</span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-[#A89E92]">{note}</p>

                      <div className="mt-4 space-y-1.5 border-t border-[#D4AF37]/10 pt-3 text-xs text-[#C7BEB2]">
                        <div className="flex items-center justify-between">
                          <span>{t.shows.tanouraLabel}</span>
                          <span className="font-tabular font-semibold text-[#F5F0E6] tabular-nums flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#D4AF37]" aria-hidden="true" />
                            {show.tanouraTime}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t.shows.bandLabel}</span>
                          <span className="font-tabular font-semibold text-[#F5F0E6] tabular-nums flex items-center gap-1">
                            <Clock className="h-3 w-3 text-[#D4AF37]" aria-hidden="true" />
                            {show.bandTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
