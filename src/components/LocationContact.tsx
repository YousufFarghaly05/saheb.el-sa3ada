import React, { useEffect, useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  Navigation,
  MessageCircle,
  Compass,
  QrCode,
  UtensilsCrossed,
  Download,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import {
  APIProvider,
  Map as GoogleMapView,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useAdvancedMarkerRef,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import type { BranchConfig, BranchId, Lang } from '../types.ts';
import { buildQrCodeImageUrl, getBranchMenuDriveUrl } from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';

interface LocationContactProps {
  lang: Lang;
  branchConfig: BranchConfig;
  mapsQuotaExceeded?: boolean;
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

const KNOWN_BRANCH_COORDS: Partial<Record<BranchId, LatLngPoint>> = {
  branch_tagamoa: { lat: 30.0191522, lng: 31.4215592 },
};

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

interface BranchInteractiveMapProps {
  branchConfig: BranchConfig;
  lang: Lang;
  onQuotaOrError: () => void;
}

interface PlaceSearchResultItem {
  location?: {
    lat: number | (() => number);
    lng: number | (() => number);
  } | null;
}

interface PlaceSearchResponse {
  places?: PlaceSearchResultItem[];
}

const BranchInteractiveMap: React.FC<BranchInteractiveMapProps> = ({
  branchConfig,
  lang,
  onQuotaOrError,
}) => {
  const placesLib = useMapsLibrary('places') as {
    Place?: {
      searchByText: (req: {
        textQuery: string;
        fields: string[];
        region?: string;
        maxResultCount?: number;
      }) => Promise<PlaceSearchResponse>;
    };
  } | null;
  const [resolvedCoords, setResolvedCoords] = useState<Partial<Record<BranchId, LatLngPoint>>>(
    KNOWN_BRANCH_COORDS
  );
  const [infoOpen, setInfoOpen] = useState(true);
  const [markerRef, marker] = useAdvancedMarkerRef();

  const activeCoords = resolvedCoords[branchConfig.id] || KNOWN_BRANCH_COORDS[branchConfig.id];
  const branchTitle = lang === 'ar' ? branchConfig.nameAr : branchConfig.nameEn;
  const branchAddress = lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn;

  useEffect(() => {
    setInfoOpen(true);
  }, [branchConfig.id]);

  useEffect(() => {
    if (activeCoords || !placesLib?.Place?.searchByText) return;
    let cancelled = false;

    const queryText =
      branchConfig.id === 'branch_moez'
        ? 'Saheb El-Saada, 121 El-Moez Lidin Allah Al-Fatimi St, Cairo'
        : 'Saheb El-Saada, Waslet Dahshour, Sheikh Zayed, Giza';

    placesLib.Place.searchByText({
      textQuery: queryText,
      fields: ['displayName', 'location', 'formattedAddress'],
      region: 'eg',
      maxResultCount: 1,
    })
      .then((response: PlaceSearchResponse) => {
        if (cancelled) return;
        const firstPlace = response?.places?.[0];
        const loc = firstPlace?.location;
        if (!loc) return;
        const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
        const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setResolvedCoords((prev) => ({
            ...prev,
            [branchConfig.id]: { lat, lng },
          }));
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('Quota')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onQuotaOrError();
      });

    return () => {
      cancelled = true;
    };
  }, [activeCoords, branchConfig.id, placesLib, onQuotaOrError]);

  if (!activeCoords) {
    return (
      <iframe
        key={`${branchConfig.id}-${lang}-fallback`}
        title={branchTitle}
        src={branchConfig.mapsEmbedUrl.replace('hl=ar', `hl=${lang}`)}
        className="w-full h-[420px] min-h-[420px] border-0 flex-1"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  return (
    <div className="w-full h-[420px] min-h-[420px] flex-1">
      <GoogleMapView
        key={`${branchConfig.id}-${activeCoords.lat}-${activeCoords.lng}`}
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={activeCoords}
        defaultZoom={16}
        gestureHandling="cooperative"
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker
          ref={markerRef}
          position={activeCoords}
          title={branchTitle}
          onClick={() => setInfoOpen(true)}
        >
          <Pin
            background="#D4AF37"
            borderColor="#121212"
            glyphColor="#121212"
            scale={1.15}
          />
        </AdvancedMarker>

        {infoOpen && marker && (
          <InfoWindow
            anchor={marker}
            maxWidth={260}
            onCloseClick={() => setInfoOpen(false)}
          >
            <div className="text-[#121212] p-1 space-y-1" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <p className="font-bold text-xs">{branchTitle}</p>
              <p className="text-[11px] text-neutral-700 leading-snug">{branchAddress}</p>
              <a
                href={branchConfig.mapsShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[11px] font-bold text-[#8A6508] underline"
              >
                {lang === 'ar' ? 'الاتجاهات عبر خرائط جوجل ↗' : 'Directions in Google Maps ↗'}
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMapView>
    </div>
  );
};

type QrTargetMode = 'menu' | 'maps';

export const LocationContact: React.FC<LocationContactProps> = ({
  lang,
  branchConfig,
  mapsQuotaExceeded = false,
}) => {
  const t = getTranslations(lang).contact;
  const address = lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn;
  const hours = lang === 'ar' ? branchConfig.hoursAr : branchConfig.hoursEn;
  const branchShort = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;

  const [qrMode, setQrMode] = useState<QrTargetMode>('menu');
  const [copiedQrUrl, setCopiedQrUrl] = useState(false);
  const [mapLookupFailed, setMapLookupFailed] = useState(false);

  useEffect(() => {
    setMapLookupFailed(false);
  }, [branchConfig.id]);

  const branchMenuDriveUrl = getBranchMenuDriveUrl(branchConfig.id);
  const activeQrUrl = qrMode === 'menu' ? branchMenuDriveUrl : branchConfig.mapsShareUrl;
  const qrServerImageUrl = buildQrCodeImageUrl(activeQrUrl);

  const waInquiryText =
    lang === 'ar'
      ? `مرحباً مطعم وكافيه صاحب السعادة (${branchConfig.shortNameAr})، أود الاستفسار عن حجز طاولة / طلب توصيل.`
      : `Hello Saheb El-Saada (${branchConfig.shortNameEn}), I would like to inquire about a reservation or delivery order.`;

  const handleCopyQrLink = () => {
    navigator.clipboard?.writeText(activeQrUrl).catch(() => {});
    setCopiedQrUrl(true);
    setTimeout(() => setCopiedQrUrl(false), 1800);
  };

  return (
    <section id="location" className="py-16 sm:py-20 bg-[#121212] border-b border-[#D4AF37]/20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Contact Details Column */}
          <div className="lg:col-span-5 bg-[#1E1E1E] border border-[#D4AF37]/30 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              <span className="text-[#D4AF37] text-xs uppercase tracking-widest font-semibold block mb-2">
                {branchConfig.districtTagEn}
              </span>
              <h2 className="font-display-serif text-3xl sm:text-4xl font-bold text-[#F7F3E9]">
                {lang === 'ar'
                  ? `الموقع والتواصل — ${branchShort}`
                  : `Location & Contact — ${branchShort}`}
              </h2>
              <p className="text-[#C9C1B1] text-sm mt-2 leading-relaxed">{address}</p>

              <div className="mt-8 space-y-5">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#9E9585] block">{t.addressTitle}</span>
                    <p className="text-[#F7F3E9] font-semibold text-sm sm:text-base mt-0.5">
                      {address}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#9E9585] block">
                      {lang === 'ar' ? 'الحجز والطلبات (هاتف & واتساب)' : 'Phone & WhatsApp'}
                    </span>
                    <a
                      href={`tel:${branchConfig.phone}`}
                      className="text-[#D4AF37] font-bold text-lg tabular-nums hover:underline mt-0.5 block"
                      dir="ltr"
                    >
                      {branchConfig.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#9E9585] block">{t.hoursTitle}</span>
                    <p className="text-[#F7F3E9] font-semibold text-sm sm:text-base mt-0.5">
                      {hours}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] shrink-0">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs text-[#9E9585] block">{t.servicesTitle}</span>
                    <p className="text-[#F7F3E9] font-semibold text-xs sm:text-sm mt-0.5">
                      {t.servicesValue}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-[#D4AF37]/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={branchConfig.mapsShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                <span>{t.openInMaps}</span>
              </a>

              <a
                href={`https://wa.me/${branchConfig.whatsappIntl}?text=${encodeURIComponent(
                  waInquiryText
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-4 bg-[#121212] hover:bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{t.whatsappDirect}</span>
              </a>
            </div>
          </div>

          {/* Interactive Google Maps Column */}
          <div className="lg:col-span-7 bg-[#1E1E1E] border border-[#D4AF37]/30 overflow-hidden min-h-[420px] relative flex flex-col">
            {MAPS_API_KEY && !mapsQuotaExceeded && !mapLookupFailed ? (
              <APIProvider
                apiKey={MAPS_API_KEY}
                libraries={['marker', 'places']}
                language={lang}
                region="EG"
              >
                <BranchInteractiveMap
                  branchConfig={branchConfig}
                  lang={lang}
                  onQuotaOrError={() => setMapLookupFailed(true)}
                />
              </APIProvider>
            ) : (
              <iframe
                key={`${branchConfig.id}-${lang}`}
                title={lang === 'ar' ? branchConfig.nameAr : branchConfig.nameEn}
                src={branchConfig.mapsEmbedUrl.replace('hl=ar', `hl=${lang}`)}
                className="w-full h-[420px] min-h-[420px] border-0 flex-1"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
            <div className="bg-[#121212]/95 border-t border-[#D4AF37]/30 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-[#F7F3E9] font-semibold">📍 {address}</span>
              <a
                href={branchConfig.mapsShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D4AF37] hover:underline font-bold"
              >
                {lang === 'ar' ? 'فتح في تطبيق Google Maps ↗' : 'Open in Google Maps ↗'}
              </a>
            </div>
          </div>
        </div>

        {/* Unique Branch QR Code Card (Direct Google Drive Menu PDF & Google Maps Navigation) */}
        <div className="bg-gradient-to-l from-[#181510] via-[#1E1E1E] to-[#181510] border border-[#D4AF37]/40 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-4 flex-1 text-center md:text-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold">
              <QrCode className="w-4 h-4" />
              <span>
                {lang === 'ar'
                  ? `رمز الاستجابة السريع الخاص بـ ${branchShort}`
                  : `Quick Mobile QR Code — ${branchShort}`}
              </span>
            </div>

            <div>
              <h3 className="font-display-serif text-2xl sm:text-3xl font-bold text-[#F7F3E9]">
                {lang === 'ar'
                  ? 'امسح الكود بهاتفك لفتح المنيو الكامل (PDF) أو موقع الفرع'
                  : 'Scan with Your Phone to Open Full PDF Menu or Branch Map'}
              </h3>
              <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1.5 max-w-xl leading-relaxed">
                {qrMode === 'menu'
                  ? lang === 'ar'
                    ? `وجّه كاميرا هاتفك نحو الرمز لفتح ملف المنيو الكامل (PDF) الخاص بـ ${branchShort} مباشرة على هاتفك فوراً.`
                    : `Point your phone camera at this code to directly open the official PDF menu for ${branchShort} on your mobile device.`
                  : lang === 'ar'
                  ? `وجّه كاميرا هاتفك نحو الرمز لفتح موقع ${branchShort} الرسمي على خرائط جوجل والاتجاه إلى المطعم بسهولة.`
                  : `Point your phone camera at this code to open ${branchShort} in Google Maps for turn-by-turn directions.`}
              </p>
            </div>

            {/* Mode Switcher: Branch Menu PDF vs Google Maps Navigation */}
            <div
              role="group"
              aria-label={lang === 'ar' ? 'نوع رمز QR' : 'QR Code Destination'}
              className="inline-flex flex-wrap items-center justify-center md:justify-start gap-2"
            >
              <button
                type="button"
                aria-pressed={qrMode === 'menu'}
                onClick={() => setQrMode('menu')}
                className={`px-4 py-2 text-xs font-bold border flex items-center gap-2 transition-colors cursor-pointer ${
                  qrMode === 'menu'
                    ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                    : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'منيو الفرع الكامل (PDF)' : 'Full Branch Menu (PDF)'}</span>
              </button>

              <button
                type="button"
                aria-pressed={qrMode === 'maps'}
                onClick={() => setQrMode('maps')}
                className={`px-4 py-2 text-xs font-bold border flex items-center gap-2 transition-colors cursor-pointer ${
                  qrMode === 'maps'
                    ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                    : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'الاتجاه للمطعم (Google Maps)' : 'Navigate to Branch'}</span>
              </button>
            </div>

            {/* Direct Link & Copy Controls */}
            <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <a
                href={activeQrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {qrMode === 'menu'
                    ? lang === 'ar'
                      ? 'فتح ملف المنيو المباشر (PDF)'
                      : 'Open Direct Menu PDF'
                    : lang === 'ar'
                    ? 'فتح الموقع في خرائط جوجل'
                    : 'Open in Google Maps'}
                </span>
              </a>

              <a
                href={qrServerImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#121212] hover:bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'فتح / حفظ صورة QR' : 'View / Save QR Image'}</span>
              </a>

              <button
                type="button"
                onClick={handleCopyQrLink}
                className="px-4 py-2 bg-[#121212] hover:bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#F7F3E9] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedQrUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-[#10B981]">
                      {lang === 'ar' ? 'تم نسخ الرابط' : 'Link Copied'}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>{lang === 'ar' ? 'نسخ الرابط المباشر' : 'Copy Direct Link'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Crisp Scannable QR Display Frame via api.qrserver.com */}
          <div className="shrink-0 flex flex-col items-center gap-2.5 bg-[#121212] border border-[#D4AF37]/50 p-4 shadow-xl">
            <a
              href={activeQrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white p-3 border-2 border-[#D4AF37] block hover:opacity-95 transition-opacity"
              aria-label={`${branchShort} QR Code (${qrMode})`}
              title={lang === 'ar' ? 'اضغط لفتح الرابط المباشر' : 'Click to open direct link'}
            >
              <img
                src={qrServerImageUrl}
                alt={`${branchShort} QR Code`}
                width={170}
                height={170}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="w-[170px] h-[170px] object-contain block"
              />
            </a>
            <div className="text-center">
              <span className="block text-xs font-bold text-[#D4AF37]">{branchShort}</span>
              <span className="block text-[10px] text-[#9E9585] mt-0.5">
                {qrMode === 'menu'
                  ? lang === 'ar'
                    ? 'منيو الفرع الرسمي (Google Drive PDF)'
                    : 'Official PDF Menu QR'
                  : lang === 'ar'
                  ? 'موقع الفرع الرسمي (Google Maps)'
                  : 'Official Google Maps QR'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
