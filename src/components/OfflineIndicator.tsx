import React from 'react';
import { WifiOff } from 'lucide-react';
import type { Lang } from '../types.ts';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';

interface OfflineIndicatorProps {
  lang: Lang;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ lang }) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="print:hidden fixed bottom-20 left-6 z-40 flex items-center gap-2 border border-[#D4AF37] bg-[#1E1A12]/95 px-3.5 py-2 text-xs font-bold text-[#F7F3E9] shadow-[0_8px_24px_rgba(0,0,0,0.6)] backdrop-blur-sm"
    >
      <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse shrink-0" />
      <WifiOff className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" aria-hidden="true" />
      <span>
        {lang === 'ar'
          ? 'وضع عدم الاتصال — المنيو المحفوظ متاح للتصفح'
          : 'Offline Mode — Cached menu is available'}
      </span>
    </div>
  );
};
