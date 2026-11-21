import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  RotateCcw,
  Utensils,
  Sparkles,
  Image as ImageIcon,
  ClipboardList,
  Check,
  X,
  Lock,
  LogOut,
  ShieldCheck,
  Wallet,
  Banknote,
  Upload,
  Film,
  Link as LinkIcon,
  MessageCircle,
  CheckCircle2,
  Camera,
  Building2,
  KeyRound,
  Phone,
  Search,
  Megaphone,
  Star,
  QrCode,
  Download,
  Copy,
  ExternalLink,
  Printer,
  BarChart3,
  Bell,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  Calendar,
} from 'lucide-react';
import type {
  AuthSession,
  BookingStatus,
  BranchCmsSettings,
  BranchConfig,
  BranchContactSettings,
  BranchId,
  CustomerReview,
  CustomerUser,
  DualBranchStoreState,
  GalleryCategory,
  GalleryPhoto,
  Lang,
  MenuCategory,
  MenuItem,
  OnlineOrder,
  Reservation,
  ShowSchedule,
} from '../types.ts';
import {
  BRANCH_CONFIGS,
  BRANCH_ORDER,
  INITIAL_BRANCH_STORES,
  buildQrCodeImageUrl,
  getBranchMenuDriveUrl,
} from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';
import { PRESET_IMAGE_OPTIONS } from '../data/mediaAssets.ts';
import { ResilientImage } from './ResilientImage.tsx';
import { BranchAnalyticsPanel } from './BranchAnalyticsPanel.tsx';
import {
  playOrderCancelledAlertSound,
  playOrderNotificationChime,
  unlockAudioContext,
} from '../utils/orderAlertSound.ts';
import { exportOrdersToExcel } from '../utils/exportOrdersExcel.ts';

interface AdminDashboardProps {
  lang: Lang;
  adminBranch: BranchId;
  onChangeAdminBranch: (branchId: BranchId) => void;
  stores: DualBranchStoreState;
  branchConfig: BranchConfig;
  branchConfigs?: Record<BranchId, BranchConfig>;
  onUpdateBranchSettings: (settings: Partial<BranchContactSettings>) => void;
  cmsSettings?: Partial<BranchCmsSettings>;
  onUpdateCmsSettings: (settings: Partial<BranchCmsSettings>) => void;
  adminSession: AuthSession | null;
  adminAuthReady?: boolean;
  customer?: CustomerUser | null;
  firebaseNonAdminEmail?: string | null;
  firestoreOrdersReady?: boolean;
  authError: string | null;
  authLoading: boolean;
  onAdminLogin: (email: string, password: string) => Promise<boolean>;
  onAdminLogout: () => void | Promise<void>;
  onLogoutCustomer?: () => void;
  menu: MenuItem[];
  shows: ShowSchedule[];
  gallery: GalleryPhoto[];
  reservations: Reservation[];
  orders: OnlineOrder[];
  onAddMenu: (item: Omit<MenuItem, 'id'>) => void;
  onUpdateMenu: (id: string, item: Partial<MenuItem>) => void;
  onDeleteMenu: (id: string) => void;
  onAddShow: (show: Omit<ShowSchedule, 'id'>) => void;
  onUpdateShow: (id: string, show: Partial<ShowSchedule>) => void;
  onDeleteShow: (id: string) => void;
  onAddPhoto: (photo: Omit<GalleryPhoto, 'id'>) => void;
  onAddPhotosBulk: (photos: Omit<GalleryPhoto, 'id'>[]) => void;
  onDeletePhoto: (id: string) => void;
  onUpdateReservationStatus: (id: string, status: BookingStatus) => void;
  onDeleteReservation: (id: string) => void;
  onUpdateOrderStatus: (id: string, status: BookingStatus, branchId?: BranchId) => void;
  onAcknowledgeOrderCancellation?: (branchId: BranchId, orderId: string) => void;
  onDeleteOrder: (id: string, branchId?: BranchId) => void;
  onExportOrdersCsv?: (ordersToExport?: OnlineOrder[]) => boolean;
  reviews: CustomerReview[];
  onDeleteReview: (id: string) => void | Promise<void>;
  onResetDefaults: () => void;
  onExitAdmin: () => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function compressImageDataUrl(dataUrl: string, maxDim = 1400): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (!width || !height || (width <= maxDim && height <= maxDim)) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(maxDim / width, maxDim / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function uploadImageFile(file: File): Promise<string> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const preparedDataUrl = await compressImageDataUrl(rawDataUrl);
  try {
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: preparedDataUrl, filename: file.name }),
    });
    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (json.url) return json.url;
    }
  } catch {
    // Fallback to compressed Data URL when offline
  }
  return preparedDataUrl;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  lang,
  adminBranch,
  onChangeAdminBranch,
  stores,
  branchConfig,
  branchConfigs = BRANCH_CONFIGS,
  onUpdateBranchSettings,
  cmsSettings,
  onUpdateCmsSettings,
  adminSession,
  adminAuthReady = true,
  customer = null,
  firebaseNonAdminEmail = null,
  firestoreOrdersReady = true,
  authError,
  authLoading,
  onAdminLogin,
  onAdminLogout,
  onLogoutCustomer,
  menu,
  shows,
  gallery,
  reservations,
  orders,
  onAddMenu,
  onUpdateMenu,
  onDeleteMenu,
  onAddShow,
  onUpdateShow,
  onDeleteShow,
  onAddPhoto,
  onAddPhotosBulk,
  onDeletePhoto,
  onUpdateReservationStatus,
  onDeleteReservation,
  onUpdateOrderStatus,
  onAcknowledgeOrderCancellation,
  onDeleteOrder,
  onExportOrdersCsv,
  reviews = [],
  onDeleteReview,
  onResetDefaults,
  onExitAdmin,
}) => {
  const fullT = getTranslations(lang);
  const t = fullT.admin;
  const authT = fullT.auth;
  const [activeTab, setActiveTab] = useState<
    'menu' | 'gallery' | 'shows' | 'bookings' | 'analytics' | 'reviews' | 'qr' | 'security'
  >('menu');

  // Branch Menu QR Generator Tool State
  const [qrTargetUrl, setQrTargetUrl] = useState<string>(() => getBranchMenuDriveUrl(adminBranch));
  const [qrSize, setQrSize] = useState<250 | 500 | 800>(250);
  const [qrDownloading, setQrDownloading] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [qrNotice, setQrNotice] = useState<string | null>(null);

  // Login Gate State (Firebase Email/Password Auth)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Permanent Order Delete Confirmation Modal State
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<OnlineOrder | null>(null);

  // Branch Contact / WhatsApp Settings State
  const [bPhone, setBPhone] = useState(branchConfig.phone);
  const [bWhatsappIntl, setBWhatsappIntl] = useState(branchConfig.whatsappIntl);
  const [bVodafoneCash, setBVodafoneCash] = useState(branchConfig.vodafoneCash);
  const [bInstapay, setBInstapay] = useState(branchConfig.instapay);
  const [bAddressAr, setBAddressAr] = useState(branchConfig.addressAr);
  const [bAddressEn, setBAddressEn] = useState(branchConfig.addressEn);
  const [branchSettingsSaved, setBranchSettingsSaved] = useState(false);

  useEffect(() => {
    setBPhone(branchConfig.phone);
    setBWhatsappIntl(branchConfig.whatsappIntl);
    setBVodafoneCash(branchConfig.vodafoneCash);
    setBInstapay(branchConfig.instapay);
    setBAddressAr(branchConfig.addressAr);
    setBAddressEn(branchConfig.addressEn);
    setBranchSettingsSaved(false);
    setQrTargetUrl(getBranchMenuDriveUrl(adminBranch));
    setQrNotice(null);
    setOrderBranchFilter(adminBranch);
  }, [adminBranch, branchConfig]);

  // New Order Web Audio Alert State (always declared above early return)
  const [orderSoundEnabled, setOrderSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('saheb_elsaada_order_sound_v1');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [incomingOrderAlerts, setIncomingOrderAlerts] = useState<
    Array<{ branchId: BranchId; order: OnlineOrder }>
  >([]);
  const [liveCancelledAlerts, setLiveCancelledAlerts] = useState<
    Array<{ branchId: BranchId; order: OnlineOrder }>
  >([]);
  const [csvExported, setCsvExported] = useState(false);
  const seenOrderIdsRef = useRef<Set<string> | null>(null);
  const prevOrderStatusMapRef = useRef<Map<string, string> | null>(null);
  const adminSelfCancelledKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem('saheb_elsaada_order_sound_v1', String(orderSoundEnabled));
    } catch {
      // ignore storage errors
    }
  }, [orderSoundEnabled]);

  useEffect(() => {
    if (!adminSession || !firestoreOrdersReady) {
      seenOrderIdsRef.current = null;
      prevOrderStatusMapRef.current = null;
      return;
    }

    const allOrders: Array<{ branchId: BranchId; order: OnlineOrder }> = [];
    BRANCH_ORDER.forEach((bId) => {
      (stores[bId]?.orders || []).forEach((order) => {
        allOrders.push({ branchId: bId, order });
      });
    });

    const isCancelledStatus = (st: string | undefined) => st === 'cancelled' || st === 'ملغي';

    // First snapshot after login: seed refs silently so historical orders/cancellations never chime
    if (seenOrderIdsRef.current === null || prevOrderStatusMapRef.current === null) {
      seenOrderIdsRef.current = new Set(
        allOrders.map((entry) => entry.order.firestoreDocId || entry.order.id)
      );
      const initialStatusMap = new Map<string, string>();
      allOrders.forEach((entry) => {
        const key = entry.order.firestoreDocId || entry.order.id;
        initialStatusMap.set(key, entry.order.status);
      });
      prevOrderStatusMapRef.current = initialStatusMap;
      return;
    }

    const newlyArrived = allOrders.filter((entry) => {
      const key = entry.order.firestoreDocId || entry.order.id;
      return !seenOrderIdsRef.current!.has(key);
    });

    const newlyCancelled = allOrders.filter((entry) => {
      const key = entry.order.firestoreDocId || entry.order.id;
      const prevStatus = prevOrderStatusMapRef.current!.get(key);
      const currentStatus = entry.order.status;
      if (prevStatus === undefined) return false;
      if (isCancelledStatus(prevStatus) || !isCancelledStatus(currentStatus)) return false;
      if (entry.order.cancelledBy === 'admin') return false;
      if (adminSelfCancelledKeysRef.current.has(key)) {
        adminSelfCancelledKeysRef.current.delete(key);
        return false;
      }
      return true;
    });

    // Keep tracking maps synchronized with latest snapshot
    allOrders.forEach((entry) => {
      const key = entry.order.firestoreDocId || entry.order.id;
      seenOrderIdsRef.current!.add(key);
      prevOrderStatusMapRef.current!.set(key, entry.order.status);
    });

    if (newlyArrived.length > 0) {
      setIncomingOrderAlerts((prev) => [...newlyArrived, ...prev].slice(0, 6));
      if (orderSoundEnabled) {
        playOrderNotificationChime();
      }
    }

    if (newlyCancelled.length > 0) {
      setLiveCancelledAlerts((prev) => {
        const existingKeys = new Set(prev.map((item) => item.order.firestoreDocId || item.order.id));
        const uniqueNew = newlyCancelled.filter(
          (entry) => !existingKeys.has(entry.order.firestoreDocId || entry.order.id)
        );
        return [...uniqueNew, ...prev].slice(0, 8);
      });
      if (orderSoundEnabled) {
        playOrderCancelledAlertSound();
      }
    }
  }, [stores, adminSession, firestoreOrdersReady, orderSoundEnabled]);

  // Menu Form, Orders & Reservations Filter State
  const [menuAdminSearch, setMenuAdminSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderBranchFilter, setOrderBranchFilter] = useState<'all' | BranchId>(adminBranch);
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | BookingStatus>('all');
  const [reservationSearch, setReservationSearch] = useState('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState<'all' | BookingStatus>('all');
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [mTitleAr, setMTitleAr] = useState('');
  const [mTitleEn, setMTitleEn] = useState('');
  const [mDescAr, setMDescAr] = useState('');
  const [mCategory, setMCategory] = useState<MenuCategory>('mains');
  const [mPrice, setMPrice] = useState<number>(250);
  const [mImageUrl, setMImageUrl] = useState<string>(PRESET_IMAGE_OPTIONS[0].url);
  const [mAvailable, setMAvailable] = useState<boolean>(true);
  const [uploadingMenuImage, setUploadingMenuImage] = useState(false);
  const [quickUploadMenuId, setQuickUploadMenuId] = useState<string | null>(null);
  const menuFileInputRef = useRef<HTMLInputElement | null>(null);
  const quickMenuFileInputRef = useRef<HTMLInputElement | null>(null);

  // Shows / Announcements CMS State
  const [editingShowId, setEditingShowId] = useState<string | null>(null);
  const [sDayAr, setSDayAr] = useState('');
  const [sDayEn, setSDayEn] = useState('');
  const [sSingerAr, setSSingerAr] = useState('');
  const [sTanouraTime, setSTanouraTime] = useState('12:00 PM');
  const [sBandTime, setSBandTime] = useState('11:00 PM');
  const [sNoteAr, setSNoteAr] = useState('');

  // Site Announcement Banner & Reservation Notes CMS State
  const [cmsAnnouncementEnabled, setCmsAnnouncementEnabled] = useState(
    Boolean(cmsSettings?.announcementEnabled)
  );
  const [cmsAnnouncementAr, setCmsAnnouncementAr] = useState(cmsSettings?.announcementTextAr || '');
  const [cmsAnnouncementEn, setCmsAnnouncementEn] = useState(cmsSettings?.announcementTextEn || '');
  const [cmsReservationNoteAr, setCmsReservationNoteAr] = useState(
    cmsSettings?.reservationNoteAr || ''
  );
  const [cmsReservationNoteEn, setCmsReservationNoteEn] = useState(
    cmsSettings?.reservationNoteEn || ''
  );
  const [cmsInstagramUrl, setCmsInstagramUrl] = useState(
    cmsSettings?.instagramUrl !== undefined
      ? cmsSettings.instagramUrl
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.instagramUrl || ''
  );
  const [cmsFacebookUrl, setCmsFacebookUrl] = useState(
    cmsSettings?.facebookUrl !== undefined
      ? cmsSettings.facebookUrl
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.facebookUrl || ''
  );
  const [cmsTiktokUrl, setCmsTiktokUrl] = useState(
    cmsSettings?.tiktokUrl !== undefined
      ? cmsSettings.tiktokUrl
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.tiktokUrl || ''
  );
  const [cmsSpecialOfferEnabled, setCmsSpecialOfferEnabled] = useState(
    cmsSettings?.specialOfferEnabled !== undefined
      ? Boolean(cmsSettings.specialOfferEnabled)
      : Boolean(INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferEnabled)
  );
  const [cmsSpecialOfferBadgeAr, setCmsSpecialOfferBadgeAr] = useState(
    cmsSettings?.specialOfferBadgeAr !== undefined
      ? cmsSettings.specialOfferBadgeAr
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferBadgeAr || ''
  );
  const [cmsSpecialOfferBadgeEn, setCmsSpecialOfferBadgeEn] = useState(
    cmsSettings?.specialOfferBadgeEn !== undefined
      ? cmsSettings.specialOfferBadgeEn
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferBadgeEn || ''
  );
  const [cmsSpecialOfferTitleAr, setCmsSpecialOfferTitleAr] = useState(
    cmsSettings?.specialOfferTitleAr !== undefined
      ? cmsSettings.specialOfferTitleAr
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferTitleAr || ''
  );
  const [cmsSpecialOfferTitleEn, setCmsSpecialOfferTitleEn] = useState(
    cmsSettings?.specialOfferTitleEn !== undefined
      ? cmsSettings.specialOfferTitleEn
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferTitleEn || ''
  );
  const [cmsSpecialOfferDescAr, setCmsSpecialOfferDescAr] = useState(
    cmsSettings?.specialOfferDescAr !== undefined
      ? cmsSettings.specialOfferDescAr
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferDescAr || ''
  );
  const [cmsSpecialOfferDescEn, setCmsSpecialOfferDescEn] = useState(
    cmsSettings?.specialOfferDescEn !== undefined
      ? cmsSettings.specialOfferDescEn
      : INITIAL_BRANCH_STORES[adminBranch].cmsSettings?.specialOfferDescEn || ''
  );
  const [cmsSaved, setCmsSaved] = useState(false);

  useEffect(() => {
    const fallbackCms = INITIAL_BRANCH_STORES[adminBranch].cmsSettings;
    setCmsAnnouncementEnabled(Boolean(cmsSettings?.announcementEnabled));
    setCmsAnnouncementAr(cmsSettings?.announcementTextAr || '');
    setCmsAnnouncementEn(cmsSettings?.announcementTextEn || '');
    setCmsReservationNoteAr(cmsSettings?.reservationNoteAr || '');
    setCmsReservationNoteEn(cmsSettings?.reservationNoteEn || '');
    setCmsInstagramUrl(
      cmsSettings?.instagramUrl !== undefined
        ? cmsSettings.instagramUrl
        : fallbackCms?.instagramUrl || ''
    );
    setCmsFacebookUrl(
      cmsSettings?.facebookUrl !== undefined
        ? cmsSettings.facebookUrl
        : fallbackCms?.facebookUrl || ''
    );
    setCmsTiktokUrl(
      cmsSettings?.tiktokUrl !== undefined
        ? cmsSettings.tiktokUrl
        : fallbackCms?.tiktokUrl || ''
    );
    setCmsSpecialOfferEnabled(
      cmsSettings?.specialOfferEnabled !== undefined
        ? Boolean(cmsSettings.specialOfferEnabled)
        : Boolean(fallbackCms?.specialOfferEnabled)
    );
    setCmsSpecialOfferBadgeAr(
      cmsSettings?.specialOfferBadgeAr !== undefined
        ? cmsSettings.specialOfferBadgeAr
        : fallbackCms?.specialOfferBadgeAr || ''
    );
    setCmsSpecialOfferBadgeEn(
      cmsSettings?.specialOfferBadgeEn !== undefined
        ? cmsSettings.specialOfferBadgeEn
        : fallbackCms?.specialOfferBadgeEn || ''
    );
    setCmsSpecialOfferTitleAr(
      cmsSettings?.specialOfferTitleAr !== undefined
        ? cmsSettings.specialOfferTitleAr
        : fallbackCms?.specialOfferTitleAr || ''
    );
    setCmsSpecialOfferTitleEn(
      cmsSettings?.specialOfferTitleEn !== undefined
        ? cmsSettings.specialOfferTitleEn
        : fallbackCms?.specialOfferTitleEn || ''
    );
    setCmsSpecialOfferDescAr(
      cmsSettings?.specialOfferDescAr !== undefined
        ? cmsSettings.specialOfferDescAr
        : fallbackCms?.specialOfferDescAr || ''
    );
    setCmsSpecialOfferDescEn(
      cmsSettings?.specialOfferDescEn !== undefined
        ? cmsSettings.specialOfferDescEn
        : fallbackCms?.specialOfferDescEn || ''
    );
    setCmsSaved(false);
  }, [adminBranch, cmsSettings]);

  // Gallery Form State
  const [gUrl, setGUrl] = useState('');
  const [gTitleAr, setGTitleAr] = useState('');
  const [gTitleEn, setGTitleEn] = useState('');
  const [gCategory, setGCategory] = useState<GalleryCategory>('food_drinks');
  const [gMediaType, setGMediaType] = useState<'image' | 'video'>('image');
  const [gAssignMenuId, setGAssignMenuId] = useState<string>('');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectAdminBranch = (nextBranch: BranchId) => {
    if (nextBranch === adminBranch) return;
    setEditingMenuId(null);
    setEditingShowId(null);
    setGAssignMenuId('');
    setQuickUploadMenuId(null);
    setUploadNotice(null);
    setMenuAdminSearch('');
    setReservationSearch('');
    setReservationStatusFilter('all');
    setMTitleAr('');
    setMTitleEn('');
    setMDescAr('');
    setSDayAr('');
    setSDayEn('');
    setSSingerAr('');
    setSNoteAr('');
    onChangeAdminBranch(nextBranch);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    unlockAudioContext();
    const ok = await onAdminLogin(email, password);
    if (ok) {
      setPassword('');
    }
  };

  // --- Protected Login Gate if not authenticated ---
  if (!adminAuthReady) {
    return (
      <section className="min-h-[82vh] py-16 bg-[#121212] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1E1E1E] border border-[#D4AF37]/50 p-8 shadow-2xl text-center space-y-4">
          <div className="w-12 h-12 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] mx-auto flex items-center justify-center animate-pulse">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-sm text-[#C9C1B1]">
            {lang === 'ar'
              ? 'جاري التحقق من صلاحيات الإدارة...'
              : 'Verifying administrator session...'}
          </p>
        </div>
      </section>
    );
  }

  if (!adminSession) {
    const isBlockedNonAdminAccount = Boolean(customer) || Boolean(firebaseNonAdminEmail);

    if (isBlockedNonAdminAccount) {
      return (
        <section className="min-h-[82vh] py-16 bg-[#121212] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-[#1E1E1E] border border-red-500/60 p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 bg-red-950/60 border border-red-500/70 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h1 className="font-display-serif text-xl sm:text-2xl font-bold text-[#F7F3E9]">
                {lang === 'ar' ? 'الوصول محظور' : 'Access Restricted'}
              </h1>
              <div className="p-4 bg-red-950/50 border border-red-500/40 text-red-200 text-sm font-bold leading-relaxed">
                عذراً، هذا الحساب لا يملك صلاحيات الإدارة
              </div>
              <p className="text-xs text-[#C9C1B1] leading-relaxed">
                {lang === 'ar'
                  ? 'لوحة التحكم متاحة فقط لحساب إدارة المطعم المعتمد. يرجى العودة للموقع أو تسجيل الخروج من حساب العميل أولاً.'
                  : 'The Admin Dashboard is restricted to the authorized restaurant administrator account only.'}
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={onExitAdmin}
                className="w-full py-3 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm transition-colors cursor-pointer"
              >
                {t.backToSite}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (customer && onLogoutCustomer) {
                    await onLogoutCustomer();
                  } else if (firebaseNonAdminEmail) {
                    await onAdminLogout();
                  }
                }}
                className="w-full py-2.5 bg-[#121212] border border-[#D4AF37]/35 hover:border-[#D4AF37] text-[#C9C1B1] hover:text-[#F7F3E9] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>
                  {lang === 'ar'
                    ? 'تسجيل الخروج من الحساب الحالي للدخول كمسؤول'
                    : 'Sign out current account to sign in as admin'}
                </span>
              </button>
            </div>
          </div>
        </section>
      );
    }

    return (
      <section className="min-h-[82vh] py-16 bg-[#121212] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#1E1E1E] border border-[#D4AF37] p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-bold text-[#F7F3E9]">
              {authT.adminLoginTitle}
            </h1>
            <p className="text-xs sm:text-sm text-[#C9C1B1] leading-relaxed">
              {authT.adminLoginSubtitle}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-bold text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#C9C1B1] mb-1.5">{authT.usernameLabel}</label>
              <input
                type="email"
                required
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={authT.usernamePlaceholder}
                className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#C9C1B1] mb-1.5">{authT.passwordLabel}</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] disabled:opacity-60 text-[#121212] font-bold text-sm transition-colors cursor-pointer"
            >
              {authLoading ? '...' : authT.adminLoginBtn}
            </button>
          </form>

          <div className="pt-3 border-t border-[#D4AF37]/20 text-center">
            <button
              type="button"
              onClick={onExitAdmin}
              className="text-xs text-[#C9C1B1] hover:text-[#D4AF37] cursor-pointer"
            >
              ← {t.backToSite}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Handle Menu File Upload (saved via /api/upload-image with Data URL fallback)
  const handleMenuFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMenuImage(true);
    try {
      const uploadedUrl = await uploadImageFile(file);
      setMImageUrl(uploadedUrl);
    } finally {
      setUploadingMenuImage(false);
      if (menuFileInputRef.current) {
        menuFileInputRef.current.value = '';
      }
    }
  };

  // Quick 1-click Photo Upload directly for an existing MenuItem card
  const handleQuickMenuPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = quickUploadMenuId;
    if (!file || !targetId) return;
    setUploadingMenuImage(true);
    try {
      const uploadedUrl = await uploadImageFile(file);
      onUpdateMenu(targetId, { imageUrl: uploadedUrl });
      if (editingMenuId === targetId) {
        setMImageUrl(uploadedUrl);
      }
      const targetItem = menu.find((item) => item.id === targetId);
      if (targetItem) {
        onAddPhoto({
          imageUrl: uploadedUrl,
          mediaType: 'image',
          titleAr: targetItem.titleAr,
          titleEn: targetItem.titleEn || targetItem.titleAr,
          category: 'food_drinks',
          source: 'uploaded',
        });
      }
    } finally {
      setUploadingMenuImage(false);
      setQuickUploadMenuId(null);
      if (quickMenuFileInputRef.current) {
        quickMenuFileInputRef.current.value = '';
      }
    }
  };

  // Menu Submit
  const handleMenuSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mTitleAr.trim()) return;
    if (editingMenuId) {
      onUpdateMenu(editingMenuId, {
        titleAr: mTitleAr,
        titleEn: mTitleEn || mTitleAr,
        descriptionAr: mDescAr,
        descriptionEn: mDescAr,
        category: mCategory,
        price: Number(mPrice),
        imageUrl: mImageUrl,
        available: mAvailable,
      });
      setEditingMenuId(null);
    } else {
      onAddMenu({
        titleAr: mTitleAr,
        titleEn: mTitleEn || mTitleAr,
        descriptionAr: mDescAr,
        descriptionEn: mDescAr,
        category: mCategory,
        price: Number(mPrice),
        imageUrl: mImageUrl,
        available: mAvailable,
        featured: false,
      });
    }
    setMTitleAr('');
    setMTitleEn('');
    setMDescAr('');
    setMPrice(250);
  };

  const startEditMenu = (item: MenuItem) => {
    setEditingMenuId(item.id);
    setMTitleAr(item.titleAr);
    setMTitleEn(item.titleEn);
    setMDescAr(item.descriptionAr);
    setMCategory(item.category);
    setMPrice(item.price);
    setMImageUrl(item.imageUrl);
    setMAvailable(item.available);
  };

  // Shows Submit
  const handleShowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sDayAr.trim() || !sSingerAr.trim()) return;
    if (editingShowId) {
      onUpdateShow(editingShowId, {
        dayAr: sDayAr,
        dayEn: sDayEn || sDayAr,
        singerAr: sSingerAr,
        singerEn: sSingerAr,
        tanouraTime: sTanouraTime,
        bandTime: sBandTime,
        noteAr: sNoteAr,
        noteEn: sNoteAr,
      });
      setEditingShowId(null);
    } else {
      onAddShow({
        dayAr: sDayAr,
        dayEn: sDayEn || sDayAr,
        singerAr: sSingerAr,
        singerEn: sSingerAr,
        tanouraTime: sTanouraTime,
        bandTime: sBandTime,
        noteAr: sNoteAr,
        noteEn: sNoteAr,
        imageUrl:
          'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=75',
        active: true,
      });
    }
    setSDayAr('');
    setSDayEn('');
    setSSingerAr('');
    setSNoteAr('');
  };

  const startEditShow = (s: ShowSchedule) => {
    setEditingShowId(s.id);
    setSDayAr(s.dayAr);
    setSDayEn(s.dayEn);
    setSSingerAr(s.singerAr);
    setSTanouraTime(s.tanouraTime);
    setSBandTime(s.bandTime);
    setSNoteAr(s.noteAr);
  };

  const showGalleryFeedback = (msg: string) => {
    setUploadNotice(msg);
    setTimeout(() => {
      setUploadNotice((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Direct Multi-File Upload from Mobile/Computer for Gallery (and optional direct MenuItem assignment)
  const handleGalleryFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploadingFiles(true);
    try {
      const newItems: Omit<GalleryPhoto, 'id'>[] = [];
      let firstUploadedImageUrl: string | null = null;
      const targetMenuItem = gAssignMenuId
        ? menu.find((m) => m.id === gAssignMenuId)
        : undefined;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const isVideo = file.type.startsWith('video/');
        const mediaUrl = isVideo ? await readFileAsDataUrl(file) : await uploadImageFile(file);
        if (!isVideo && !firstUploadedImageUrl) {
          firstUploadedImageUrl = mediaUrl;
        }
        const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
        newItems.push({
          imageUrl: isVideo ? PRESET_IMAGE_OPTIONS[9].url : mediaUrl,
          videoUrl: isVideo ? mediaUrl : undefined,
          mediaType: isVideo ? 'video' : 'image',
          titleAr:
            gTitleAr.trim() ||
            (targetMenuItem ? targetMenuItem.titleAr : '') ||
            cleanFileName ||
            'لقطة من صاحب السعادة',
          titleEn:
            gTitleEn.trim() ||
            (targetMenuItem ? targetMenuItem.titleEn : '') ||
            cleanFileName ||
            'Saheb El Saada Moment',
          category: isVideo ? 'videos' : targetMenuItem ? 'food_drinks' : gCategory,
          source: 'uploaded',
        });
      }

      onAddPhotosBulk(newItems);

      if (targetMenuItem && firstUploadedImageUrl) {
        onUpdateMenu(targetMenuItem.id, { imageUrl: firstUploadedImageUrl });
        const itemLabel = lang === 'ar' ? targetMenuItem.titleAr : targetMenuItem.titleEn || targetMenuItem.titleAr;
        showGalleryFeedback(`${t.galleryForm.assignedSuccessPrefix} ${itemLabel}`);
      } else {
        showGalleryFeedback(t.galleryForm.uploadSuccess);
      }

      setGTitleAr('');
      setGTitleEn('');
      setGAssignMenuId('');
      if (galleryFileInputRef.current) {
        galleryFileInputRef.current.value = '';
      }
    } finally {
      setUploadingFiles(false);
    }
  };

  // Assign an existing Gallery photo to a MenuItem
  const handleAssignGalleryPhotoToMenu = (photoUrl: string, menuItemId: string) => {
    if (!menuItemId) return;
    onUpdateMenu(menuItemId, { imageUrl: photoUrl });
    const targetItem = menu.find((m) => m.id === menuItemId);
    if (targetItem) {
      const itemLabel = lang === 'ar' ? targetItem.titleAr : targetItem.titleEn || targetItem.titleAr;
      showGalleryFeedback(`${t.galleryForm.assignedSuccessPrefix} ${itemLabel}`);
    }
  };

  // Gallery Direct URL Submit (Image or Video URL)
  const handleAddSingleMediaUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gUrl.trim()) return;
    const isVideoLink =
      gMediaType === 'video' ||
      gCategory === 'videos' ||
      /youtube\.com|youtu\.be|tiktok\.com|instagram\.com|\.mp4/i.test(gUrl);

    const trimmedUrl = gUrl.trim();
    const targetMenuItem =
      !isVideoLink && gAssignMenuId ? menu.find((m) => m.id === gAssignMenuId) : undefined;

    onAddPhoto({
      imageUrl:
        isVideoLink && !/\.(jpg|jpeg|png|webp)$/i.test(trimmedUrl)
          ? PRESET_IMAGE_OPTIONS[9].url
          : trimmedUrl,
      videoUrl: isVideoLink ? trimmedUrl : undefined,
      mediaType: isVideoLink ? 'video' : 'image',
      titleAr:
        gTitleAr.trim() ||
        (targetMenuItem ? targetMenuItem.titleAr : '') ||
        (isVideoLink ? 'فيديو من المطعم' : 'إضافة من لوحة الإدارة'),
      titleEn: gTitleEn.trim() || (targetMenuItem ? targetMenuItem.titleEn : '') || 'Saheb El Saada Media',
      category: isVideoLink ? 'videos' : targetMenuItem ? 'food_drinks' : gCategory,
      source: 'custom_url',
    });

    if (targetMenuItem) {
      onUpdateMenu(targetMenuItem.id, { imageUrl: trimmedUrl });
      const itemLabel = lang === 'ar' ? targetMenuItem.titleAr : targetMenuItem.titleEn || targetMenuItem.titleAr;
      showGalleryFeedback(`${t.galleryForm.assignedSuccessPrefix} ${itemLabel}`);
    } else {
      showGalleryFeedback(t.galleryForm.uploadSuccess);
    }

    setGUrl('');
    setGTitleAr('');
    setGTitleEn('');
    setGAssignMenuId('');
  };

  const handleBranchSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateBranchSettings({
      phone: bPhone.trim(),
      whatsappIntl: bWhatsappIntl.trim(),
      vodafoneCash: bVodafoneCash.trim(),
      instapay: bInstapay.trim(),
      addressAr: bAddressAr.trim(),
      addressEn: bAddressEn.trim(),
    });
    setBranchSettingsSaved(true);
    setTimeout(() => setBranchSettingsSaved(false), 3500);
  };

  const handleCmsSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCmsSettings({
      announcementEnabled: cmsAnnouncementEnabled,
      announcementTextAr: cmsAnnouncementAr.trim(),
      announcementTextEn: cmsAnnouncementEn.trim(),
      reservationNoteAr: cmsReservationNoteAr.trim(),
      reservationNoteEn: cmsReservationNoteEn.trim(),
      instagramUrl: cmsInstagramUrl.trim(),
      facebookUrl: cmsFacebookUrl.trim(),
      tiktokUrl: cmsTiktokUrl.trim(),
      specialOfferEnabled: cmsSpecialOfferEnabled,
      specialOfferBadgeAr: cmsSpecialOfferBadgeAr.trim(),
      specialOfferBadgeEn: cmsSpecialOfferBadgeEn.trim(),
      specialOfferTitleAr: cmsSpecialOfferTitleAr.trim(),
      specialOfferTitleEn: cmsSpecialOfferTitleEn.trim(),
      specialOfferDescAr: cmsSpecialOfferDescAr.trim(),
      specialOfferDescEn: cmsSpecialOfferDescEn.trim(),
    });
    setCmsSaved(true);
    setTimeout(() => setCmsSaved(false), 3500);
  };

  const filteredAdminMenu = menuAdminSearch.trim()
    ? menu.filter((item) => {
        const q = menuAdminSearch.trim().toLowerCase();
        return (
          item.titleAr.toLowerCase().includes(q) ||
          (item.titleEn || '').toLowerCase().includes(q) ||
          (item.prepNoteAr || '').toLowerCase().includes(q)
        );
      })
    : menu;

  const scopedOrders: Array<OnlineOrder & { branchId: BranchId }> = (
    orderBranchFilter === 'all'
      ? BRANCH_ORDER.flatMap((bId) =>
          (stores[bId]?.orders || []).map((o) => ({
            ...o,
            branchId: o.branchId || bId,
          }))
        )
      : (stores[orderBranchFilter]?.orders || []).map((o) => ({
          ...o,
          branchId: o.branchId || orderBranchFilter,
        }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const toLocalYmd = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  };

  const filteredOrders = scopedOrders.filter((o) => {
    if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;

    if (orderDateFrom || orderDateTo) {
      const orderYmd = toLocalYmd(o.createdAt);
      if (!orderYmd) return false;
      if (orderDateFrom && orderYmd < orderDateFrom) return false;
      if (orderDateTo && orderYmd > orderDateTo) return false;
    }

    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      (o.address || '').toLowerCase().includes(q) ||
      (o.notes || '').toLowerCase().includes(q) ||
      o.items.some(
        (item) =>
          item.titleAr.toLowerCase().includes(q) ||
          (item.titleEn || '').toLowerCase().includes(q)
      )
    );
  });

  const hasActiveOrderFilters =
    orderSearch.trim() !== '' ||
    orderDateFrom !== '' ||
    orderDateTo !== '' ||
    orderStatusFilter !== 'all' ||
    orderBranchFilter !== adminBranch;

  const filteredReservations = reservations.filter((r) => {
    const matchesStatus =
      reservationStatusFilter === 'all' || r.status === reservationStatusFilter;
    if (!matchesStatus) return false;
    const q = reservationSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.customerName.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  });

  const totalBookingsAndOrders = reservations.length + orders.length;
  const activeBranchLabel = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;
  const orderScopeLabel =
    orderBranchFilter === 'all'
      ? lang === 'ar'
        ? 'كل الفروع'
        : 'All Branches'
      : lang === 'ar'
      ? branchConfigs[orderBranchFilter].shortNameAr
      : branchConfigs[orderBranchFilter].shortNameEn;

  const unacknowledgedCancellations = BRANCH_ORDER.flatMap((bId) => {
    const bCfg = branchConfigs[bId];
    return stores[bId].orders
      .filter(
        (o) =>
          o.status === 'cancelled' &&
          o.cancelledBy === 'customer' &&
          !o.adminCancelAcknowledged
      )
      .map((order) => ({
        branchId: bId,
        branchName: lang === 'ar' ? bCfg.shortNameAr : bCfg.shortNameEn,
        order,
      }));
  });

  const activeBranchUnreadCancels = orders.filter(
    (o) =>
      o.status === 'cancelled' &&
      o.cancelledBy === 'customer' &&
      !o.adminCancelAcknowledged
  ).length;

  return (
    <section className="py-10 bg-[#121212] min-h-[85vh]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Top Admin Bar */}
        <div className="bg-[#1E1E1E] border border-[#D4AF37] p-6 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lang === 'ar'
                  ? `متصل كمدير النظام (${adminSession.adminUsername || 'admin'})`
                  : `Authenticated Owner (${adminSession.adminUsername || 'admin'})`}
              </span>
            </div>
            <h1 className="font-display-serif text-2xl sm:text-3xl font-bold text-[#D4AF37]">
              {t.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                unlockAudioContext();
                setOrderSoundEnabled((prev) => {
                  const next = !prev;
                  if (next) playOrderNotificationChime();
                  return next;
                });
              }}
              className={`px-3.5 py-2.5 border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                orderSoundEnabled
                  ? 'bg-[#10B981]/15 border-[#10B981]/60 text-[#10B981] hover:bg-[#10B981]/25'
                  : 'bg-[#121212] border-[#D4AF37]/30 text-[#9E9585] hover:text-[#F7F3E9]'
              }`}
            >
              {orderSoundEnabled ? (
                <Volume2 className="w-4 h-4 shrink-0" />
              ) : (
                <VolumeX className="w-4 h-4 shrink-0" />
              )}
              <span>
                {orderSoundEnabled
                  ? lang === 'ar'
                    ? 'صوت الطلبات: مفعّل'
                    : 'Order Alert: ON'
                  : lang === 'ar'
                  ? 'صوت الطلبات: صامت'
                  : 'Order Alert: Muted'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                unlockAudioContext();
                playOrderNotificationChime();
              }}
              className="px-3.5 py-2.5 bg-[#121212] hover:bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span>{lang === 'ar' ? 'اختبار الصوت' : 'Test Sound'}</span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="px-4 py-2.5 bg-[#121212] hover:bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-bold transition-colors cursor-pointer"
            >
              {t.backToSite}
            </button>

            <button
              type="button"
              onClick={onResetDefaults}
              className="px-4 py-2.5 bg-[#121212] hover:bg-red-950/60 text-[#C9C1B1] hover:text-red-300 border border-[#D4AF37]/30 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {lang === 'ar' ? `إعادة ضبط (${activeBranchLabel})` : `Reset (${activeBranchLabel})`}
              </span>
            </button>

            <button
              type="button"
              onClick={onAdminLogout}
              className="px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-500/40 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{authT.logoutBtn}</span>
            </button>
          </div>
        </div>

        {/* MASTER 3-BRANCH CONTROL SWITCHER */}
        <div className="bg-gradient-to-l from-[#1E1E1E] via-[#221D12] to-[#1E1E1E] border-2 border-[#D4AF37] p-4 sm:p-5 mb-6 space-y-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#D4AF37]/15 border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs text-[#C9C1B1] block">{t.managingNow}</span>
                <strong className="text-base sm:text-lg text-[#D4AF37] font-bold">
                  {lang === 'ar' ? branchConfig.nameAr : branchConfig.nameEn}
                </strong>
                <span className="block text-[11px] text-[#9E9585]">
                  {lang === 'ar' ? branchConfig.addressAr : branchConfig.addressEn} ·{' '}
                  <span dir="ltr" className="font-mono text-[#D4AF37]">
                    {branchConfig.phone}
                  </span>
                </span>
              </div>
            </div>

            {/* Quick Branch Selector Dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <label htmlFor="admin-branch-select" className="text-xs font-bold text-[#D4AF37] whitespace-nowrap">
                {t.managingNow}
              </label>
              <select
                id="admin-branch-select"
                value={adminBranch}
                onChange={(e) => handleSelectAdminBranch(e.target.value as BranchId)}
                className="px-3 py-2 bg-[#121212] border border-[#D4AF37] text-[#F7F3E9] text-xs sm:text-sm font-bold cursor-pointer"
              >
                {BRANCH_ORDER.map((bId) => {
                  const cfg = branchConfigs[bId];
                  return (
                    <option key={`admin-opt-${bId}`} value={bId} className="bg-[#121212] text-[#F7F3E9]">
                      {lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div
            role="group"
            aria-label={t.managingNow}
            className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          >
            {BRANCH_ORDER.map((bId) => {
              const cfg = branchConfigs[bId];
              const isSelected = adminBranch === bId;
              const bStore = stores[bId];
              const pendingTotal = bStore.orders.length + bStore.reservations.length;
              const branchUnreadCancels = bStore.orders.filter(
                (o) =>
                  o.status === 'cancelled' &&
                  o.cancelledBy === 'customer' &&
                  !o.adminCancelAcknowledged
              ).length;
              return (
                <button
                  key={bId}
                  type="button"
                  onClick={() => handleSelectAdminBranch(bId)}
                  className={`px-4 py-3 border text-right flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold shadow-lg'
                      : 'bg-[#121212] text-[#F7F3E9] border-[#D4AF37]/35 hover:border-[#D4AF37]'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block text-xs sm:text-sm font-bold truncate">
                      {lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn}
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        isSelected ? 'text-[#121212]/80' : 'text-[#9E9585]'
                      }`}
                    >
                      {cfg.phone} · {bStore.menu.length}{' '}
                      {lang === 'ar' ? 'صنف' : 'items'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {branchUnreadCancels > 0 && (
                      <span
                        title={t.bookings.customerCancelAlertTitle}
                        className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-mono font-bold flex items-center gap-1 animate-pulse"
                      >
                        <Bell className="w-3 h-3" />
                        <span>{branchUnreadCancels}</span>
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 text-[11px] font-mono shrink-0 ${
                        isSelected ? 'bg-[#121212] text-[#D4AF37]' : 'bg-[#D4AF37]/15 text-[#D4AF37]'
                      }`}
                    >
                      {pendingTotal}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* LIVE NEW ORDER AUDIO ALERT BANNER */}
        {incomingOrderAlerts.length > 0 && (
          <div
            role="status"
            className="bg-[#231D11] border-2 border-[#D4AF37] p-4 sm:p-5 mb-6 space-y-3 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/30 pb-2.5">
              <div className="flex items-center gap-2.5 text-[#D4AF37]">
                <span className="p-2 bg-[#D4AF37] text-[#121212] shrink-0 animate-pulse">
                  <Bell className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-[#F7F3E9]">
                    {lang === 'ar'
                      ? `طلب جديد وارد (${incomingOrderAlerts.length})`
                      : `New Incoming Order (${incomingOrderAlerts.length})`}
                  </h2>
                  <p className="text-xs text-[#C9C1B1]">
                    {lang === 'ar'
                      ? 'تم تشغيل التنبيه الصوتي فور استلام الطلب'
                      : 'Audio chime triggered upon order receipt'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncomingOrderAlerts([])}
                className="px-3 py-1.5 bg-[#121212] border border-[#D4AF37]/40 text-xs font-bold text-[#C9C1B1] hover:text-[#F7F3E9] cursor-pointer"
              >
                {lang === 'ar' ? 'إخفاء التنبيه' : 'Dismiss'}
              </button>
            </div>
            <div className="space-y-2">
              {incomingOrderAlerts.map(({ branchId, order }) => {
                const cfg = branchConfigs[branchId];
                return (
                  <div
                    key={`new-ord-${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 bg-[#121212]/90 border border-[#D4AF37]/30 px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#D4AF37] text-[#121212] font-mono font-bold">
                        {order.id}
                      </span>
                      <span className="font-bold text-[#F7F3E9]">{order.customerName}</span>
                      <span className="text-[#D4AF37] font-bold">
                        {lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn}
                      </span>
                      <span className="text-[#10B981] font-mono font-bold">
                        {order.totalAmount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (branchId !== adminBranch) {
                          handleSelectAdminBranch(branchId);
                        }
                        setActiveTab('bookings');
                        setIncomingOrderAlerts((prev) =>
                          prev.filter((item) => item.order.id !== order.id)
                        );
                      }}
                      className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض الطلب' : 'View Order'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REAL-TIME CUSTOMER CANCELLATION RED ALERT BANNER / TOAST */}
        {liveCancelledAlerts.length > 0 && (
          <div
            role="alert"
            className="bg-red-950/85 border-2 border-red-500 p-4 sm:p-5 mb-6 space-y-3 shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/40 pb-2.5">
              <div className="flex items-center gap-2.5 text-red-100">
                <span className="p-2 bg-red-600 text-white shrink-0 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    {liveCancelledAlerts.length === 1
                      ? `تنبيه: قام العميل بإلغاء الطلب رقم ${liveCancelledAlerts[0].order.id}`
                      : `تنبيه: قام العملاء بإلغاء ${liveCancelledAlerts.length} طلبات`}
                  </h2>
                  <p className="text-xs text-red-200/90">
                    {lang === 'ar'
                      ? 'تم تشغيل نغمة التحذير الفورية لإلغاء الطلب'
                      : 'Real-time order cancellation warning alert triggered'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  liveCancelledAlerts.forEach(({ branchId, order }) => {
                    onAcknowledgeOrderCancellation?.(branchId, order.id);
                  });
                  setLiveCancelledAlerts([]);
                }}
                className="px-3 py-1.5 bg-[#121212] border border-red-400/50 text-xs font-bold text-red-200 hover:bg-red-600 hover:text-white cursor-pointer inline-flex items-center gap-1.5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'إغلاق الكل' : 'Dismiss All'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {liveCancelledAlerts.map(({ branchId, order }) => {
                const cfg = branchConfigs[branchId] || branchConfig;
                const branchTitle = lang === 'ar' ? cfg.shortNameAr : cfg.shortNameEn;
                return (
                  <div
                    key={`live-cancel-${order.firestoreDocId || order.id}`}
                    className="bg-[#121212]/90 border border-red-500/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <p className="font-bold text-red-200 text-sm">
                        تنبيه: قام العميل بإلغاء الطلب رقم {order.id}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-600 text-white font-bold text-[11px]">
                          ملغي من العميل
                        </span>
                        <span className="px-2 py-0.5 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-[11px]">
                          {branchTitle}
                        </span>
                        <span className="font-bold text-[#F7F3E9]">{order.customerName}</span>
                        <span dir="ltr" className="font-mono text-[#C9C1B1]">
                          {order.phone}
                        </span>
                        <span className="font-bold text-[#D4AF37]">
                          {order.totalAmount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (branchId !== adminBranch) {
                            handleSelectAdminBranch(branchId);
                          }
                          setActiveTab('bookings');
                          onAcknowledgeOrderCancellation?.(branchId, order.id);
                          setLiveCancelledAlerts((prev) =>
                            prev.filter((item) => item.order.id !== order.id)
                          );
                        }}
                        className="px-3 py-1.5 bg-[#1E1E1E] hover:bg-[#D4AF37] hover:text-[#121212] border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold cursor-pointer transition-colors"
                      >
                        {t.bookings.goToOrderBtn}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onAcknowledgeOrderCancellation?.(branchId, order.id);
                          setLiveCancelledAlerts((prev) =>
                            prev.filter((item) => item.order.id !== order.id)
                          );
                        }}
                        aria-label={lang === 'ar' ? 'إغلاق التنبيه' : 'Dismiss alert'}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إغلاق' : 'Dismiss'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CUSTOMER ORDER CANCELLATION MANAGEMENT ALERTS (Unacknowledged historical cancellations) */}
        {unacknowledgedCancellations.filter(
          ({ order }) =>
            !liveCancelledAlerts.some(
              (live) => (live.order.firestoreDocId || live.order.id) === (order.firestoreDocId || order.id)
            )
        ).length > 0 && (
          <div
            role="alert"
            className="bg-red-950/50 border-2 border-red-500 p-4 sm:p-5 mb-6 space-y-3 shadow-xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/35 pb-2.5">
              <div className="flex items-center gap-2.5 text-red-200">
                <span className="p-2 bg-red-600 text-white shrink-0 animate-pulse">
                  <Bell className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-red-100">
                    {t.bookings.customerCancelAlertTitle} (
                    {
                      unacknowledgedCancellations.filter(
                        ({ order }) =>
                          !liveCancelledAlerts.some(
                            (live) =>
                              (live.order.firestoreDocId || live.order.id) ===
                              (order.firestoreDocId || order.id)
                          )
                      ).length
                    }
                    )
                  </h2>
                  <p className="text-xs text-red-200/80">
                    {t.bookings.customerCancelAlertDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {unacknowledgedCancellations
                .filter(
                  ({ order }) =>
                    !liveCancelledAlerts.some(
                      (live) =>
                        (live.order.firestoreDocId || live.order.id) ===
                        (order.firestoreDocId || order.id)
                    )
                )
                .map(({ branchId, branchName, order }) => (
                <div
                  key={`cancel-alert-${order.id}`}
                  className="bg-[#121212]/90 border border-red-500/45 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-red-200">
                      تنبيه: قام العميل بإلغاء الطلب رقم {order.id}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-600 text-white font-mono font-bold text-[11px]">
                        #{order.id}
                      </span>
                      <span className="px-2 py-0.5 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#D4AF37] font-bold text-[11px]">
                        {branchName}
                      </span>
                      <span className="font-bold text-[#F7F3E9]">{order.customerName}</span>
                      <span dir="ltr" className="font-mono text-[#C9C1B1]">
                        {order.phone}
                      </span>
                      <span className="font-bold text-[#D4AF37]">
                        {order.totalAmount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                      </span>
                    </div>
                    {order.cancellationReason && (
                      <p className="text-[11px] text-red-200">
                        {lang === 'ar' ? 'السبب:' : 'Reason:'} {order.cancellationReason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (branchId !== adminBranch) {
                          handleSelectAdminBranch(branchId);
                        }
                        setActiveTab('bookings');
                      }}
                      className="px-3 py-1.5 bg-[#1E1E1E] hover:bg-[#D4AF37] hover:text-[#121212] border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold cursor-pointer transition-colors"
                    >
                      {t.bookings.goToOrderBtn}
                    </button>
                    {onAcknowledgeOrderCancellation && (
                      <button
                        type="button"
                        onClick={() => onAcknowledgeOrderCancellation(branchId, order.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.bookings.acknowledgeCancelBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs (8 Tabs including Revenue & Menu Analytics) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Utensils className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.menu}</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">{menu.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gallery')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'gallery'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.gallery}</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">{gallery.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('shows')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'shows'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.shows}</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">{shows.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bookings')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.bookings}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {activeBranchUnreadCancels > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white font-mono font-bold animate-pulse">
                  !{activeBranchUnreadCancels}
                </span>
              )}
              <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">
                {totalBookingsAndOrders}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.analytics}</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">
              {orders.filter((o) => o.status !== 'cancelled').length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reviews')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'reviews'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">إدارة التقييمات</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-black/20 font-mono">{reviews.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.qr}</span>
            </div>
            <Download className="w-3.5 h-3.5 opacity-70 shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`p-4 border text-right flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                : 'bg-[#1E1E1E] text-[#F7F3E9] border-[#D4AF37]/25 hover:border-[#D4AF37]'
            }`}
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span className="text-xs sm:text-sm">{t.tabs.security}</span>
            </div>
            <Lock className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>

        {/* TAB 1: MENU MANAGER */}
        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <form
              onSubmit={handleMenuSubmit}
              className="lg:col-span-4 bg-[#1E1E1E] border border-[#D4AF37]/40 p-6 space-y-4 h-fit"
            >
              <h3 className="font-bold text-lg text-[#D4AF37] border-b border-[#D4AF37]/20 pb-3">
                {editingMenuId ? t.menuForm.editTitle : t.menuForm.addTitle}
              </h3>

              <div>
                <label className="block text-xs text-[#C9C1B1] mb-1">
                  {t.menuForm.titleAr} *
                </label>
                <input
                  type="text"
                  required
                  value={mTitleAr}
                  onChange={(e) => setMTitleAr(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-[#C9C1B1] mb-1">{t.menuForm.titleEn}</label>
                <input
                  type="text"
                  value={mTitleEn}
                  onChange={(e) => setMTitleEn(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">
                    {t.menuForm.category}
                  </label>
                  <select
                    value={mCategory}
                    onChange={(e) => setMCategory(e.target.value as MenuCategory)}
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                  >
                    <option value="mains">أطباق رئيسية</option>
                    <option value="appetizers">مقبلات</option>
                    <option value="drinks_desserts">مشروبات وحلويات</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">{t.menuForm.price}</label>
                  <input
                    type="number"
                    required
                    value={mPrice}
                    onChange={(e) => setMPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                  />
                </div>
              </div>

              {/* Upload Dish Image from Device, Pick from Gallery, or Paste Optional URL */}
              <div className="space-y-3 bg-[#121212] border border-[#D4AF37]/30 p-3.5">
                <div className="flex items-center gap-3">
                  <ResilientImage
                    src={mImageUrl}
                    alt={mTitleAr || 'Dish preview'}
                    className="w-16 h-16 object-cover border border-[#D4AF37]/50 shrink-0 bg-[#1E1E1E]"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="block text-xs font-bold text-[#D4AF37]">
                      {t.menuForm.uploadDishImageBtn}
                    </label>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] text-xs font-bold cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingMenuImage
                          ? lang === 'ar'
                            ? 'جاري الرفع...'
                            : 'Uploading...'
                          : lang === 'ar'
                          ? 'اختيار صورة من الجهاز'
                          : 'Choose Image File'}
                      </span>
                      <input
                        ref={menuFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleMenuFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">
                    {t.menuForm.chooseFromGallery}
                  </label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) setMImageUrl(e.target.value);
                    }}
                    className="w-full px-2.5 py-2 bg-[#1E1E1E] border border-[#D4AF37]/30 text-xs text-[#D4AF37]"
                    value=""
                  >
                    <option value="" disabled>
                      {lang === 'ar'
                        ? '-- اختر من صور المعرض أو الأرشيف --'
                        : '-- Select from Gallery or Presets --'}
                    </option>
                    {gallery
                      .filter((g) => g.mediaType !== 'video' && g.category !== 'videos')
                      .map((g) => (
                        <option key={`gal-${g.id}`} value={g.imageUrl} className="bg-[#1E1E1E] text-[#F7F3E9]">
                          {lang === 'ar' ? `🖼 المعرض: ${g.titleAr}` : `🖼 Gallery: ${g.titleEn || g.titleAr}`}
                        </option>
                      ))}
                    {PRESET_IMAGE_OPTIONS.map((p) => (
                      <option key={p.id} value={p.url} className="bg-[#1E1E1E] text-[#F7F3E9]">
                        {p.labelAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#9E9585] mb-1">
                    {t.menuForm.presetImage}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={mImageUrl}
                    onChange={(e) => setMImageUrl(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#1E1E1E] border border-[#D4AF37]/30 text-[#F7F3E9] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#C9C1B1] mb-1">{t.menuForm.descAr}</label>
                <textarea
                  rows={2}
                  value={mDescAr}
                  onChange={(e) => setMDescAr(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#D4AF37] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.menuForm.save}</span>
                </button>
                {editingMenuId && (
                  <button
                    type="button"
                    onClick={() => setEditingMenuId(null)}
                    className="px-4 py-3 bg-[#121212] border border-[#D4AF37]/40 text-[#C9C1B1] text-xs cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Hidden input for 1-click per-item photo upload */}
            <input
              ref={quickMenuFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleQuickMenuPhotoChange}
              className="hidden"
            />

            {/* Menu Items List with Search Filter */}
            <div className="lg:col-span-8 space-y-4 h-fit">
              <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                      lang === 'ar' ? 'right-3' : 'left-3'
                    }`}
                  />
                  <input
                    type="search"
                    value={menuAdminSearch}
                    onChange={(e) => setMenuAdminSearch(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'ابحث في أصناف الفرع لتعديل السعر أو الصورة...'
                        : 'Search branch items to edit price or photo...'
                    }
                    className={`w-full py-2 bg-[#121212] border border-[#D4AF37]/30 text-[#F7F3E9] text-xs focus:outline-none focus:border-[#D4AF37] ${
                      lang === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>
                <span className="text-xs font-mono text-[#D4AF37]">
                  {filteredAdminMenu.length} / {menu.length} {lang === 'ar' ? 'صنف' : 'items'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[680px] overflow-y-auto pr-1">
                {filteredAdminMenu.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-4 flex gap-3.5 items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <ResilientImage
                        src={item.imageUrl}
                        alt={item.titleAr}
                        className="w-16 h-16 object-cover border border-[#D4AF37]/40 shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#F7F3E9] text-sm truncate">{item.titleAr}</h4>
                        <span className="text-[#D4AF37] font-bold text-xs tabular-nums block mt-0.5">
                          {item.price} {fullT.menu.currency}
                        </span>
                        <span className="text-[11px] text-[#9E9585] truncate block">
                          {item.prepNoteAr || fullT.menu.categories[item.category]}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        title={t.menuForm.quickChangePhoto}
                        onClick={() => {
                          setQuickUploadMenuId(item.id);
                          quickMenuFileInputRef.current?.click();
                        }}
                        className="p-2 bg-[#121212] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditMenu(item)}
                        className="p-2 bg-[#121212] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#121212] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMenu(item.id)}
                        className="p-2 bg-[#121212] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GALLERY, MENU PHOTO UPLOAD & ASSIGNMENT MANAGER */}
        {activeTab === 'gallery' && (
          <div className="space-y-8">
            {uploadNotice && (
              <div className="p-3.5 bg-[#10B981]/20 border border-[#10B981] text-[#10B981] text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{uploadNotice}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Method 1: Direct File Upload from Device + Optional Direct MenuItem Assignment */}
              <div className="bg-[#1E1E1E] border-2 border-[#D4AF37] p-6 space-y-4">
                <div className="flex items-center gap-2.5 text-[#D4AF37]">
                  <Upload className="w-5 h-5" />
                  <h3 className="font-bold text-lg">{t.galleryForm.uploadFilesTitle}</h3>
                </div>
                <p className="text-xs text-[#C9C1B1] leading-relaxed">
                  {t.galleryForm.uploadFilesHint}
                </p>

                {/* Assign directly to a MenuItem */}
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-1.5">
                    {t.galleryForm.assignToMenuLabel}
                  </label>
                  <select
                    value={gAssignMenuId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setGAssignMenuId(nextId);
                      if (nextId) {
                        setGCategory('food_drinks');
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-[#121212] border border-[#D4AF37]/50 text-[#F7F3E9] text-xs font-semibold"
                  >
                    <option value="" className="bg-[#121212] text-[#C9C1B1]">
                      {t.galleryForm.galleryOnlyOption}
                    </option>
                    {menu.map((item) => (
                      <option
                        key={`assign-opt-${item.id}`}
                        value={item.id}
                        className="bg-[#121212] text-[#F7F3E9]"
                      >
                        {lang === 'ar'
                          ? `${item.titleAr} (${item.price} ${fullT.menu.currency})`
                          : `${item.titleEn || item.titleAr} (${item.price} ${fullT.menu.currency})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">
                      {t.galleryForm.titleAr}
                    </label>
                    <input
                      type="text"
                      value={gTitleAr}
                      onChange={(e) => setGTitleAr(e.target.value)}
                      placeholder={lang === 'ar' ? 'مثال: مشويات / عشاء عائلي' : 'e.g. Mixed Grill'}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">
                      {t.galleryForm.category}
                    </label>
                    <select
                      value={gCategory}
                      onChange={(e) => setGCategory(e.target.value as GalleryCategory)}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                    >
                      <option value="food_drinks">الأطعمة والمشروبات</option>
                      <option value="ambience_stage">الأجواء والضيافة</option>
                      <option value="videos">فيديوهات المطعم</option>
                    </select>
                  </div>
                </div>

                <label className="block border-2 border-dashed border-[#D4AF37]/60 hover:border-[#D4AF37] bg-[#121212] p-6 text-center cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-[#D4AF37] mx-auto mb-2" />
                  <span className="text-sm font-bold text-[#F7F3E9] block">
                    {uploadingFiles
                      ? lang === 'ar'
                        ? 'جاري رفع وحفظ الملفات...'
                        : 'Uploading & saving files...'
                      : t.galleryForm.selectFilesBtn}
                  </span>
                  <span className="text-[11px] text-[#9E9585] block mt-1">
                    JPG, PNG, WEBP, MP4, MOV
                  </span>
                  <input
                    ref={galleryFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={handleGalleryFilesUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Method 2: Optional Direct URL for Photo or Video */}
              <form
                onSubmit={handleAddSingleMediaUrl}
                className="bg-[#1E1E1E] border border-[#D4AF37]/40 p-6 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 text-[#D4AF37]">
                    <LinkIcon className="w-5 h-5" />
                    <h3 className="font-bold text-lg">{t.galleryForm.urlAdderTitle}</h3>
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">
                      {t.galleryForm.imageUrlsLabel} *
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      value={gUrl}
                      onChange={(e) => setGUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">
                        {t.galleryForm.mediaTypeLabel}
                      </label>
                      <select
                        value={gMediaType}
                        onChange={(e) => setGMediaType(e.target.value as 'image' | 'video')}
                        className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                      >
                        <option value="image">{t.galleryForm.mediaTypeImage}</option>
                        <option value="video">{t.galleryForm.mediaTypeVideo}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">
                        {t.galleryForm.category}
                      </label>
                      <select
                        value={gCategory}
                        onChange={(e) => setGCategory(e.target.value as GalleryCategory)}
                        className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                      >
                        <option value="food_drinks">الأطعمة والمشروبات</option>
                        <option value="ambience_stage">الأجواء والمسرح</option>
                        <option value="videos">فيديوهات السهرات</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">
                        {t.galleryForm.titleAr}
                      </label>
                      <input
                        type="text"
                        value={gTitleAr}
                        onChange={(e) => setGTitleAr(e.target.value)}
                        placeholder={lang === 'ar' ? 'وصف الصورة أو الفيديو' : 'Title'}
                        className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#D4AF37] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.galleryForm.addUrlsBtn}</span>
                </button>
              </form>
            </div>

            {/* Gallery Photos & Videos Grid with MenuItem Photo Assignment & One-Click Delete */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gallery.map((photo) => {
                const isVideo = photo.mediaType === 'video' || photo.category === 'videos';
                const assignedMenuItems = isVideo
                  ? []
                  : menu.filter((m) => m.imageUrl === photo.imageUrl);

                return (
                  <div
                    key={photo.id}
                    className="group bg-[#1E1E1E] border border-[#D4AF37]/30 overflow-hidden flex flex-col justify-between"
                  >
                    <div className="relative h-44 bg-[#121212] overflow-hidden">
                      <ResilientImage
                        src={photo.imageUrl}
                        alt={photo.titleAr}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                      {isVideo && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#D4AF37] text-[#121212] text-[10px] font-bold flex items-center gap-1">
                          <Film className="w-3 h-3" />
                          <span>VIDEO</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeletePhoto(photo.id)}
                        title={lang === 'ar' ? 'حذف بضغطة واحدة' : 'Delete with one click'}
                        className="absolute top-2 left-2 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'حذف' : 'Delete'}</span>
                      </button>
                      <div className="absolute bottom-2 inset-x-2.5">
                        <p className="text-xs font-bold text-[#F7F3E9] truncate">{photo.titleAr}</p>
                        <span className="text-[10px] text-[#D4AF37]">{photo.category}</span>
                      </div>
                    </div>

                    {/* Assign Photo Directly to MenuItem */}
                    {!isVideo && (
                      <div className="p-2.5 bg-[#121212] border-t border-[#D4AF37]/20 space-y-2">
                        {assignedMenuItems.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {assignedMenuItems.map((m) => (
                              <span
                                key={`badge-${photo.id}-${m.id}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[10px] font-bold max-w-full truncate"
                              >
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  {t.galleryForm.assignedBadgePrefix}{' '}
                                  {lang === 'ar' ? m.titleAr : m.titleEn || m.titleAr}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        <div>
                          <label className="block text-[10px] text-[#9E9585] mb-1">
                            {t.galleryForm.assignCardLabel}
                          </label>
                          <select
                            value=""
                            onChange={(e) => handleAssignGalleryPhotoToMenu(photo.imageUrl, e.target.value)}
                            aria-label={t.galleryForm.assignCardLabel}
                            className="w-full px-2 py-1.5 bg-[#1E1E1E] border border-[#D4AF37]/35 hover:border-[#D4AF37] text-[#F7F3E9] text-[11px] font-semibold cursor-pointer"
                          >
                            <option value="" disabled className="bg-[#1E1E1E] text-[#9E9585]">
                              {t.galleryForm.chooseMenuItemOption}
                            </option>
                            {menu.map((m) => (
                              <option
                                key={`card-assign-${photo.id}-${m.id}`}
                                value={m.id}
                                className="bg-[#1E1E1E] text-[#F7F3E9]"
                              >
                                {lang === 'ar' ? m.titleAr : m.titleEn || m.titleAr}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: ANNOUNCEMENTS & SPECIAL EVENTS CMS */}
        {activeTab === 'shows' && (
          <div className="space-y-8">
            {/* CMS Top Announcement Banner & Reservation Notes Editor */}
            <form
              onSubmit={handleCmsSettingsSubmit}
              className="bg-[#1E1E1E] border border-[#D4AF37]/45 p-6 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D4AF37]/20 pb-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#121212] border border-[#D4AF37]/60 text-[#D4AF37] flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[#D4AF37]">
                      {lang === 'ar'
                        ? 'إدارة التنويهات والعروض الخاصة (Announcements / Special Events)'
                        : 'Announcements & Special Events Management'}
                    </h3>
                    <p className="text-xs text-[#C9C1B1] mt-0.5">
                      {lang === 'ar'
                        ? `تحكم كامل في الشريط العلوي للموقع وتنويهات نافذة حجز الطاولات لفرع (${activeBranchLabel}).`
                        : `Manage the top announcement banner and table booking notices for (${activeBranchLabel}).`}
                    </p>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/40 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={cmsAnnouncementEnabled}
                    onChange={(e) => setCmsAnnouncementEnabled(e.target.checked)}
                    className="accent-[#D4AF37] w-4 h-4"
                  />
                  <span className="text-xs font-bold text-[#F7F3E9]">
                    {lang === 'ar' ? 'تفعيل شريط التنويه العلوي' : 'Enable Top Announcement Banner'}
                  </span>
                </label>
              </div>

              {cmsSaved && (
                <div className="p-3 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `تم حفظ التنويهات وإعدادات الحجز لـ ${activeBranchLabel} بنجاح.`
                      : `Announcements and booking notes saved for ${activeBranchLabel}.`}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar' ? 'نص شريط التنويه العلوي (عربي)' : 'Top Banner Text (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={cmsAnnouncementAr}
                    onChange={(e) => setCmsAnnouncementAr(e.target.value)}
                    placeholder="مثال: خصم خاص على صواني المشويات العائلية طوال الأسبوع"
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar' ? 'نص شريط التنويه العلوي (إنجليزي)' : 'Top Banner Text (English)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={cmsAnnouncementEn}
                    onChange={(e) => setCmsAnnouncementEn(e.target.value)}
                    placeholder="e.g. Special family grill platters available daily"
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar'
                      ? 'تنويه خاص داخل نافذة حجز الطاولات (عربي)'
                      : 'Table Reservation Modal Note (Arabic)'}
                  </label>
                  <textarea
                    rows={2}
                    value={cmsReservationNoteAr}
                    onChange={(e) => setCmsReservationNoteAr(e.target.value)}
                    placeholder="مثال: تتوفر صالات عائلية ومناطق جلوس خارجية طوال اليوم — للحجوزات الكبيرة يُفضل الحجز المسبق"
                    className="w-full px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar'
                      ? 'تنويه خاص داخل نافذة حجز الطاولات (إنجليزي)'
                      : 'Table Reservation Modal Note (English)'}
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={cmsReservationNoteEn}
                    onChange={(e) => setCmsReservationNoteEn(e.target.value)}
                    placeholder="e.g. Family halls and outdoor terrace seating available daily"
                    className="w-full px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="border-t border-[#D4AF37]/20 pt-5 space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-[#D4AF37]">
                    {lang === 'ar'
                      ? `روابط السوشيال ميديا لفرع (${activeBranchLabel}) في الفوتر`
                      : `Footer Social Media Links (${activeBranchLabel})`}
                  </h4>
                  <p className="text-xs text-[#A89E92] mt-0.5">
                    {lang === 'ar'
                      ? 'تظهر هذه الروابط تلقائياً في أسفل الموقع (Footer) عند تصفح هذا الفرع. اترك أي حقل فارغاً لإخفاء أيقونته.'
                      : 'Displayed in the website footer when viewing this branch. Leave any field empty to hide its icon.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'رابط إنستغرام (Instagram)' : 'Instagram URL'}
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={cmsInstagramUrl}
                      onChange={(e) => setCmsInstagramUrl(e.target.value)}
                      placeholder="https://www.instagram.com/saheb.el.saada/"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'رابط فيسبوك (Facebook)' : 'Facebook URL'}
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={cmsFacebookUrl}
                      onChange={(e) => setCmsFacebookUrl(e.target.value)}
                      placeholder="https://www.facebook.com/Saheb.El.Saada.Restaurant.Cafe"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'رابط تيك توك (TikTok)' : 'TikTok URL'}
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      value={cmsTiktokUrl}
                      onChange={(e) => setCmsTiktokUrl(e.target.value)}
                      placeholder="https://www.tiktok.com/@sahebalsaadaa?_t=zs-8yztepwjvxw&_r=1"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              {/* Menu Special Offers Banner Toggle & Content */}
              <div className="border-t border-[#D4AF37]/20 pt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-[#D4AF37] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? `بنر العروض الخاصة والموسمية أعلى المنيو — (${activeBranchLabel})`
                          : `Special Offers Banner (Top of Menu) — ${activeBranchLabel}`}
                      </span>
                    </h4>
                    <p className="text-xs text-[#A89E92] mt-0.5">
                      {lang === 'ar'
                        ? 'يظهر هذا البنر الترويجي في بداية قسم القائمة الرقمية لإبراز العروض الموسمية أو القوائم الخاصة.'
                        : 'Displays a highlighted seasonal promotion banner at the top of the digital menu section.'}
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/40 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={cmsSpecialOfferEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCmsSpecialOfferEnabled(checked);
                        onUpdateCmsSettings({ specialOfferEnabled: checked });
                      }}
                      className="accent-[#D4AF37] w-4 h-4"
                    />
                    <span className="text-xs font-bold text-[#F7F3E9]">
                      {lang === 'ar' ? 'تفعيل بنر العروض الخاصة' : 'Enable Special Offers Banner'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'شارة العرض (عربي)' : 'Offer Badge (Arabic)'}
                    </label>
                    <input
                      type="text"
                      value={cmsSpecialOfferBadgeAr}
                      onChange={(e) => setCmsSpecialOfferBadgeAr(e.target.value)}
                      placeholder="عرض الموسم — التجمع الخامس"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'شارة العرض (إنجليزي)' : 'Offer Badge (English)'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cmsSpecialOfferBadgeEn}
                      onChange={(e) => setCmsSpecialOfferBadgeEn(e.target.value)}
                      placeholder="Seasonal Special"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'عنوان العرض الخاص (عربي)' : 'Special Offer Title (Arabic)'}
                    </label>
                    <input
                      type="text"
                      value={cmsSpecialOfferTitleAr}
                      onChange={(e) => setCmsSpecialOfferTitleAr(e.target.value)}
                      placeholder="ولائم المشويات التراثية والطواجن الفخارية"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'عنوان العرض الخاص (إنجليزي)' : 'Special Offer Title (English)'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={cmsSpecialOfferTitleEn}
                      onChange={(e) => setCmsSpecialOfferTitleEn(e.target.value)}
                      placeholder="Heritage Charcoal Grill Platters & Clay-Pot Feasts"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'تفاصيل العرض (عربي)' : 'Offer Details (Arabic)'}
                    </label>
                    <textarea
                      rows={2}
                      value={cmsSpecialOfferDescAr}
                      onChange={(e) => setCmsSpecialOfferDescAr(e.target.value)}
                      placeholder="تشكيلة موسمية مختارة تُحضَّر طازجة يومياً..."
                      className="w-full px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'تفاصيل العرض (إنجليزي)' : 'Offer Details (English)'}
                    </label>
                    <textarea
                      rows={2}
                      dir="ltr"
                      value={cmsSpecialOfferDescEn}
                      onChange={(e) => setCmsSpecialOfferDescEn(e.target.value)}
                      placeholder="Curated seasonal dishes freshly prepared daily..."
                      className="w-full px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-xs sm:text-sm cursor-pointer transition-colors"
                >
                  {lang === 'ar' ? 'حفظ التنويهات والعروض العامة' : 'Save Announcement Settings'}
                </button>
              </div>
            </form>

            {/* Special Offers / Announcements Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <form
                onSubmit={handleShowSubmit}
                className="lg:col-span-4 bg-[#1E1E1E] border border-[#D4AF37]/40 p-6 space-y-4 h-fit"
              >
                <h3 className="font-bold text-lg text-[#D4AF37] border-b border-[#D4AF37]/20 pb-3">
                  {t.showsForm.title}
                </h3>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">
                    {t.showsForm.dayAr} *
                  </label>
                  <input
                    type="text"
                    required
                    value={sDayAr}
                    onChange={(e) => setSDayAr(e.target.value)}
                    placeholder="مثال: طوال الأسبوع / الخميس والجمعة"
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">
                    {t.showsForm.singerAr} *
                  </label>
                  <input
                    type="text"
                    required
                    value={sSingerAr}
                    onChange={(e) => setSSingerAr(e.target.value)}
                    placeholder="مثال: عرض المشويات العائلية أو مناسبة خاصة"
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">
                      {t.showsForm.tanouraTime}
                    </label>
                    <input
                      type="text"
                      value={sTanouraTime}
                      onChange={(e) => setSTanouraTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">
                      {t.showsForm.bandTime}
                    </label>
                    <input
                      type="text"
                      value={sBandTime}
                      onChange={(e) => setSBandTime(e.target.value)}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1">{t.showsForm.noteAr}</label>
                  <textarea
                    rows={2}
                    value={sNoteAr}
                    onChange={(e) => setSNoteAr(e.target.value)}
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#D4AF37] text-[#121212] font-bold text-sm cursor-pointer"
                >
                  {t.showsForm.save}
                </button>
              </form>

              <div className="lg:col-span-8 space-y-4">
                {shows.map((s) => (
                  <div
                    key={s.id}
                    className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-xs text-[#D4AF37] font-bold">{s.dayAr}</span>
                      <h4 className="font-bold text-lg text-[#F7F3E9]">{s.singerAr}</h4>
                      <p className="text-xs text-[#C9C1B1] mt-1">
                        {s.tanouraTime} — {s.bandTime}
                      </p>
                      {s.noteAr && <p className="text-xs text-[#9E9585] mt-1">{s.noteAr}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditShow(s)}
                        className="p-2 bg-[#121212] border border-[#D4AF37]/40 text-[#D4AF37] cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteShow(s.id)}
                        className="p-2 bg-[#121212] border border-red-500/40 text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: BOOKINGS & ORDERS MANAGER (ISOLATED PER BRANCH) */}
        {activeTab === 'bookings' && (
          <div className="space-y-8">
            {/* Online Orders Section */}
            <div className="space-y-4">
              <div className="border-b border-[#D4AF37]/25 pb-2.5 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-bold text-lg text-[#D4AF37]">
                    {t.bookings.ordersTitle} — {orderScopeLabel} ({filteredOrders.length})
                  </h3>
                  {hasActiveOrderFilters && (
                    <span className="text-xs font-mono px-2.5 py-0.5 bg-[#1E1E1E] border border-[#D4AF37]/30 text-[#D4AF37]">
                      {filteredOrders.length} / {scopedOrders.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    disabled={filteredOrders.length === 0}
                    onClick={() => {
                      const exported = onExportOrdersCsv
                        ? onExportOrdersCsv(filteredOrders)
                        : exportOrdersToExcel(filteredOrders, branchConfig, lang, branchConfigs);
                      if (exported) {
                        setCsvExported(true);
                        window.setTimeout(() => setCsvExported(false), 2500);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#D4AF37] hover:bg-[#e3be42] disabled:opacity-40 disabled:cursor-not-allowed text-[#121212] font-bold text-xs transition-colors cursor-pointer"
                  >
                    {csvExported ? (
                      <>
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.bookings.exportCsvSuccess}</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.bookings.exportCsvBtn}</span>
                      </>
                    )}
                  </button>
                  <span className="text-xs font-mono px-2.5 py-1.5 bg-[#1E1E1E] border border-[#D4AF37]/30 text-[#C9C1B1]">
                    {branchConfig.phone}
                  </span>
                </div>
              </div>

              {/* Orders Search, Branch & Date Range Filter Bar */}
              <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-3.5 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  {/* Search Input */}
                  <div className="md:col-span-4">
                    <label className="block text-[11px] text-[#C9C1B1] mb-1 font-bold">
                      {lang === 'ar'
                        ? 'بحث (الاسم، الهاتف، رقم الطلب، الصنف)'
                        : 'Search (Name, Phone, Order ID, Item)'}
                    </label>
                    <div className="relative">
                      <Search
                        className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                          lang === 'ar' ? 'right-3' : 'left-3'
                        }`}
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'ابحث في الطلبات...'
                            : 'Search orders...'
                        }
                        className={`w-full py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] placeholder-[#9E9585] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37] ${
                          lang === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Branch Filter Dropdown */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-[#C9C1B1] mb-1 font-bold">
                      {lang === 'ar' ? 'تصفية حسب الفرع' : 'Filter by Branch'}
                    </label>
                    <select
                      value={orderBranchFilter}
                      onChange={(e) => setOrderBranchFilter(e.target.value as 'all' | BranchId)}
                      aria-label={lang === 'ar' ? 'تصفية الطلبات حسب الفرع' : 'Filter orders by branch'}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="all" className="bg-[#121212]">
                        {lang === 'ar' ? 'كل الفروع' : 'All Branches'}
                      </option>
                      {BRANCH_ORDER.map((bId) => (
                        <option key={`ord-branch-filter-${bId}`} value={bId} className="bg-[#121212]">
                          {lang === 'ar'
                            ? branchConfigs[bId].shortNameAr
                            : branchConfigs[bId].shortNameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date From */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-[#C9C1B1] mb-1 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#D4AF37]" />
                      <span>{lang === 'ar' ? 'من تاريخ' : 'From Date'}</span>
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      value={orderDateFrom}
                      onChange={(e) => setOrderDateFrom(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs focus:outline-none focus:border-[#D4AF37] [color-scheme:dark]"
                    />
                  </div>

                  {/* Date To */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-[#C9C1B1] mb-1 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#D4AF37]" />
                      <span>{lang === 'ar' ? 'إلى تاريخ' : 'To Date'}</span>
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      value={orderDateTo}
                      onChange={(e) => setOrderDateTo(e.target.value)}
                      className="w-full px-2.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs focus:outline-none focus:border-[#D4AF37] [color-scheme:dark]"
                    />
                  </div>

                  {/* Status Filter */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-[#C9C1B1] mb-1 font-bold">
                      {lang === 'ar' ? 'حالة الطلب' : 'Status'}
                    </label>
                    <select
                      value={orderStatusFilter}
                      onChange={(e) =>
                        setOrderStatusFilter(e.target.value as 'all' | BookingStatus)
                      }
                      aria-label={lang === 'ar' ? 'تصفية الطلبات حسب الحالة' : 'Filter orders by status'}
                      className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                    >
                      <option value="all" className="bg-[#121212]">
                        {lang === 'ar' ? 'كل الحالات' : 'All Statuses'}
                      </option>
                      {(
                        [
                          'pending',
                          'preparing',
                          'confirmed',
                          'completed',
                          'cancelled',
                        ] as BookingStatus[]
                      ).map((st) => (
                        <option key={`ord-st-filter-${st}`} value={st} className="bg-[#121212]">
                          {t.statuses[st]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {hasActiveOrderFilters && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#D4AF37]/15 flex-wrap">
                    <span className="text-[11px] text-[#C9C1B1]">
                      {lang === 'ar'
                        ? `عرض ${filteredOrders.length} طلب من أصل ${scopedOrders.length}`
                        : `Showing ${filteredOrders.length} of ${scopedOrders.length} orders`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch('');
                        setOrderBranchFilter(adminBranch);
                        setOrderDateFrom('');
                        setOrderDateTo('');
                        setOrderStatusFilter('all');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#121212] border border-[#D4AF37]/35 hover:border-[#D4AF37] text-[#D4AF37] text-xs font-bold cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{lang === 'ar' ? 'إعادة ضبط الفلاتر' : 'Reset Filters'}</span>
                    </button>
                  </div>
                )}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-8 text-center text-[#9E9585] text-sm">
                  {hasActiveOrderFilters
                    ? lang === 'ar'
                      ? 'لا توجد طلبات مطابقة لمعايير البحث أو التاريخ المحدد.'
                      : 'No orders match your current search or date/branch filters.'
                    : t.bookings.emptyOrders}
                </div>
              ) : (
                filteredOrders.map((o) => {
                  const orderBranchId = o.branchId || adminBranch;
                  const orderBranchCfg = branchConfigs[orderBranchId] || branchConfig;
                  const orderBranchName =
                    lang === 'ar' ? orderBranchCfg.shortNameAr : orderBranchCfg.shortNameEn;
                  const orderDateFormatted = (() => {
                    const d = new Date(o.createdAt);
                    if (Number.isNaN(d.getTime())) return o.createdAt;
                    return d.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                  })();
                  const isCustomerCancelled =
                    o.status === 'cancelled' && o.cancelledBy !== 'admin';
                  const isUnreadCancel =
                    isCustomerCancelled && !o.adminCancelAcknowledged;
                  return (
                  <div
                    key={`${orderBranchId}-${o.id}`}
                    className={`border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                      isUnreadCancel
                        ? 'bg-red-950/40 border-2 border-red-500 shadow-lg'
                        : isCustomerCancelled
                          ? 'bg-red-950/20 border-2 border-red-500/75'
                          : 'bg-[#1E1E1E] border border-[#D4AF37]/30'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-0.5 bg-[#D4AF37] text-[#121212] font-bold text-xs font-mono">
                          {o.id}
                        </span>
                        <span className="px-2 py-0.5 bg-[#121212] border border-[#D4AF37]/40 text-[#D4AF37] text-[11px] font-bold">
                          {orderBranchName}
                        </span>
                        <span className="font-bold text-[#F7F3E9] text-base">
                          {o.customerName}
                        </span>
                        <a
                          href={`tel:${o.phone}`}
                          className="text-xs text-[#D4AF37] font-mono underline"
                          dir="ltr"
                        >
                          {o.phone}
                        </a>
                        <span className="text-[11px] text-[#9E9585] inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#D4AF37]/70" />
                          <span>{orderDateFormatted}</span>
                        </span>

                        {/* Payment Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold border ${
                            o.paymentMethod === 'instapay_vodafone'
                              ? 'bg-[#10B981]/15 border-[#10B981] text-[#10B981]'
                              : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          }`}
                        >
                          {o.paymentMethod === 'instapay_vodafone' ? (
                            <Wallet className="w-3 h-3" />
                          ) : (
                            <Banknote className="w-3 h-3" />
                          )}
                          <span>
                            {o.paymentMethod === 'instapay_vodafone'
                              ? `تحويل فوري (محول من: ${o.transferSender || 'تم الإرفاق'})`
                              : 'الدفع عند الاستلام (كاش / POS)'}
                          </span>
                        </span>

                        {isCustomerCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-red-600 border border-red-400 text-white shadow-sm">
                            <XCircle className="w-3.5 h-3.5 text-white" />
                            <span>ملغي من العميل</span>
                          </span>
                        )}
                      </div>

                      {isCustomerCancelled && (
                        <div className="bg-red-950/40 border border-red-500/40 px-3 py-2 text-xs text-red-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>
                              {t.bookings.customerCancelAlertDesc}
                              {o.cancellationReason ? ` — (${o.cancellationReason})` : ''}
                            </span>
                          </div>
                          {isUnreadCancel && onAcknowledgeOrderCancellation && (
                            <button
                              type="button"
                              onClick={() => onAcknowledgeOrderCancellation(orderBranchId, o.id)}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>{t.bookings.acknowledgeCancelBtn}</span>
                            </button>
                          )}
                        </div>
                      )}

                      <div className="text-xs sm:text-sm text-[#C9C1B1] space-y-1">
                        <p>
                          الخدمة: <strong className="text-[#F7F3E9]">{o.serviceType}</strong> |
                          العنوان: <strong className="text-[#F7F3E9]">{o.address}</strong>
                        </p>
                        <p className="text-[#D4AF37]">
                          الأصناف:{' '}
                          {o.items.map((i) => `${i.titleAr} (×${i.quantity})`).join(' + ')} —
                          الإجمالي: <strong>{o.totalAmount} ج.م</strong>
                        </p>
                      </div>
                      {o.notes && <p className="text-xs text-[#9E9585]">ملاحظات: {o.notes}</p>}
                    </div>

                    {/* Status Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          'pending',
                          'preparing',
                          'confirmed',
                          'completed',
                          'cancelled',
                        ] as BookingStatus[]
                      ).map((st) => {
                        const active = o.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              if (st === 'cancelled') {
                                adminSelfCancelledKeysRef.current.add(o.firestoreDocId || o.id);
                              }
                              onUpdateOrderStatus(o.id, st, orderBranchId);
                            }}
                            className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                                : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{t.statuses[st]}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOrder({ ...o, branchId: orderBranchId })}
                        title={lang === 'ar' ? 'حذف الطلب نهائياً' : 'Delete order permanently'}
                        aria-label={lang === 'ar' ? 'حذف الطلب نهائياً' : 'Delete order permanently'}
                        className="p-2 bg-[#121212] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Table Reservations Section */}
            <div className="space-y-4">
              <div className="border-b border-[#D4AF37]/25 pb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-lg text-[#D4AF37]">
                  {t.bookings.reservationsTitle} — {activeBranchLabel} ({reservations.length})
                </h3>
                {(reservationSearch.trim() !== '' || reservationStatusFilter !== 'all') && (
                  <span className="text-xs font-mono px-2.5 py-1 bg-[#1E1E1E] border border-[#D4AF37]/30 text-[#D4AF37]">
                    {filteredReservations.length} / {reservations.length}
                  </span>
                )}
              </div>

              {/* Search Bar & Status Filter Dropdown */}
              <div className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    className={`w-4 h-4 text-[#D4AF37] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                      lang === 'ar' ? 'right-3' : 'left-3'
                    }`}
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={reservationSearch}
                    onChange={(e) => setReservationSearch(e.target.value)}
                    aria-label={
                      lang === 'ar'
                        ? 'بحث في الحجوزات باسم العميل أو الهاتف'
                        : 'Search reservations by customer name or phone'
                    }
                    placeholder={
                      lang === 'ar'
                        ? 'ابحث باسم العميل، رقم الهاتف، أو رقم الحجز...'
                        : 'Search by customer name, phone, or booking ID...'
                    }
                    className={`w-full py-2 bg-[#121212] border border-[#D4AF37]/30 text-[#F7F3E9] text-xs focus:outline-none focus:border-[#D4AF37] ${
                      lang === 'ar' ? 'pr-9 pl-3' : 'pl-9 pr-3'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-2 sm:w-64 shrink-0">
                  <label htmlFor="reservation-status-filter" className="sr-only">
                    {lang === 'ar' ? 'تصفية حسب حالة الحجز' : 'Filter by reservation status'}
                  </label>
                  <select
                    id="reservation-status-filter"
                    value={reservationStatusFilter}
                    onChange={(e) =>
                      setReservationStatusFilter(e.target.value as 'all' | BookingStatus)
                    }
                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-xs font-bold focus:outline-none focus:border-[#D4AF37] cursor-pointer"
                  >
                    <option value="all" className="bg-[#121212] text-[#F7F3E9]">
                      {lang === 'ar' ? 'كل الحالات' : 'All Statuses'}
                    </option>
                    {(
                      [
                        'pending',
                        'preparing',
                        'confirmed',
                        'completed',
                        'cancelled',
                      ] as BookingStatus[]
                    ).map((st) => (
                      <option
                        key={`res-filter-${st}`}
                        value={st}
                        className="bg-[#121212] text-[#F7F3E9]"
                      >
                        {t.statuses[st]}
                      </option>
                    ))}
                  </select>

                  {(reservationSearch.trim() !== '' || reservationStatusFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setReservationSearch('');
                        setReservationStatusFilter('all');
                      }}
                      title={lang === 'ar' ? 'مسح الفلتر' : 'Clear filters'}
                      className="p-2 bg-[#121212] border border-[#D4AF37]/35 text-[#C9C1B1] hover:text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {filteredReservations.length === 0 ? (
                <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-8 text-center text-[#9E9585] text-sm space-y-3">
                  <p>{t.bookings.emptyRes}</p>
                  {reservations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReservationSearch('');
                        setReservationStatusFilter('all');
                      }}
                      className="px-4 py-1.5 bg-[#121212] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold hover:bg-[#D4AF37] hover:text-[#121212] transition-colors cursor-pointer"
                    >
                      {lang === 'ar' ? 'عرض كل الحجوزات' : 'Show All Reservations'}
                    </button>
                  )}
                </div>
              ) : (
                filteredReservations.map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-0.5 bg-[#D4AF37] text-[#121212] font-bold text-xs font-mono">
                          {r.id}
                        </span>
                        <span className="font-bold text-[#F7F3E9] text-base">
                          {r.customerName}
                        </span>
                        <a
                          href={`tel:${r.phone}`}
                          className="text-xs text-[#D4AF37] font-mono underline"
                          dir="ltr"
                        >
                          {r.phone}
                        </a>
                        <a
                          href={`https://wa.me/${r.phone.replace(/\D/g, '').replace(/^0/, '20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-xs font-bold"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>{t.bookings.whatsappReply}</span>
                        </a>
                      </div>

                      <p className="text-xs sm:text-sm text-[#C9C1B1]">
                        التاريخ: <strong className="text-[#F7F3E9]">{r.date}</strong> | الساعة:{' '}
                        <strong className="text-[#F7F3E9]">{r.time}</strong> | عدد الأفراد:{' '}
                        <strong className="text-[#D4AF37]">{r.guests}</strong> | منطقة الجلوس:{' '}
                        <strong className="text-[#F7F3E9]">
                          {fullT.modal.seatingOptions[r.seatingPreference]}
                        </strong>
                      </p>
                      {r.notes && <p className="text-xs text-[#9E9585]">ملاحظات: {r.notes}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          'pending',
                          'preparing',
                          'confirmed',
                          'completed',
                          'cancelled',
                        ] as BookingStatus[]
                      ).map((st) => {
                        const active = r.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => onUpdateReservationStatus(r.id, st)}
                            className={`px-3 py-1.5 text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                              active
                                ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                                : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]'
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span>{t.statuses[st]}</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onDeleteReservation(r.id)}
                        className="p-2 bg-[#121212] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: REVIEWS MANAGEMENT (LIVE CUSTOMER REVIEWS WITH TRASH DELETE) */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div className="bg-[#1E1E1E] border border-[#D4AF37]/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-[#D4AF37]">
                  إدارة التقييمات ({reviews.length})
                </h3>
                <p className="text-xs text-[#C9C1B1] mt-1">
                  {lang === 'ar'
                    ? 'قائمة جميع التعليقات والتقييمات المنشورة من العملاء على الموقع، مع إمكانية حذف أي تعليق نهائياً بضغطة زر.'
                    : 'All live customer reviews published on the website. Click the trash button to permanently remove any review.'}
                </p>
              </div>
              <div className="px-4 py-2 bg-[#121212] border border-[#D4AF37]/40 text-xs font-bold text-[#D4AF37] flex items-center gap-2 shrink-0">
                <Star className="w-4 h-4 fill-[#D4AF37]" />
                <span>
                  {reviews.length > 0
                    ? `${(
                        reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) /
                        reviews.length
                      ).toFixed(1)} ★ (${reviews.length})`
                    : '0.0 ★ (0)'}
                </span>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-10 text-center text-[#9E9585] text-sm">
                {lang === 'ar'
                  ? 'لا توجد تقييمات منشورة من العملاء حتى الآن.'
                  : 'No customer reviews published yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => {
                  const revBranch = branchConfigs[rev.branchId] || branchConfig;
                  const revBranchName =
                    lang === 'ar' ? revBranch.shortNameAr : revBranch.shortNameEn;
                  return (
                    <div
                      key={rev.id}
                      className="bg-[#1E1E1E] border border-[#D4AF37]/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-bold text-base text-[#F7F3E9]">{rev.author}</span>
                          <span className="px-2.5 py-0.5 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-bold">
                            {revBranchName}
                          </span>
                          <div className="flex items-center gap-0.5 text-[#D4AF37]">
                            {[1, 2, 3, 4, 5].map((idx) => (
                              <Star
                                key={idx}
                                className={`w-3.5 h-3.5 ${
                                  idx <= rev.rating
                                    ? 'fill-[#D4AF37] text-[#D4AF37]'
                                    : 'text-[#D4AF37]/25'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-[#9E9585] font-mono">
                            {new Date(rev.createdAt).toLocaleDateString(
                              lang === 'ar' ? 'ar-EG' : 'en-US'
                            )}
                          </span>
                        </div>
                        <p className="text-sm text-[#C9C1B1] leading-relaxed break-words">
                          "{rev.comment}"
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteReview(rev.id)}
                        title={lang === 'ar' ? 'حذف التعليق نهائياً' : 'Delete review permanently'}
                        aria-label={lang === 'ar' ? 'حذف التعليق نهائياً' : 'Delete review permanently'}
                        className="px-3.5 py-2.5 bg-[#121212] border border-red-500/40 text-red-400 hover:bg-red-600 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{lang === 'ar' ? 'حذف التقييم' : 'Delete'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: BRANCH MENU QR CODE GENERATOR & DOWNLOADER */}
        {activeTab === 'qr' && (() => {
          const officialDriveUrl = getBranchMenuDriveUrl(adminBranch);
          const cleanTarget = qrTargetUrl.trim() || officialDriveUrl;
          const generatedQrUrl = buildQrCodeImageUrl(cleanTarget, qrSize);

          const handleDownloadQrPng = async () => {
            setQrDownloading(true);
            setQrNotice(null);
            try {
              const response = await fetch(generatedQrUrl);
              if (!response.ok) throw new Error('QR fetch failed');
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = objectUrl;
              link.download = `saheb-elsaada-${adminBranch}-menu-qr-${qrSize}x${qrSize}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(objectUrl);
              setQrNotice(
                lang === 'ar'
                  ? `تم تحميل صورة QR لـ ${activeBranchLabel} بنجاح (${qrSize}×${qrSize} px).`
                  : `QR image downloaded for ${activeBranchLabel} (${qrSize}×${qrSize} px).`
              );
            } catch {
              setQrNotice(
                lang === 'ar'
                  ? 'تعذر التنزيل التلقائي — يمكنك الضغط على "فتح صورة QR" ثم حفظها مباشرة.'
                  : 'Automatic download unavailable — click "Open QR Image" to save it directly.'
              );
            } finally {
              setQrDownloading(false);
            }
          };

          const handleCopyTarget = () => {
            navigator.clipboard?.writeText(cleanTarget).catch(() => {});
            setQrCopied(true);
            setTimeout(() => setQrCopied(false), 1800);
          };

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Configuration & Actions Column */}
              <div className="lg:col-span-7 bg-[#1E1E1E] border border-[#D4AF37]/50 p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3.5 border-b border-[#D4AF37]/20 pb-4">
                  <div className="w-11 h-11 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#D4AF37]">
                      {lang === 'ar'
                        ? `مولد وتحميل باركود المنيو (QR) — ${activeBranchLabel}`
                        : `Branch Menu QR Code Generator — ${activeBranchLabel}`}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1 leading-relaxed">
                      {lang === 'ar'
                        ? 'أنشئ وحمّل رمز الاستجابة السريع (QR) الخاص بقائمة الطعام الرقمية أو رابط خرائط جوجل لطباعته على الطاولات واستقبال الطلبات.'
                        : 'Generate and download high-resolution QR codes for your branch digital menu PDF or Google Maps link for table tents and print.'}
                    </p>
                  </div>
                </div>

                {qrNotice && (
                  <div className="p-3 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{qrNotice}</span>
                  </div>
                )}

                {/* Preset Destination Buttons for Active Branch */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-[#F7F3E9]">
                    {lang === 'ar'
                      ? '١. اختر الوجهة الجاهزة للفرع الحالي:'
                      : '1. Quick Branch Destination Presets:'}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setQrTargetUrl(officialDriveUrl)}
                      className={`px-3.5 py-2 text-xs font-bold border transition-colors cursor-pointer ${
                        cleanTarget === officialDriveUrl
                          ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                          : 'bg-[#121212] text-[#F7F3E9] border-[#D4AF37]/35 hover:border-[#D4AF37]'
                      }`}
                    >
                      {lang === 'ar'
                        ? `منيو ${activeBranchLabel} الرسمي (Google Drive PDF)`
                        : `${activeBranchLabel} Official Menu PDF`}
                    </button>

                    <button
                      type="button"
                      onClick={() => setQrTargetUrl(branchConfig.mapsShareUrl)}
                      className={`px-3.5 py-2 text-xs font-bold border transition-colors cursor-pointer ${
                        cleanTarget === branchConfig.mapsShareUrl
                          ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                          : 'bg-[#121212] text-[#F7F3E9] border-[#D4AF37]/35 hover:border-[#D4AF37]'
                      }`}
                    >
                      {lang === 'ar'
                        ? `موقع ${activeBranchLabel} (Google Maps)`
                        : `${activeBranchLabel} Google Maps`}
                    </button>
                  </div>
                </div>

                {/* Editable Target URL Field */}
                <div className="space-y-1.5">
                  <label htmlFor="admin-qr-target-url" className="block text-xs font-bold text-[#F7F3E9]">
                    {lang === 'ar'
                      ? '٢. رابط المنيو الرقمي المُشفَّر داخل كود QR:'
                      : '2. Target Digital Menu URL Encoded in QR:'}
                  </label>
                  <input
                    id="admin-qr-target-url"
                    type="url"
                    dir="ltr"
                    value={qrTargetUrl}
                    onChange={(e) => setQrTargetUrl(e.target.value)}
                    placeholder={officialDriveUrl}
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-xs font-mono focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                {/* Output Resolution Selector */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-[#F7F3E9]">
                    {lang === 'ar'
                      ? '٣. دقة وحجم صورة الـ QR للتحميل والطباعة:'
                      : '3. QR Image Resolution for Download & Print:'}
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([250, 500, 800] as const).map((dim) => (
                      <button
                        key={`qr-dim-${dim}`}
                        type="button"
                        onClick={() => setQrSize(dim)}
                        className={`py-2.5 px-3 border text-xs font-bold font-mono transition-colors cursor-pointer ${
                          qrSize === dim
                            ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                            : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]'
                        }`}
                      >
                        {dim} × {dim} px
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Download & Helper Action Buttons */}
                <div className="pt-3 border-t border-[#D4AF37]/20 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={qrDownloading}
                    onClick={handleDownloadQrPng}
                    className="px-5 py-3 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {qrDownloading
                        ? lang === 'ar'
                          ? 'جاري تجهيز الملف...'
                          : 'Downloading...'
                        : lang === 'ar'
                        ? `تحميل صورة QR (${qrSize}px PNG)`
                        : `Download QR (${qrSize}px PNG)`}
                    </span>
                  </button>

                  <a
                    href={generatedQrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-3 bg-[#121212] hover:bg-[#D4AF37]/15 border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'فتح صورة QR' : 'Open QR Image'}</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyTarget}
                    className="px-4 py-3 bg-[#121212] hover:bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#F7F3E9] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    {qrCopied ? (
                      <>
                        <Check className="w-4 h-4 text-[#10B981]" />
                        <span className="text-[#10B981]">
                          {lang === 'ar' ? 'تم نسخ الرابط' : 'Copied'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#D4AF37]" />
                        <span>{lang === 'ar' ? 'نسخ رابط المنيو' : 'Copy Menu URL'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-3 bg-[#121212] hover:bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#C9C1B1] hover:text-[#F7F3E9] text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#D4AF37]" />
                    <span>{lang === 'ar' ? 'طباعة البطاقة' : 'Print Card'}</span>
                  </button>
                </div>
              </div>

              {/* Live Printable Table-Tent Card Preview */}
              <div className="lg:col-span-5 bg-gradient-to-b from-[#1A1610] to-[#121212] border-2 border-[#D4AF37] p-6 sm:p-8 flex flex-col items-center text-center space-y-5 shadow-2xl">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-widest font-bold text-[#D4AF37] block">
                    {branchConfig.districtTagEn}
                  </span>
                  <h4 className="font-display-serif text-2xl font-bold text-[#F7F3E9]">
                    {fullT.brandName}
                  </h4>
                  <p className="text-xs font-bold text-[#D4AF37]">{activeBranchLabel}</p>
                </div>

                <a
                  href={cleanTarget}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white p-4 border-2 border-[#D4AF37] shadow-xl block"
                  aria-label={`${activeBranchLabel} Generated QR Code`}
                >
                  <img
                    src={generatedQrUrl}
                    alt={`${activeBranchLabel} Menu QR Code`}
                    width={220}
                    height={220}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-[220px] h-[220px] object-contain block"
                  />
                </a>

                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-[#F7F3E9]">
                    {lang === 'ar'
                      ? 'امسح الكود بكاميرا هاتفك لتصفح المنيو الرقمي'
                      : 'Scan with your camera to browse the digital menu'}
                  </p>
                  <p dir="ltr" className="text-xs font-mono text-[#D4AF37]">
                    ☎ {branchConfig.phone}
                  </p>
                  <p className="text-[11px] text-[#9E9585] break-all max-w-xs mx-auto" dir="ltr">
                    {cleanTarget}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 7: BRANCH REVENUE TRENDS & MENU ANALYTICS (RECHARTS) */}
        {activeTab === 'analytics' && (
          <BranchAnalyticsPanel
            lang={lang}
            adminBranch={adminBranch}
            branchConfig={branchConfig}
            branchConfigs={branchConfigs}
            stores={stores}
            orders={orders}
            reservations={reservations}
            menu={menu}
          />
        )}

        {/* TAB 8: BRANCH CONTACT / WHATSAPP & SECURITY SETTINGS */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Per-Branch WhatsApp, Phone, Address & Payment Settings */}
            <div className="bg-[#1E1E1E] border border-[#D4AF37] p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-start gap-3.5 border-b border-[#D4AF37]/25 pb-4">
                <div className="w-11 h-11 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#D4AF37]">
                    {lang === 'ar'
                      ? `تواصل وواتساب — ${activeBranchLabel}`
                      : `Contact & WhatsApp — ${activeBranchLabel}`}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1 leading-relaxed">
                    {lang === 'ar'
                      ? 'تعديل رقم الهاتف، رقم استقبال الطلبات على واتساب، فودافون كاش، إنستاباي، والعنوان لهذا الفرع بشكل مستقل.'
                      : 'Customize phone, WhatsApp order routing number, Vodafone Cash, InstaPay, and address independently for this branch.'}
                  </p>
                </div>
              </div>

              {branchSettingsSaved && (
                <div className="p-3 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `تم حفظ بيانات التواصل والواتساب لـ ${activeBranchLabel} بنجاح.`
                      : `Contact & WhatsApp settings saved for ${activeBranchLabel}.`}
                  </span>
                </div>
              )}

              <form onSubmit={handleBranchSettingsSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'رقم الهاتف للعرض والاتصال' : 'Display Phone'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={bPhone}
                      onChange={(e) => setBPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar'
                        ? 'رقم الواتساب الدولي (بدون +)'
                        : 'WhatsApp Intl Number (no +)'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={bWhatsappIntl}
                      onChange={(e) => setBWhatsappIntl(e.target.value)}
                      placeholder="201278861071"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'رقم فودافون كاش' : 'Vodafone Cash'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={bVodafoneCash}
                      onChange={(e) => setBVodafoneCash(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {lang === 'ar' ? 'عنوان إنستاباي (InstaPay)' : 'InstaPay Handle'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={bInstapay}
                      onChange={(e) => setBInstapay(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar' ? 'العنوان بالتفصيل (عربي)' : 'Branch Address (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={bAddressAr}
                    onChange={(e) => setBAddressAr(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {lang === 'ar' ? 'العنوان بالإنجليزية' : 'Branch Address (English)'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={bAddressEn}
                    onChange={(e) => setBAddressEn(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {lang === 'ar'
                      ? `حفظ بيانات ${activeBranchLabel}`
                      : `Save ${activeBranchLabel} Contact Settings`}
                  </span>
                </button>
              </form>
            </div>

            {/* Firebase Auth Admin Account Protection Card */}
            <div className="bg-[#1E1E1E] border border-[#D4AF37] p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-start gap-3.5 border-b border-[#D4AF37]/25 pb-4">
                <div className="w-11 h-11 bg-[#121212] border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#D4AF37]">
                    {t.securityForm.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#C9C1B1] mt-1 leading-relaxed">
                    {t.securityForm.subtitle}
                  </p>
                </div>
              </div>

              <div className="bg-[#121212] border border-[#D4AF37]/30 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-xs text-[#9E9585]">
                    {t.securityForm.newUsernameLabel}
                  </span>
                  <span
                    dir="ltr"
                    className="text-sm font-mono font-bold text-[#D4AF37]"
                  >
                    {adminSession.adminUsername}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#10B981] font-bold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{t.securityForm.savedSuccess}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAdminLogout()}
                className="w-full py-3.5 bg-red-600/20 hover:bg-red-600 border border-red-500/60 text-red-200 hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Permanent Order Deletion Confirmation Modal */}
      {confirmDeleteOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-[#1E1E1E] border border-red-500/60 p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-red-950/70 border border-red-500/60 text-red-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base sm:text-lg text-[#F7F3E9]">
                  {lang === 'ar'
                    ? 'تأكيد حذف الطلب نهائياً'
                    : 'Confirm Permanent Order Deletion'}
                </h3>
                <p className="text-xs sm:text-sm text-[#C9C1B1] leading-relaxed">
                  {lang === 'ar'
                    ? `هل أنت متأكد من حذف طلب "${confirmDeleteOrder.customerName}" بقيمة ${confirmDeleteOrder.totalAmount} ج.م نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `Are you sure you want to permanently delete the order from "${confirmDeleteOrder.customerName}" (${confirmDeleteOrder.totalAmount} EGP) from Firestore? This cannot be undone.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D4AF37]/20">
              <button
                type="button"
                onClick={() => setConfirmDeleteOrder(null)}
                className="px-4 py-2.5 bg-[#121212] border border-[#D4AF37]/30 hover:border-[#D4AF37] text-[#C9C1B1] hover:text-[#F7F3E9] text-xs font-bold cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(confirmDeleteOrder.id, confirmDeleteOrder.branchId);
                  setConfirmDeleteOrder(null);
                }}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'حذف نهائياً' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
