import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  CalendarPlus,
  Calendar,
  Clock,
  Users,
  MapPin,
  Armchair,
  User,
  Phone,
  MessageCircle,
  ExternalLink,
  Check,
  FileText,
} from 'lucide-react';
import type { BranchConfig, Lang, Reservation } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';

interface BookingSuccessModalProps {
  isOpen: boolean;
  reservation: Reservation | null;
  branchConfig: BranchConfig | null;
  whatsappUrl: string;
  lang: Lang;
  onClose: () => void;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function toIcsUtcString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function buildCalendarData(
  reservation: Reservation,
  branchConfig: BranchConfig,
  seatingLabel: string,
  lang: Lang
) {
  const [yearStr, monthStr, dayStr] = reservation.date.split('-');
  const [hourStr, minStr] = reservation.time.split(':');

  const year = Number(yearStr) || new Date().getFullYear();
  const month = (Number(monthStr) || 1) - 1;
  const day = Number(dayStr) || 1;
  const hour = Number(hourStr);
  const minute = Number(minStr);

  const startDate = new Date(
    year,
    month,
    day,
    Number.isFinite(hour) ? hour : 20,
    Number.isFinite(minute) ? minute : 0,
    0
  );
  // Standard 2-hour dining window
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const dtStart = toIcsUtcString(startDate);
  const dtEnd = toIcsUtcString(endDate);
  const dtStamp = toIcsUtcString(new Date());

  const brand = lang === 'ar' ? 'مطعم وكافيه صاحب السعادة' : 'Saheb El-Saada Restaurant & Café';
  const branchShort = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;
  const branchAddress = lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn;

  const title =
    lang === 'ar'
      ? `حجز طاولة — ${brand} (${branchShort})`
      : `Table Reservation — ${brand} (${branchShort})`;

  const descriptionLines =
    lang === 'ar'
      ? [
          `رقم الحجز: #${reservation.id}`,
          `الفرع: ${branchShort}`,
          `الاسم: ${reservation.customerName}`,
          `الهاتف: ${reservation.phone}`,
          `عدد الأفراد: ${reservation.guests}`,
          `منطقة الجلوس: ${seatingLabel}`,
          reservation.notes ? `ملاحظات: ${reservation.notes}` : '',
        ]
      : [
          `Reservation ID: #${reservation.id}`,
          `Branch: ${branchShort}`,
          `Guest: ${reservation.customerName}`,
          `Phone: ${reservation.phone}`,
          `Guests: ${reservation.guests}`,
          `Seating: ${seatingLabel}`,
          reservation.notes ? `Notes: ${reservation.notes}` : '',
        ];

  const description = descriptionLines.filter(Boolean).join('\n');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Saheb El-Saada//Table Reservation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${reservation.id}@sahebelsaada`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(`${branchShort} - ${branchAddress}`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');

  const googleParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${dtStart}/${dtEnd}`,
    details: description,
    location: `${branchShort} - ${branchAddress}`,
  });

  return {
    icsContent,
    googleCalendarUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
    filename: `saheb-elsaada-${reservation.id.toLowerCase()}.ics`,
  };
}

export const BookingSuccessModal: React.FC<BookingSuccessModalProps> = ({
  isOpen,
  reservation,
  branchConfig,
  whatsappUrl,
  lang,
  onClose,
}) => {
  const t = getTranslations(lang).modal;
  const [calendarSaved, setCalendarSaved] = useState(false);

  useEffect(() => {
    setCalendarSaved(false);
  }, [reservation?.id, isOpen]);

  if (!isOpen || !reservation || !branchConfig) return null;

  const seatingLabel =
    t.seatingOptions[reservation.seatingPreference] || reservation.seatingPreference;
  const branchShort = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;
  const branchAddress = lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn;

  const { icsContent, googleCalendarUrl, filename } = buildCalendarData(
    reservation,
    branchConfig,
    seatingLabel,
    lang
  );

  const handleDownloadIcs = () => {
    try {
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCalendarSaved(true);
    } catch {
      // Fallback: ignored if browser blocks blob download
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-success-heading"
      className="animate-modal-backdrop fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="animate-modal-panel bg-[#1E1E1E] border border-[#D4AF37] max-w-xl w-full overflow-hidden shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Header */}
        <div className="bg-[#121212] px-6 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-[#D4AF37] tracking-wide">
              {t.reservationDetailsTitle}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#C9C1B1] hover:text-[#D4AF37] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto space-y-6">
          {/* Celebration Banner */}
          <div className="text-center space-y-2.5">
            <div className="w-16 h-16 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] mx-auto flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3
              id="booking-success-heading"
              className="font-display-serif text-2xl sm:text-3xl font-bold text-[#F7F3E9]"
            >
              {t.reserveSuccessTitle}
            </h3>
            <p className="text-[#C9C1B1] text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
              {t.reserveSuccessSubtitle}
            </p>
          </div>

          {/* Detailed Reservation Card */}
          <div className="bg-[#121212] border border-[#D4AF37]/35 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/20 pb-3">
              <div>
                <span className="text-[11px] text-[#9E9585] block">{t.refIdLabel}</span>
                <span className="font-mono text-sm sm:text-base font-bold text-[#D4AF37]">
                  #{reservation.id}
                </span>
              </div>
              <span className="px-3 py-1 bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-bold">
                {t.statusPending}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.branchLabel}</span>
                  <span className="text-[#F7F3E9] font-bold block">{branchShort}</span>
                  <span className="text-[11px] text-[#9E9585] block mt-0.5 leading-snug">
                    {branchAddress}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.guestLabel}</span>
                  <span className="text-[#F7F3E9] font-bold block">
                    {reservation.customerName}
                  </span>
                  <span
                    dir="ltr"
                    className="text-[11px] text-[#C9C1B1] inline-flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="w-3 h-3 text-[#D4AF37]" />
                    {reservation.phone}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.dateLabel}</span>
                  <span className="text-[#F7F3E9] font-bold tabular-nums">{reservation.date}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.timeLabel}</span>
                  <span className="text-[#F7F3E9] font-bold tabular-nums" dir="ltr">
                    {reservation.time}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.guestsLabel}</span>
                  <span className="text-[#F7F3E9] font-bold tabular-nums">
                    {reservation.guests} {t.guestsCountSuffix}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Armchair className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.seatingAreaLabel}</span>
                  <span className="text-[#F7F3E9] font-bold">{seatingLabel}</span>
                </div>
              </div>
            </div>

            {reservation.notes && (
              <div className="border-t border-[#D4AF37]/15 pt-3 flex items-start gap-2.5 text-xs">
                <FileText className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-[#9E9585] block">{t.notesLabel}</span>
                  <span className="text-[#F7F3E9] leading-relaxed">{reservation.notes}</span>
                </div>
              </div>
            )}
          </div>

          {/* Save to Calendar Section */}
          <div className="bg-[#16140E] border border-[#D4AF37]/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                <CalendarPlus className="w-4 h-4" />
                <span>{t.saveToCalendarHeading}</span>
              </span>
              {calendarSaved && (
                <span className="text-[11px] text-[#10B981] font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.calendarSavedNotice}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadIcs}
                className="py-2.5 px-4 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CalendarPlus className="w-4 h-4 shrink-0" />
                <span>{t.saveToCalendarBtn}</span>
              </button>

              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-4 bg-[#121212] hover:bg-[#26231B] border border-[#D4AF37]/50 text-[#F7F3E9] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>{t.googleCalendarBtn}</span>
              </a>
            </div>
          </div>

          {/* WhatsApp & Close Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3.5 px-5 bg-[#10B981] hover:bg-[#0ea572] text-[#121212] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_25px_rgba(16,185,129,0.25)]"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>
                {t.openWhatsappBtn} ({branchConfig.phone})
              </span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3.5 bg-[#121212] hover:bg-[#252525] border border-[#D4AF37]/40 text-[#F7F3E9] font-semibold text-xs sm:text-sm cursor-pointer transition-colors"
            >
              {t.doneBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
