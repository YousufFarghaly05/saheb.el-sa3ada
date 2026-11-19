import { Calendar, Clock, Megaphone } from 'lucide-react';
import type { BranchConfig, Lang, ShowSchedule } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';

interface ShowsScheduleProps {
  lang: Lang;
  branchConfig: BranchConfig;
  shows: ShowSchedule[];
  onReserveForShow: (show: ShowSchedule) => void;
}

export function ShowsSchedule({
  lang,
  branchConfig,
  shows,
  onReserveForShow,
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
              <img
                src={branchConfig.stageImageUrl}
                alt={stageCaption}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
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
                  className="flex flex-col justify-between rounded-lg border border-[#D4AF37]/15 bg-[#1E1A16] p-5 hover:border-[#D4AF37]/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-[#D4AF37]">{day}</h3>
                      <span className="font-tabular text-xs font-medium text-[#C4BAB0] tabular-nums">
                        {show.tanouraTime} · {show.bandTime}
                      </span>
                    </div>

                    <div className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#F5F0E6]">
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

                  <button
                    type="button"
                    onClick={() => onReserveForShow(show)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#D4AF37]/35 bg-[#25201A] px-3.5 py-2 text-xs font-semibold text-[#F5F0E6] hover:bg-[#D4AF37] hover:text-[#141210] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.shows.bookShowBtn}</span>
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
