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
  Eye,
  EyeOff,
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
} from 'lucide-react';
import type {
  AuthSession,
  BookingStatus,
  BranchCmsSettings,
  BranchConfig,
  BranchContactSettings,
  BranchId,
  CustomerReview,
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
import { playOrderNotificationChime, unlockAudioContext } from '../utils/orderAlertSound.ts';
import { exportOrdersToCsv } from '../utils/exportOrdersCsv.ts';

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
  authError: string | null;
  authLoading: boolean;
  onAdminLogin: (username: string, password: string) => Promise<boolean>;
  onAdminLogout: () => void;
  onUpdateAdminCredentials: (payload: {
    currentPassword: string;
    newUsername: string;
    newPassword: string;
  }) => { ok: boolean; error?: string };
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
  onUpdateOrderStatus: (id: string, status: BookingStatus) => void;
  onAcknowledgeOrderCancellation?: (branchId: BranchId, orderId: string) => void;
  onDeleteOrder: (id: string) => void;
  onExportOrdersCsv?: () => boolean;
  reviews: CustomerReview[];
  onDeleteReview: (id: string) => void;
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
  authError,
  authLoading,
  onAdminLogin,
  onAdminLogout,
  onUpdateAdminCredentials,
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

  // Login Gate State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Security Settings Form State
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewUsername, setSecNewUsername] = useState(adminSession?.adminUsername || 'admin');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [secError, setSecError] = useState<string | null>(null);
  const [secSuccess, setSecSuccess] = useState<string | null>(null);
  const [secShowPasswords, setSecShowPasswords] = useState(false);

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
  const [csvExported, setCsvExported] = useState(false);
  const seenOrderIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('saheb_elsaada_order_sound_v1', String(orderSoundEnabled));
    } catch {
      // ignore storage errors
    }
  }, [orderSoundEnabled]);

  useEffect(() => {
    const allOrders: Array<{ branchId: BranchId; order: OnlineOrder }> = [];
    BRANCH_ORDER.forEach((bId) => {
      (stores[bId]?.orders || []).forEach((order) => {
        allOrders.push({ branchId: bId, order });
      });
    });

    if (seenOrderIdsRef.current === null) {
      seenOrderIdsRef.current = new Set(allOrders.map((entry) => entry.order.id));
      return;
    }

    const newlyArrived = allOrders.filter(
      (entry) => !seenOrderIdsRef.current!.has(entry.order.id)
    );

    if (newlyArrived.length > 0) {
      newlyArrived.forEach((entry) => seenOrderIdsRef.current!.add(entry.order.id));
      setIncomingOrderAlerts((prev) => [...newlyArrived, ...prev].slice(0, 6));
      if (adminSession && orderSoundEnabled) {
        playOrderNotificationChime();
      }
    }
  }, [stores, adminSession, orderSoundEnabled]);

  // Menu Form & Reservations Filter State
  const [menuAdminSearch, setMenuAdminSearch] = useState('');
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
    await onAdminLogin(username, password);
  };

  // --- Protected Login Gate if not authenticated ---
  if (!adminSession) {
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
            <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs text-center">
              {authError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#C9C1B1] mb-1.5">{authT.usernameLabel}</label>
              <input
                type="text"
                required
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={authT.usernamePlaceholder}
                className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#C9C1B1] mb-1.5">{authT.passwordLabel}</label>
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="p-3 bg-[#121212] border border-[#D4AF37]/25 text-[11px] text-[#D4AF37] flex items-center justify-between gap-2">
              <span>{authT.adminDemoHint}</span>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                }}
                className="px-2 py-1 bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#F7F3E9] font-bold cursor-pointer shrink-0"
              >
                {lang === 'ar' ? 'تعبئة تلقائية' : 'Auto-fill'}
              </button>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm transition-colors cursor-pointer"
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

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSecError(null);
    setSecSuccess(null);

    if (secNewPassword !== secConfirmPassword) {
      setSecError(t.securityForm.mismatchError);
      return;
    }

    const res = onUpdateAdminCredentials({
      currentPassword: secCurrentPassword,
      newUsername: secNewUsername,
      newPassword: secNewPassword,
    });

    if (!res.ok) {
      setSecError(res.error || 'Error');
      return;
    }

    setSecCurrentPassword('');
    setSecNewPassword('');
    setSecConfirmPassword('');
    setSecSuccess(t.securityForm.savedSuccess);
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

        {/* CUSTOMER ORDER CANCELLATION MANAGEMENT ALERTS */}
        {unacknowledgedCancellations.length > 0 && (
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
                    {t.bookings.customerCancelAlertTitle} ({unacknowledgedCancellations.length})
                  </h2>
                  <p className="text-xs text-red-200/80">
                    {t.bookings.customerCancelAlertDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {unacknowledgedCancellations.map(({ branchId, branchName, order }) => (
                <div
                  key={`cancel-alert-${order.id}`}
                  className="bg-[#121212]/90 border border-red-500/45 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 text-xs">
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
            onClick={() => {
              setSecError(null);
              setSecSuccess(null);
              setActiveTab('security');
            }}
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
                <h3 className="font-bold text-lg text-[#D4AF37]">
                  {t.bookings.ordersTitle} — {activeBranchLabel} ({orders.length})
                </h3>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    disabled={orders.length === 0}
                    onClick={() => {
                      const exported = onExportOrdersCsv
                        ? onExportOrdersCsv()
                        : exportOrdersToCsv(orders, branchConfig, lang);
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
              {orders.length === 0 ? (
                <div className="bg-[#1E1E1E] border border-[#D4AF37]/25 p-8 text-center text-[#9E9585] text-sm">
                  {t.bookings.emptyOrders}
                </div>
              ) : (
                orders.map((o) => {
                  const isCustomerCancelled =
                    o.status === 'cancelled' && o.cancelledBy === 'customer';
                  const isUnreadCancel =
                    isCustomerCancelled && !o.adminCancelAcknowledged;
                  return (
                  <div
                    key={o.id}
                    className={`border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isUnreadCancel
                        ? 'bg-red-950/30 border-2 border-red-500 shadow-lg'
                        : isCustomerCancelled
                          ? 'bg-[#1E1E1E] border border-red-500/45'
                          : 'bg-[#1E1E1E] border border-[#D4AF37]/30'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="px-2.5 py-0.5 bg-[#D4AF37] text-[#121212] font-bold text-xs font-mono">
                          {o.id}
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
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold bg-red-600/20 border border-red-500 text-red-200">
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                            <span>{t.bookings.cancelledByCustomerBadge}</span>
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
                              onClick={() => onAcknowledgeOrderCancellation(adminBranch, o.id)}
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
                            onClick={() => onUpdateOrderStatus(o.id, st)}
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
                        onClick={() => onDeleteOrder(o.id)}
                        className="p-2 bg-[#121212] border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white cursor-pointer"
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

            {/* Admin Security Credentials */}
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

              {secError && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-bold">
                  {secError}
                </div>
              )}

              {secSuccess && (
                <div className="p-3 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{secSuccess}</span>
                </div>
              )}

              <form onSubmit={handleSecuritySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {t.securityForm.currentPasswordLabel} *
                  </label>
                  <div className="relative">
                    <input
                      type={secShowPasswords ? 'text' : 'password'}
                      required
                      dir="ltr"
                      value={secCurrentPassword}
                      onChange={(e) => setSecCurrentPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => setSecShowPasswords((prev) => !prev)}
                      aria-label="Toggle password visibility"
                      className="absolute inset-y-0 right-2.5 flex items-center text-[#9E9585] hover:text-[#D4AF37] cursor-pointer"
                    >
                      {secShowPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">
                    {t.securityForm.newUsernameLabel} *
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={secNewUsername}
                    onChange={(e) => setSecNewUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {t.securityForm.newPasswordLabel} *
                    </label>
                    <input
                      type={secShowPasswords ? 'text' : 'password'}
                      required
                      dir="ltr"
                      value={secNewPassword}
                      onChange={(e) => setSecNewPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {t.securityForm.confirmPasswordLabel} *
                    </label>
                    <input
                      type={secShowPasswords ? 'text' : 'password'}
                      required
                      dir="ltr"
                      value={secConfirmPassword}
                      onChange={(e) => setSecConfirmPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.securityForm.saveBtn}</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
