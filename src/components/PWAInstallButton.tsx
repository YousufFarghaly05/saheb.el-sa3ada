import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import type { Lang } from '../types.ts';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  lang: Lang;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label={lang === 'ar' ? 'تثبيت تطبيق المنيو' : 'Install Menu App'}
        className="inline-flex items-center gap-1.5 rounded-md border border-[#D4AF37]/60 bg-[#1A1713] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">
          {lang === 'ar' ? 'تثبيت المنيو' : 'Install App'}
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label={lang === 'ar' ? 'تثبيت المنيو على آيفون' : 'Install on iOS'}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#D4AF37]/60 bg-[#1A1713] px-2.5 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">
            {lang === 'ar' ? 'حفظ المنيو' : 'Install'}
          </span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            className="animate-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="animate-modal-panel w-full max-w-sm border border-[#D4AF37] bg-[#1E1E1E] p-6 shadow-2xl text-[#F7F3E9]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#D4AF37]/25">
                <h3 className="text-base font-bold text-[#D4AF37]">
                  {lang === 'ar'
                    ? 'تثبيت المنيو للعمل بدون إنترنت'
                    : 'Install Menu for Offline Access'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}
                  className="p-1 text-[#C9C1B1] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-xs sm:text-sm text-[#E4DDD3] leading-relaxed">
                <li className="flex items-center gap-2">
                  <Share className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? '١. اضغط على زر المشاركة (Share) في شريط Safari بالأسفل.'
                      : '1. Tap the Share button in the Safari toolbar.'}
                  </span>
                </li>
                <li>
                  {lang === 'ar'
                    ? '٢. مرّر للأسفل واختر "إضافة إلى الصفحة الرئيسية" (Add to Home Screen).'
                    : '2. Scroll down and tap "Add to Home Screen".'}
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full bg-[#D4AF37] hover:bg-[#E2C04D] py-2 text-xs sm:text-sm font-bold text-[#121212] transition-colors cursor-pointer"
              >
                {lang === 'ar' ? 'حسناً' : 'Got it'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
