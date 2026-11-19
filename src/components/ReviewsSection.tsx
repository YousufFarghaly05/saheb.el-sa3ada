import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  Quote,
  CheckCircle2,
  AlertTriangle,
  Send,
  MapPin,
  MessageSquarePlus,
} from 'lucide-react';
import type { BranchConfig, BranchId, CustomerReview, Lang } from '../types.ts';
import { BRANCH_CONFIGS, BRANCH_ORDER } from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';

interface ReviewsSectionProps {
  lang: Lang;
  branchConfig: BranchConfig;
  branchConfigs?: Record<BranchId, BranchConfig>;
  reviews: CustomerReview[];
  onAddReview: (review: Omit<CustomerReview, 'id' | 'createdAt'>) => CustomerReview;
}

const BANNED_WORDS_PATTERN =
  /(?:شتيمه|شتيمة|قذر|وسخ|زباله|زبالة|حمار|كلب|غبي|تافه|فاشل|نصاب|نصابين|حرامي|حرامية|لعنة|سافل|حقير|قبيح|خرا|خرة|زفت|احا|أحا|شرموط|عرص|معرص|خول|متناك|كسم|نيك|وسخة|fuck|shit|bitch|asshole|bastard|dick|pussy|whore|slut|cunt|scam|wtf|stfu|porn|xxx)/i;

const EXTERNAL_LINK_PATTERN =
  /(?:https?:\/\/|www\.|[a-zA-Z0-9-]+\.(?:com|net|org|io|me|ly|gl|app|link|co|info|biz)\b)/i;

export function containsInappropriateOrLinks(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return EXTERNAL_LINK_PATTERN.test(normalized) || BANNED_WORDS_PATTERN.test(normalized);
}

function formatReviewDate(isoDate: string, lang: Lang): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  lang,
  branchConfig,
  branchConfigs = BRANCH_CONFIGS,
  reviews = [],
  onAddReview,
}) => {
  const t = getTranslations(lang).reviews;

  const [authorName, setAuthorName] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<BranchId>(branchConfig.id);
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [filterBranch, setFilterBranch] = useState<'all' | BranchId>('all');
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState(false);

  useEffect(() => {
    setSelectedBranch(branchConfig.id);
  }, [branchConfig.id]);

  // Automatic calculation of overall star rating average based on total registered reviews
  const { averageRating, totalReviewsCount } = useMemo(() => {
    if (reviews.length === 0) {
      return { averageRating: '0.0', totalReviewsCount: 0 };
    }
    const sum = reviews.reduce((acc, item) => acc + (Number(item.rating) || 5), 0);
    return {
      averageRating: (sum / reviews.length).toFixed(1),
      totalReviewsCount: reviews.length,
    };
  }, [reviews]);

  const displayedReviews = useMemo(() => {
    if (filterBranch === 'all') return reviews;
    return reviews.filter((r) => r.branchId === filterBranch);
  }, [reviews, filterBranch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);
    setSuccessNotice(false);

    const cleanName = authorName.trim();
    const cleanComment = comment.trim();

    if (!cleanName || !cleanComment) {
      setErrorAlert(
        lang === 'ar'
          ? 'يرجى كتابة الاسم والتعليق قبل نشر التقييم.'
          : 'Please enter your name and review comment.'
      );
      return;
    }

    // Smart Validation: Block profanity or external links (http / www)
    if (containsInappropriateOrLinks(cleanName) || containsInappropriateOrLinks(cleanComment)) {
      setErrorAlert('يرجى الالتزام بالآداب العامة');
      return;
    }

    onAddReview({
      author: cleanName,
      branchId: selectedBranch,
      rating: Math.min(5, Math.max(1, rating)),
      comment: cleanComment,
    });

    setAuthorName('');
    setComment('');
    setRating(5);
    setHoverRating(0);
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 3500);
  };

  const activeStarValue = hoverRating || rating;

  return (
    <section id="reviews" className="py-16 sm:py-20 bg-[#181510] border-b border-[#D4AF37]/20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
        {/* Header & Live Calculated Average Rating Summary */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold mb-3">
              <Star className="w-3.5 h-3.5 fill-[#D4AF37]" />
              <span>{t.badgeText}</span>
            </span>
            <h2 className="font-display-serif text-3xl sm:text-4xl font-bold text-[#F7F3E9]">
              {t.sectionTitle}
            </h2>
            <p className="text-[#C9C1B1] mt-2 text-sm sm:text-base max-w-2xl">
              {t.sectionSubtitle}
            </p>
          </div>

          {/* Automatic Overall Star Rating Average Box */}
          <div className="bg-[#121212] border border-[#D4AF37]/40 px-6 py-4 flex items-center gap-4 shrink-0">
            <div className="text-3xl sm:text-4xl font-bold text-[#D4AF37] tabular-nums">
              {averageRating}
            </div>
            <div>
              <div className="flex items-center gap-1 text-[#D4AF37]">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const filled =
                    totalReviewsCount === 0
                      ? false
                      : starIdx <= Math.round(Number(averageRating));
                  return (
                    <Star
                      key={starIdx}
                      className={`w-4 h-4 ${
                        filled ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#D4AF37]/30'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-[#C9C1B1] mt-1">
                {lang === 'ar'
                  ? `متوسط التقييم العام (${totalReviewsCount} تقييم مسجل)`
                  : `Overall Average (${totalReviewsCount} live reviews)`}
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Review Form & Live Reviews Split / Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive Review Form: "شاركنا رأيك في تجربتك" */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-5 bg-[#121212] border-2 border-[#D4AF37]/50 p-6 sm:p-7 space-y-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center gap-2.5 border-b border-[#D4AF37]/20 pb-3.5">
              <div className="w-9 h-9 bg-[#D4AF37]/15 border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
                <MessageSquarePlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#D4AF37]">
                  شاركنا رأيك في تجربتك
                </h3>
                <p className="text-[11px] text-[#9E9585]">
                  {lang === 'ar'
                    ? 'يُنشر تقييمك فوراً على الصفحة مباشرة'
                    : 'Your review is published live immediately'}
                </p>
              </div>
            </div>

            {errorAlert && (
              <div
                role="alert"
                className="p-3.5 bg-red-950/70 border border-red-500 text-red-200 text-xs sm:text-sm font-bold flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorAlert}</span>
              </div>
            )}

            {successNotice && (
              <div
                role="status"
                className="p-3.5 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] text-xs sm:text-sm font-bold flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {lang === 'ar'
                    ? 'شكراً لك! تم نشر تقييمك فوراً وتحديث المتوسط العام.'
                    : 'Thank you! Your review has been published live.'}
                </span>
              </div>
            )}

            {/* 1. Customer Name Input */}
            <div>
              <label
                htmlFor="review-author-name"
                className="block text-xs font-bold text-[#F7F3E9] mb-1.5"
              >
                {lang === 'ar' ? 'اسم العميل *' : 'Customer Name *'}
              </label>
              <input
                id="review-author-name"
                type="text"
                required
                value={authorName}
                onChange={(e) => {
                  setAuthorName(e.target.value);
                  if (errorAlert) setErrorAlert(null);
                }}
                placeholder={lang === 'ar' ? 'اكتب اسمك الكريم...' : 'Enter your name...'}
                className="w-full px-3.5 py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] placeholder-[#9E9585] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* 2. Branch Dropdown (المعز / التجمع / الشيخ زايد) */}
            <div>
              <label
                htmlFor="review-branch-select"
                className="block text-xs font-bold text-[#F7F3E9] mb-1.5"
              >
                {lang === 'ar' ? 'اختر الفرع *' : 'Select Branch *'}
              </label>
              <select
                id="review-branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as BranchId)}
                className="w-full px-3.5 py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm font-semibold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                {BRANCH_ORDER.map((bId) => {
                  const cfg = branchConfigs[bId];
                  return (
                    <option key={`rev-branch-${bId}`} value={bId} className="bg-[#121212] text-[#F7F3E9]">
                      {lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 3. Interactive 1 to 5 Stars Rating Selector */}
            <div>
              <span className="block text-xs font-bold text-[#F7F3E9] mb-2">
                {lang === 'ar' ? 'التقييم بالنجوم (من ١ إلى ٥) *' : 'Star Rating (1 to 5) *'}
              </span>
              <div className="flex items-center justify-between bg-[#1E1E1E] border border-[#D4AF37]/35 px-4 py-2.5">
                <div
                  role="radiogroup"
                  aria-label={lang === 'ar' ? 'تقييم النجوم' : 'Star rating'}
                  className="flex items-center gap-1.5"
                >
                  {[1, 2, 3, 4, 5].map((starValue) => {
                    const isFilled = starValue <= activeStarValue;
                    return (
                      <button
                        key={starValue}
                        type="button"
                        role="radio"
                        aria-checked={rating === starValue}
                        aria-label={`${starValue} ${lang === 'ar' ? 'نجوم' : 'stars'}`}
                        onClick={() => setRating(starValue)}
                        onMouseEnter={() => setHoverRating(starValue)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 transition-transform hover:scale-110 cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            isFilled
                              ? 'fill-[#D4AF37] text-[#D4AF37]'
                              : 'fill-transparent text-[#9E9585]/50 hover:text-[#D4AF37]'
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs font-bold text-[#D4AF37] tabular-nums">
                  {activeStarValue} / 5 ★
                </span>
              </div>
            </div>

            {/* 4. Comment Textarea (Food Quality & Service Notes) */}
            <div>
              <label
                htmlFor="review-comment-text"
                className="block text-xs font-bold text-[#F7F3E9] mb-1.5"
              >
                {lang === 'ar'
                  ? 'التعليق (ملاحظات على جودة الطعام والخدمة) *'
                  : 'Comment (Notes on food quality & service) *'}
              </label>
              <textarea
                id="review-comment-text"
                rows={4}
                required
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (errorAlert) setErrorAlert(null);
                }}
                placeholder={
                  lang === 'ar'
                    ? 'اكتب رأيك في جودة الطعام، الضيافة، ومستوى الخدمة...'
                    : 'Share your thoughts on food quality, hospitality, and service...'
                }
                className="w-full px-3.5 py-2.5 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] placeholder-[#9E9585] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* 5. Submit Button: "نشر التقييم" */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.25)]"
            >
              <Send className="w-4 h-4" />
              <span>نشر التقييم</span>
            </button>
          </form>

          {/* Live Published Reviews List */}
          <div className="lg:col-span-7 space-y-5">
            {/* Branch Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121212] border border-[#D4AF37]/25 p-3">
              <span className="text-xs font-bold text-[#C9C1B1]">
                {lang === 'ar'
                  ? `آراء العملاء المنشورة (${displayedReviews.length})`
                  : `Published Guest Reviews (${displayedReviews.length})`}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterBranch('all')}
                  className={`px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                    filterBranch === 'all'
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                      : 'bg-[#1E1E1E] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]'
                  }`}
                >
                  {lang === 'ar' ? 'كل الفروع' : 'All Branches'}
                </button>
                {BRANCH_ORDER.map((bId) => {
                  const cfg = branchConfigs[bId];
                  const active = filterBranch === bId;
                  return (
                    <button
                      key={`filter-rev-${bId}`}
                      type="button"
                      onClick={() => setFilterBranch(bId)}
                      className={`px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                          : 'bg-[#1E1E1E] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]'
                      }`}
                    >
                      {lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {displayedReviews.length === 0 ? (
              <div className="bg-[#121212] border border-[#D4AF37]/25 p-10 text-center space-y-3">
                <Quote className="w-8 h-8 text-[#D4AF37]/40 mx-auto" />
                <p className="text-sm sm:text-base font-bold text-[#F7F3E9]">
                  {t.emptyReviews}
                </p>
                <p className="text-xs text-[#9E9585]">
                  {lang === 'ar'
                    ? 'استخدم نموذج "شاركنا رأيك في تجربتك" لنشر تقييمك فوراً.'
                    : 'Use the form to publish your review immediately.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedReviews.map((rev) => {
                  const revBranchCfg = branchConfigs[rev.branchId] || branchConfig;
                  const branchName =
                    lang === 'ar' ? revBranchCfg.shortNameAr : revBranchCfg.shortNameEn;

                  return (
                    <article
                      key={rev.id}
                      className="bg-[#121212] border border-[#D4AF37]/30 hover:border-[#D4AF37] p-5 flex flex-col justify-between transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-1 text-[#D4AF37]">
                            {[1, 2, 3, 4, 5].map((idx) => (
                              <Star
                                key={idx}
                                className={`w-4 h-4 ${
                                  idx <= rev.rating
                                    ? 'fill-[#D4AF37] text-[#D4AF37]'
                                    : 'text-[#D4AF37]/25'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] font-bold">
                            <MapPin className="w-3 h-3" />
                            <span>{branchName}</span>
                          </span>
                        </div>

                        <p className="text-sm text-[#F7F3E9] leading-relaxed break-words">
                          "{rev.comment}"
                        </p>
                      </div>

                      <div className="pt-4 mt-4 border-t border-[#D4AF37]/15 flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-[#D4AF37] flex items-center gap-1.5">
                          <span>{rev.author}</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                        </h4>
                        <span className="text-[11px] text-[#9E9585]">
                          {formatReviewDate(rev.createdAt, lang)}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
