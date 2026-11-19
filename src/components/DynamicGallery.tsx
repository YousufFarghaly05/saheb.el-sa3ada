import React, { useState } from 'react';
import {
  Camera,
  Sparkles,
  Maximize2,
  X,
  Play,
  Film,
  ExternalLink,
} from 'lucide-react';
import type { GalleryPhoto, GalleryCategory, Lang } from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';
import { ResilientImage } from './ResilientImage.tsx';

interface DynamicGalleryProps {
  lang: Lang;
  gallery: GalleryPhoto[];
}

function getEmbedVideoUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/
  );
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
  }
  return null;
}

function isDirectVideoFile(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('data:video/') ||
    /\.(mp4|webm|ogg)(\?.*)?$/i.test(url)
  );
}

export const DynamicGallery: React.FC<DynamicGalleryProps> = ({
  lang,
  gallery,
}) => {
  const t = getTranslations(lang).gallery;
  const [selectedCategory, setSelectedCategory] = useState<'all' | GalleryCategory>('all');
  const [lightboxItem, setLightboxItem] = useState<GalleryPhoto | null>(null);

  const categories: { id: 'all' | GalleryCategory; label: string }[] = [
    { id: 'all', label: t.categories.all },
    { id: 'ambience_stage', label: t.categories.ambience_stage },
    { id: 'food_drinks', label: t.categories.food_drinks },
    { id: 'videos', label: t.categories.videos },
  ];

  const filteredPhotos =
    selectedCategory === 'all'
      ? gallery
      : gallery.filter((p) =>
          selectedCategory === 'videos'
            ? p.category === 'videos' || p.mediaType === 'video'
            : p.category === selectedCategory
        );

  return (
    <section id="gallery" className="py-16 sm:py-20 bg-[#121212] border-b border-[#D4AF37]/20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold mb-3">
              <Camera className="w-3.5 h-3.5" />
              <span>{t.curatedNote}</span>
            </div>
            <h2 className="font-display-serif text-3xl sm:text-4xl font-bold text-[#F7F3E9]">
              {t.sectionTitle}
            </h2>
            <p className="text-[#C9C1B1] mt-2 text-sm sm:text-base max-w-2xl">
              {t.sectionSubtitle}
            </p>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                      : 'bg-[#1E1E1E] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]/60 hover:text-[#F7F3E9]'
                  }`}
                >
                  {cat.id === 'videos' && <Film className="w-3.5 h-3.5" />}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Gallery Grid */}
        {filteredPhotos.length === 0 ? (
          <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-12 text-center">
            <Film className="w-10 h-10 text-[#D4AF37]/50 mx-auto mb-3" />
            <p className="text-[#F7F3E9] font-bold text-sm sm:text-base">
              {t.emptyVideoCategory}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredPhotos.map((item, index) => {
              const title = lang === 'ar' ? item.titleAr : item.titleEn || item.titleAr;
              const isHeroTile = index === 0 && selectedCategory === 'all';
              const isVideo = item.mediaType === 'video' || item.category === 'videos';
              const mediaTarget = item.videoUrl || item.imageUrl;

              return (
                <div
                  key={item.id}
                  onClick={() => setLightboxItem(item)}
                  className={`group relative overflow-hidden bg-[#1E1E1E] border border-[#D4AF37]/25 hover:border-[#D4AF37] transition-all cursor-pointer ${
                    isHeroTile ? 'sm:col-span-2 sm:row-span-2 min-h-[340px]' : 'h-64'
                  }`}
                >
                  {isVideo && isDirectVideoFile(mediaTarget) ? (
                    <video
                      src={mediaTarget}
                      muted
                      playsInline
                      loop
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => e.currentTarget.pause()}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <ResilientImage
                      src={item.imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/25 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

                  {/* Top Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 bg-[#121212]/90 border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-medium">
                    {isVideo ? (
                      <>
                        <Film className="w-3 h-3 text-[#D4AF37]" />
                        <span>{t.playVideo}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                        <span>
                          {item.source === 'curated' ? t.curatedNote : t.uploadedNote}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Center Play Icon for Videos or Zoom Icon for Images */}
                  {isVideo ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 bg-[#D4AF37]/90 text-[#121212] flex items-center justify-center shadow-[0_0_25px_rgba(212,175,55,0.6)] group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-[#121212]" />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute top-3 left-3 w-8 h-8 bg-[#121212]/80 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  )}

                  {/* Caption */}
                  <div className="absolute bottom-0 inset-x-0 p-4">
                    <p className="text-[#F7F3E9] font-bold text-sm sm:text-base group-hover:text-[#D4AF37] transition-colors">
                      {title}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal for Zooming Photos & Playing Videos */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#1E1E1E] border border-[#D4AF37] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxItem(null)}
              className="absolute top-4 left-4 z-20 w-10 h-10 bg-[#121212]/90 border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center hover:bg-[#D4AF37] hover:text-[#121212] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="max-h-[75vh] overflow-hidden bg-[#121212] flex items-center justify-center">
              {lightboxItem.mediaType === 'video' || lightboxItem.category === 'videos' ? (
                (() => {
                  const targetUrl = lightboxItem.videoUrl || lightboxItem.imageUrl;
                  const ytEmbed = getEmbedVideoUrl(targetUrl);
                  if (ytEmbed) {
                    return (
                      <iframe
                        src={ytEmbed}
                        title={lightboxItem.titleAr}
                        className="w-full aspect-video border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    );
                  }
                  if (isDirectVideoFile(targetUrl)) {
                    return (
                      <video
                        src={targetUrl}
                        controls
                        autoPlay
                        className="w-full max-h-[72vh] object-contain"
                      />
                    );
                  }
                  return (
                    <div className="p-12 text-center space-y-4">
                      <ResilientImage
                        src={lightboxItem.imageUrl}
                        alt={lightboxItem.titleAr}
                        className="max-h-80 mx-auto object-contain border border-[#D4AF37]/30"
                      />
                      <div>
                        <a
                          href={targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-[#D4AF37] text-[#121212] font-bold text-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>{t.openFullImage}</span>
                        </a>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <ResilientImage
                  src={lightboxItem.imageUrl}
                  alt={lang === 'ar' ? lightboxItem.titleAr : lightboxItem.titleEn}
                  className="w-full max-h-[72vh] object-contain"
                />
              )}
            </div>

            <div className="p-4 sm:p-5 bg-[#121212] border-t border-[#D4AF37]/30 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-lg text-[#F7F3E9]">
                  {lang === 'ar' ? lightboxItem.titleAr : lightboxItem.titleEn || lightboxItem.titleAr}
                </h4>
                <p className="text-xs text-[#D4AF37] mt-0.5">
                  {lang === 'ar'
                    ? 'مطعم وكافيه صاحب السعادة - مول 106، شارع التسعين الشمالي، التجمع الخامس'
                    : 'Saheb El Saada - Mall 106, North 90th St, New Cairo'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
