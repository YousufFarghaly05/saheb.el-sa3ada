export type Lang = 'ar' | 'en';

export type BranchId = 'branch_tagamoa' | 'branch_moez' | 'branch_zayed';

export interface BranchContactSettings {
  addressAr: string;
  addressEn: string;
  phone: string;
  whatsappIntl: string;
  vodafoneCash: string;
  instapay: string;
}

export interface BranchCmsSettings {
  announcementEnabled: boolean;
  announcementTextAr: string;
  announcementTextEn: string;
  reservationNoteAr: string;
  reservationNoteEn: string;
  instagramUrl?: string;
  facebookUrl?: string;
  tiktokUrl?: string;
  specialOfferEnabled?: boolean;
  specialOfferBadgeAr?: string;
  specialOfferBadgeEn?: string;
  specialOfferTitleAr?: string;
  specialOfferTitleEn?: string;
  specialOfferDescAr?: string;
  specialOfferDescEn?: string;
}

export type MenuCategory = 'mains' | 'appetizers' | 'drinks_desserts' | 'shisha';

export type GalleryCategory = 'ambience_stage' | 'food_drinks' | 'videos';

export type BookingStatus = 'pending' | 'preparing' | 'confirmed' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash_on_delivery' | 'instapay_vodafone';

export type PaymentStatus = 'pending_cod' | 'transfer_submitted' | 'paid';

export interface BranchReviewItem {
  id: string;
  author: string;
  visitType: string;
  rating: number;
  date: string;
  comment: string;
}

export interface CustomerReview {
  id: string;
  author: string;
  branchId: BranchId;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface BranchConfig {
  id: BranchId;
  nameAr: string;
  nameEn: string;
  shortNameAr: string;
  shortNameEn: string;
  portalLabelAr: string;
  portalLabelEn: string;
  districtTagEn: string;
  addressAr: string;
  addressEn: string;
  phone: string;
  whatsappIntl: string;
  vodafoneCash: string;
  instapay: string;
  mapsShareUrl: string;
  mapsEmbedUrl: string;
  hoursAr: string;
  hoursEn: string;
  priceRangeAr: string;
  priceRangeEn: string;
  ratingValue: string;
  reviewsBadgeAr: string;
  reviewsBadgeEn: string;
  reviewsSubtitleAr: string;
  reviewsSubtitleEn: string;
  reviewsVerifiedAr: string;
  reviewsVerifiedEn: string;
  heroTaglineAr: string;
  heroTaglineEn: string;
  heroHeadlineAr: string;
  heroHeadlineEn: string;
  heroSubheadlineAr: string;
  heroSubheadlineEn: string;
  heroImageUrl: string;
  stageImageUrl: string;
  stageCaptionAr: string;
  stageCaptionEn: string;
  reviewsAr: BranchReviewItem[];
  reviewsEn: BranchReviewItem[];
}

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address: string;
  favoriteMenuIds?: string[];
  createdAt: string;
}

export interface AuthSession {
  token: string;
  role: 'customer' | 'admin';
  user?: CustomerUser;
  adminUsername?: string;
}

export interface MenuItem {
  id: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  category: MenuCategory;
  price: number;
  imageUrl: string;
  available: boolean;
  featured?: boolean;
  popular?: boolean;
  tags?: string[];
  prepNoteAr?: string;
  prepNoteEn?: string;
}

export interface ShowSchedule {
  id: string;
  dayAr: string;
  dayEn: string;
  singerAr: string;
  singerEn: string;
  tanouraTime: string;
  bandTime: string;
  noteAr: string;
  noteEn: string;
  active: boolean;
  imageUrl?: string;
}

export interface GalleryPhoto {
  id: string;
  titleAr: string;
  titleEn: string;
  category: GalleryCategory;
  mediaType?: 'image' | 'video';
  imageUrl: string;
  videoUrl?: string;
  source?: 'curated' | 'uploaded' | 'custom_url';
}

export interface Reservation {
  id: string;
  branchId?: BranchId;
  customerId?: string;
  customerName: string;
  phone: string;
  guests: number;
  date: string;
  time: string;
  seatingPreference: 'indoor' | 'outdoor' | 'family' | 'stage' | 'lounge';
  notes: string;
  status: BookingStatus;
  createdAt: string;
}

export interface CartItem {
  menuItemId: string;
  titleAr: string;
  titleEn: string;
  price: number;
  quantity: number;
}

export interface OnlineOrder {
  id: string;
  firestoreDocId?: string;
  branchId?: BranchId;
  customerId?: string;
  customerName: string;
  phone: string;
  serviceType: 'delivery' | 'takeaway';
  address: string;
  requestedTime: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  transferSender?: string;
  notes: string;
  status: BookingStatus;
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  cancelledBy?: 'customer' | 'admin';
  cancelledAt?: string;
  cancellationReason?: string;
  adminCancelAcknowledged?: boolean;
  createdAt: string;
}

export interface StoreState {
  menu: MenuItem[];
  shows: ShowSchedule[];
  gallery: GalleryPhoto[];
  reservations: Reservation[];
  orders: OnlineOrder[];
  branchSettings?: Partial<BranchContactSettings>;
  cmsSettings?: Partial<BranchCmsSettings>;
}

export type DualBranchStoreState = Record<BranchId, StoreState>;
