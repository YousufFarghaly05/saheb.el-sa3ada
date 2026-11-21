import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Lock,
  LogOut,
  ShoppingBag,
  CheckCircle2,
  Heart,
  Plus,
  History,
  Calendar,
  RotateCcw,
  Clock,
  ChefHat,
  Truck,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Star,
  Pencil,
  Bell,
  Timer,
  AlertTriangle,
} from 'lucide-react';
import type {
  BookingStatus,
  CartItem,
  CustomerUser,
  Lang,
  MenuItem,
  OnlineOrder,
  Reservation,
} from '../types.ts';
import { getTranslations } from '../i18n/translations.ts';
import { ResilientImage } from './ResilientImage.tsx';
import { CustomerOrderMiniDashboard } from './CustomerOrderMiniDashboard.tsx';
import {
  EGYPTIAN_PHONE_ERROR_AR,
  isValidEgyptianPhone,
  normalizeEgyptianPhoneInput,
} from '../utils/egyptianPhone.ts';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  customer: CustomerUser | null;
  customerReservations: Reservation[];
  customerOrders: OnlineOrder[];
  favoriteDishes: MenuItem[];
  onToggleFavorite: (menuItemId: string) => void;
  onAddToCart: (item: MenuItem) => void;
  onRepeatOrder: (items: CartItem[]) => void;
  onRateOrder: (orderId: string, rating: number, comment: string) => void;
  onCancelOrder: (
    orderId: string,
    reason?: string
  ) => Promise<{
    ok: boolean;
    reason?: 'not_found' | 'already_final' | 'expired' | 'firestore_error';
    error?: string;
  }>;
  onOpenCheckout: () => void;
  authError: string | null;
  authLoading: boolean;
  onLogin: (identifier: string, password: string) => Promise<boolean>;
  onSignup: (payload: {
    name: string;
    phone: string;
    address: string;
    password: string;
  }) => Promise<boolean>;
  onUpdateProfile: (payload: {
    id: string;
    name: string;
    phone: string;
    address: string;
  }) => Promise<boolean>;
  onLogout: () => void;
}

function getOrderStatusStyle(status: BookingStatus) {
  switch (status) {
    case 'pending':
      return {
        cls: 'bg-amber-500/15 border-amber-400/70 text-amber-300',
        cardCls: 'border-amber-500/35 border-s-4 border-s-amber-400 bg-gradient-to-b from-amber-950/20 to-[#121212]',
        dotCls: 'bg-amber-400',
        barCls: 'bg-amber-400',
        textCls: 'text-amber-300',
        bannerCls: 'bg-amber-950/35 border-amber-500/30 text-amber-200',
        isActive: true,
        step: 1 as const,
        Icon: Clock,
      };
    case 'confirmed':
      return {
        cls: 'bg-indigo-500/15 border-indigo-400/70 text-indigo-300',
        cardCls: 'border-indigo-500/35 border-s-4 border-s-indigo-400 bg-gradient-to-b from-indigo-950/20 to-[#121212]',
        dotCls: 'bg-indigo-400',
        barCls: 'bg-indigo-400',
        textCls: 'text-indigo-300',
        bannerCls: 'bg-indigo-950/35 border-indigo-500/30 text-indigo-200',
        isActive: true,
        step: 1 as const,
        Icon: CheckCircle2,
      };
    case 'preparing':
      return {
        cls: 'bg-sky-500/15 border-sky-400/70 text-sky-300',
        cardCls: 'border-sky-500/40 border-s-4 border-s-sky-400 bg-gradient-to-b from-sky-950/25 to-[#121212]',
        dotCls: 'bg-sky-400',
        barCls: 'bg-sky-400',
        textCls: 'text-sky-300',
        bannerCls: 'bg-sky-950/40 border-sky-500/35 text-sky-200',
        isActive: true,
        step: 2 as const,
        Icon: ChefHat,
      };
    case 'completed':
      return {
        cls: 'bg-emerald-500/15 border-emerald-400/70 text-emerald-300',
        cardCls: 'border-emerald-500/35 border-s-4 border-s-emerald-400 bg-gradient-to-b from-emerald-950/20 to-[#121212]',
        dotCls: 'bg-emerald-400',
        barCls: 'bg-emerald-400',
        textCls: 'text-emerald-300',
        bannerCls: 'bg-emerald-950/35 border-emerald-500/30 text-emerald-200',
        isActive: false,
        step: 3 as const,
        Icon: Truck,
      };
    case 'cancelled':
      return {
        cls: 'bg-red-500/15 border-red-400/60 text-red-300',
        cardCls: 'border-red-500/30 border-s-4 border-s-red-500 bg-gradient-to-b from-red-950/20 to-[#121212] opacity-90',
        dotCls: 'bg-red-400',
        barCls: 'bg-red-500',
        textCls: 'text-red-300',
        bannerCls: 'bg-red-950/40 border-red-500/30 text-red-200',
        isActive: false,
        step: 0 as const,
        Icon: XCircle,
      };
  }
}

const ORDER_CANCEL_WINDOW_MS = 15 * 60 * 1000;

interface OrderStatusToast {
  id: string;
  orderId: string;
  prevStatus?: BookingStatus;
  newStatus: BookingStatus;
  customMessage?: string;
  variant: 'status' | 'cancel_success' | 'error';
}

function formatRemainingCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  customer,
  customerReservations,
  customerOrders,
  favoriteDishes,
  onToggleFavorite,
  onAddToCart,
  onRepeatOrder,
  onRateOrder,
  onCancelOrder,
  onOpenCheckout,
  authError,
  authLoading,
  onLogin,
  onSignup,
  onUpdateProfile,
  onLogout,
}) => {
  const t = getTranslations(lang).auth;
  const currency = lang === 'ar' ? 'ج.م' : 'EGP';
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [accountSection, setAccountSection] = useState<
    'profile' | 'favorites' | 'order_history' | 'reservations'
  >('profile');
  const [repeatedOrderId, setRepeatedOrderId] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | BookingStatus>('all');
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState<number>(5);
  const [ratingHoverValue, setRatingHoverValue] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [justRatedOrderId, setJustRatedOrderId] = useState<string | null>(null);

  // Instant Toast Notifications state
  const [statusToasts, setStatusToasts] = useState<OrderStatusToast[]>([]);
  const [hasUnreadStatusUpdate, setHasUnreadStatusUpdate] = useState(false);
  const seenStatusesRef = useRef<Record<string, BookingStatus> | null>(null);
  const seenCustomerIdRef = useRef<string | null>(null);
  const selfCancelledIdsRef = useRef<Set<string>>(new Set());

  // 15-minute cancellation state & live clock
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  // Profile edit state
  const [editName, setEditName] = useState(customer?.name || '');
  const [editPhone, setEditPhone] = useState(
    normalizeEgyptianPhoneInput(customer?.phone || '')
  );
  const [editAddress, setEditAddress] = useState(customer?.address || '');
  const [savedNotice, setSavedNotice] = useState(false);
  const [localPhoneError, setLocalPhoneError] = useState<string | null>(null);

  const pushToast = React.useCallback((toast: Omit<OrderStatusToast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setStatusToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setStatusToasts((prev) => prev.filter((item) => item.id !== id));
    }, 7000);
  }, []);

  useEffect(() => {
    if (customer) {
      setEditName(customer.name);
      setEditPhone(normalizeEgyptianPhoneInput(customer.phone || ''));
      setEditAddress(customer.address);
    }
    setLocalPhoneError(null);
  }, [customer]);

  useEffect(() => {
    setLocalPhoneError(null);
  }, [tab, accountSection, isOpen]);

  // Reset status tracker if customer changes
  useEffect(() => {
    if (!customer) {
      seenStatusesRef.current = null;
      seenCustomerIdRef.current = null;
      setStatusToasts([]);
      setHasUnreadStatusUpdate(false);
      return;
    }
    if (seenCustomerIdRef.current !== customer.id) {
      seenCustomerIdRef.current = customer.id;
      seenStatusesRef.current = null;
      try {
        const raw = localStorage.getItem(`saheb_elsaada_seen_order_statuses_${customer.id}`);
        if (raw) {
          seenStatusesRef.current = JSON.parse(raw) as Record<string, BookingStatus>;
        }
      } catch {
        seenStatusesRef.current = null;
      }
    }
  }, [customer]);

  // Detect live order status changes and fire instant Toast Notifications
  useEffect(() => {
    if (!isOpen || !customer) return;

    const storageKey = `saheb_elsaada_seen_order_statuses_${customer.id}`;
    if (seenStatusesRef.current === null) {
      const initialMap: Record<string, BookingStatus> = {};
      customerOrders.forEach((o) => {
        initialMap[o.id] = o.status;
      });
      seenStatusesRef.current = initialMap;
      try {
        localStorage.setItem(storageKey, JSON.stringify(initialMap));
      } catch {
        // ignore storage errors
      }
      return;
    }

    const prevMap = seenStatusesRef.current;
    const nextMap: Record<string, BookingStatus> = { ...prevMap };
    let changed = false;

    customerOrders.forEach((o) => {
      const prevStatus = prevMap[o.id];
      if (prevStatus && prevStatus !== o.status) {
        changed = true;
        if (selfCancelledIdsRef.current.has(o.id)) {
          selfCancelledIdsRef.current.delete(o.id);
        } else {
          pushToast({
            orderId: o.id,
            prevStatus,
            newStatus: o.status,
            variant: 'status',
          });
          if (accountSection !== 'order_history') {
            setHasUnreadStatusUpdate(true);
          }
        }
      } else if (!prevStatus) {
        changed = true;
      }
      nextMap[o.id] = o.status;
    });

    if (changed) {
      seenStatusesRef.current = nextMap;
      try {
        localStorage.setItem(storageKey, JSON.stringify(nextMap));
      } catch {
        // ignore storage errors
      }
    }
  }, [isOpen, customer, customerOrders, accountSection, pushToast]);

  // Clear unread indicator when entering order_history
  useEffect(() => {
    if (accountSection === 'order_history' && hasUnreadStatusUpdate) {
      setHasUnreadStatusUpdate(false);
    }
  }, [accountSection, hasUnreadStatusUpdate]);

  // 1-second live timer for 15-minute cancellation countdown
  useEffect(() => {
    if (!isOpen || !customer || accountSection !== 'order_history') return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, customer, accountSection]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalPhoneError(null);
    const cleanPhone = normalizeEgyptianPhoneInput(identifier);
    if (cleanPhone !== identifier) {
      setIdentifier(cleanPhone);
    }
    if (!isValidEgyptianPhone(cleanPhone)) {
      setLocalPhoneError(EGYPTIAN_PHONE_ERROR_AR);
      return;
    }
    await onLogin(cleanPhone, loginPassword);
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalPhoneError(null);
    const cleanPhone = normalizeEgyptianPhoneInput(phone);
    if (cleanPhone !== phone) {
      setPhone(cleanPhone);
    }
    if (!isValidEgyptianPhone(cleanPhone)) {
      setLocalPhoneError(EGYPTIAN_PHONE_ERROR_AR);
      return;
    }
    await onSignup({
      name,
      phone: cleanPhone,
      address,
      password: signupPassword,
    });
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setLocalPhoneError(null);
    const cleanPhone = normalizeEgyptianPhoneInput(editPhone);
    if (cleanPhone !== editPhone) {
      setEditPhone(cleanPhone);
    }
    if (!isValidEgyptianPhone(cleanPhone)) {
      setLocalPhoneError(EGYPTIAN_PHONE_ERROR_AR);
      return;
    }
    const ok = await onUpdateProfile({
      id: customer.id,
      name: editName,
      phone: cleanPhone,
      address: editAddress,
    });
    if (ok) {
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    }
  };

  const handleRepeatOrderClick = (order: OnlineOrder) => {
    onRepeatOrder(order.items);
    setRepeatedOrderId(order.id);
  };

  const formatOrderDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-modal-backdrop"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[#1E1E1E] border border-[#D4AF37] max-w-2xl w-full overflow-hidden shadow-2xl my-8 animate-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Instant Order Status Toast Notifications Stack */}
        {statusToasts.length > 0 && (
          <div
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-md space-y-2 pointer-events-none"
          >
            {statusToasts.map((toast) => {
              const style = getOrderStatusStyle(toast.newStatus);
              const ToastIcon = toast.variant === 'error' ? AlertTriangle : style.Icon;
              const borderHighlight =
                toast.variant === 'error'
                  ? 'border-red-500 bg-[#241212]'
                  : toast.variant === 'cancel_success'
                    ? 'border-amber-400 bg-[#1F1A10]'
                    : `border-[#D4AF37] bg-[#171717]`;

              return (
                <div
                  key={toast.id}
                  role="status"
                  className={`pointer-events-auto border-2 shadow-2xl p-3.5 flex items-start justify-between gap-3 transition-all ${borderHighlight}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSection('order_history');
                      setOrderStatusFilter('all');
                      setHasUnreadStatusUpdate(false);
                      setStatusToasts((prev) => prev.filter((item) => item.id !== toast.id));
                    }}
                    className="flex items-start gap-2.5 text-start flex-1 min-w-0 cursor-pointer"
                  >
                    <div className={`p-2 border shrink-0 ${style.cls}`}>
                      <ToastIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#D4AF37]">
                        <Bell className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                        <span>{t.statusToastTitle}</span>
                      </div>
                      {toast.customMessage ? (
                        <p className="text-xs text-[#F7F3E9] leading-snug">
                          <span className="font-mono font-bold text-[#D4AF37] me-1">
                            #{toast.orderId}
                          </span>
                          {toast.customMessage}
                        </p>
                      ) : (
                        <p className="text-xs text-[#F7F3E9] leading-snug">
                          {t.statusToastPrefix}{' '}
                          <span className="font-mono font-bold text-[#D4AF37]">
                            #{toast.orderId}
                          </span>
                          :{' '}
                          {toast.prevStatus && (
                            <>
                              <span className="text-[#9E9585] line-through">
                                {t.orderStatuses[toast.prevStatus]}
                              </span>{' '}
                              <span className="text-[#D4AF37]">{t.statusToastArrow}</span>{' '}
                            </>
                          )}
                          <span className={`font-bold ${style.textCls}`}>
                            {t.orderStatuses[toast.newStatus]}
                          </span>
                        </p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() =>
                      setStatusToasts((prev) => prev.filter((item) => item.id !== toast.id))
                    }
                    className="p-1 text-[#9E9585] hover:text-[#F7F3E9] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Header */}
        <div className="bg-[#121212] px-6 py-4 border-b border-[#D4AF37]/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-display-serif text-xl sm:text-2xl font-bold text-[#F7F3E9]">
              {customer ? `${t.customerGreeting} ${customer.name}` : t.loginTab}
            </h3>
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

        <div className="p-6 max-h-[82vh] overflow-y-auto">
          {customer ? (
            /* Logged-in Customer Account View */
            <div className="space-y-6">
              {/* Sub-navigation Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D4AF37]/20 pb-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountSection('profile')}
                    className={`px-3.5 py-2 text-xs font-bold cursor-pointer border transition-colors ${
                      accountSection === 'profile'
                        ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                        : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    {t.profileTab}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountSection('favorites')}
                    className={`px-3.5 py-2 text-xs font-bold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                      accountSection === 'favorites'
                        ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                        : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>{t.favoritesTab} ({favoriteDishes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountSection('order_history');
                      setHasUnreadStatusUpdate(false);
                    }}
                    className={`px-3.5 py-2 text-xs font-bold cursor-pointer border flex items-center gap-1.5 transition-colors relative ${
                      accountSection === 'order_history'
                        ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                        : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{t.orderHistoryTab} ({customerOrders.length})</span>
                    {hasUnreadStatusUpdate && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountSection('reservations')}
                    className={`px-3.5 py-2 text-xs font-bold cursor-pointer border flex items-center gap-1.5 transition-colors ${
                      accountSection === 'reservations'
                        ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                        : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30 hover:border-[#D4AF37]/60'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{t.reservationsTab} ({customerReservations.length})</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="px-3 py-1.5 bg-red-950/50 border border-red-500/40 text-red-300 hover:bg-red-900/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t.logoutBtn}</span>
                </button>
              </div>

              {accountSection === 'profile' && (
                <form
                  onSubmit={handleProfileUpdate}
                  className="bg-[#121212] border border-[#D4AF37]/25 p-5 space-y-4"
                >
                  {(localPhoneError || authError) && (
                    <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
                      {localPhoneError || authError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">{t.nameLabel}</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">{t.phoneLabel}</label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        required
                        dir="ltr"
                        value={editPhone}
                        onChange={(e) => {
                          setEditPhone(normalizeEgyptianPhoneInput(e.target.value));
                          if (localPhoneError) setLocalPhoneError(null);
                        }}
                        className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">{t.addressLabel}</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder={t.addressPlaceholder}
                      className="w-full px-3 py-2 bg-[#1E1E1E] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="px-5 py-2.5 bg-[#D4AF37] text-[#121212] font-bold text-xs cursor-pointer"
                    >
                      {t.saveProfileBtn}
                    </button>
                    {savedNotice && (
                      <span className="text-xs text-[#10B981] flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {t.profileSaved}
                      </span>
                    )}
                  </div>
                </form>
              )}

              {accountSection === 'favorites' && (
                <div>
                  {favoriteDishes.length === 0 ? (
                    <p className="text-xs text-[#9E9585] bg-[#121212] border border-[#D4AF37]/20 p-6 text-center">
                      {t.noFavoritesYet}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {favoriteDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="bg-[#121212] border border-[#D4AF37]/30 p-3 flex items-center gap-3 justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <ResilientImage
                              src={dish.imageUrl}
                              alt={dish.titleAr}
                              className="w-14 h-14 object-cover border border-[#D4AF37]/30 shrink-0"
                            />
                            <div>
                              <h5 className="font-bold text-xs sm:text-sm text-[#F7F3E9]">
                                {lang === 'ar' ? dish.titleAr : dish.titleEn}
                              </h5>
                              <span className="text-xs text-[#D4AF37] font-bold">
                                {dish.price} {currency}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onAddToCart(dish)}
                              className="px-2.5 py-1.5 bg-[#D4AF37] text-[#121212] text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleFavorite(dish.id)}
                              className="px-2 py-1.5 bg-red-950/40 border border-red-500/30 text-red-300 text-xs cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {accountSection === 'order_history' && (() => {
                const statusTabs: Array<'all' | BookingStatus> = [
                  'all',
                  'pending',
                  'preparing',
                  'confirmed',
                  'completed',
                  'cancelled',
                ];
                const filteredOrders =
                  orderStatusFilter === 'all'
                    ? customerOrders
                    : customerOrders.filter((o) => o.status === orderStatusFilter);

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-[#D4AF37] flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        <span>{t.myOrdersTitle}</span>
                      </h4>
                      {repeatedOrderId && (
                        <button
                          type="button"
                          onClick={onOpenCheckout}
                          className="px-3 py-1.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <span>{t.proceedCheckoutBtn}</span>
                          {lang === 'ar' ? (
                            <ArrowLeft className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Mini Recharts Dashboard for Total Orders & Total Spending */}
                    <CustomerOrderMiniDashboard orders={customerOrders} lang={lang} />

                    {/* Visual Status Filter Tabs (All, Pending, Preparing, Delivered) */}
                    {customerOrders.length > 0 && (
                      <div
                        role="tablist"
                        aria-label={t.myOrdersTitle}
                        className="flex flex-wrap gap-1.5 border-b border-[#D4AF37]/20 pb-3"
                      >
                        {statusTabs.map((statusKey) => {
                          const count =
                            statusKey === 'all'
                              ? customerOrders.length
                              : customerOrders.filter((o) => o.status === statusKey).length;
                          const isCoreTab =
                            statusKey === 'all' ||
                            statusKey === 'pending' ||
                            statusKey === 'preparing' ||
                            statusKey === 'completed';
                          if (!isCoreTab && count === 0 && orderStatusFilter !== statusKey) {
                            return null;
                          }
                          const isSelected = orderStatusFilter === statusKey;
                          const style =
                            statusKey === 'all' ? null : getOrderStatusStyle(statusKey);

                          return (
                            <button
                              key={statusKey}
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              onClick={() => setOrderStatusFilter(statusKey)}
                              className={`px-3 py-1.5 text-[11px] font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${
                                isSelected
                                  ? style
                                    ? `${style.cls}`
                                    : 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                                  : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]/60'
                              }`}
                            >
                              {style && (
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${style.dotCls} ${
                                    style.isActive ? 'animate-pulse' : ''
                                  }`}
                                />
                              )}
                              <span>
                                {statusKey === 'all'
                                  ? t.allOrdersFilter
                                  : t.orderStatuses[statusKey]}
                              </span>
                              <span className="font-mono text-[10px] opacity-80">
                                ({count})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {customerOrders.length === 0 ? (
                      <p className="text-xs text-[#9E9585] bg-[#121212] border border-[#D4AF37]/20 p-6 text-center">
                        {t.noOrdersYet}
                      </p>
                    ) : filteredOrders.length === 0 ? (
                      <p className="text-xs text-[#9E9585] bg-[#121212] border border-[#D4AF37]/20 p-6 text-center">
                        {t.noFilteredOrders}
                      </p>
                    ) : (
                      <div className="space-y-3.5">
                        {filteredOrders.map((o) => {
                          const {
                            cls,
                            cardCls,
                            dotCls,
                            barCls,
                            textCls,
                            bannerCls,
                            isActive,
                            step,
                            Icon,
                          } = getOrderStatusStyle(o.status);
                          const statusLabel = t.orderStatuses[o.status] || o.status;
                          const statusHint = t.orderStatusHints[o.status] || '';
                          const wasJustRepeated = repeatedOrderId === o.id;
                          const progressSteps = [
                            { num: 1 as const, label: t.orderStatuses.pending, StepIcon: Clock },
                            { num: 2 as const, label: t.orderStatuses.preparing, StepIcon: ChefHat },
                            { num: 3 as const, label: t.orderStatuses.completed, StepIcon: Truck },
                          ];
                          const createdAtMs = new Date(o.createdAt).getTime();
                          const elapsedMs = Number.isNaN(createdAtMs)
                            ? ORDER_CANCEL_WINDOW_MS + 1
                            : Math.max(0, nowMs - createdAtMs);
                          const remainingCancelMs = Math.max(0, ORDER_CANCEL_WINDOW_MS - elapsedMs);
                          const canCancelOrder =
                            o.status !== 'cancelled' &&
                            o.status !== 'completed' &&
                            remainingCancelMs > 0;
                          const cancelWindowExpired =
                            o.status !== 'cancelled' &&
                            o.status !== 'completed' &&
                            remainingCancelMs <= 0;

                          return (
                            <div
                              key={o.id}
                              className={`border p-4 space-y-3 transition-colors ${cardCls}`}
                            >
                              {/* Header row: ID, Date, Service type + High-contrast Status badge */}
                              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#D4AF37]/15 pb-2.5">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-[#D4AF37]">
                                      #{o.id}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 bg-[#1E1E1E] border border-[#D4AF37]/25 text-[#C9C1B1]">
                                      {o.serviceType === 'delivery' ? t.deliveryLabel : t.takeawayLabel}
                                    </span>
                                    {canCancelOrder && (
                                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-950/50 border border-amber-500/40 text-amber-300 font-mono">
                                        <Timer className="w-3 h-3 shrink-0" />
                                        <span>
                                          {t.cancelWindowRemaining}:{' '}
                                          {formatRemainingCountdown(remainingCancelMs)}
                                        </span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-[#9E9585] mt-1">
                                    {formatOrderDate(o.createdAt)}
                                  </p>
                                </div>

                                <span
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 border text-xs font-bold shadow-sm ${cls}`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${dotCls} ${
                                      isActive ? 'animate-pulse' : ''
                                    }`}
                                  />
                                  <Icon className="w-3.5 h-3.5 shrink-0" />
                                  <span>{statusLabel}</span>
                                </span>
                              </div>

                              {/* Visual Order Progress Tracker / Cancelled Strip */}
                              {o.status === 'cancelled' ? (
                                <div
                                  className={`px-3 py-2 border text-[11px] font-semibold space-y-1 ${bannerCls}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <XCircle className="w-4 h-4 shrink-0 text-red-400" />
                                    <span>
                                      {o.cancelledBy === 'customer'
                                        ? t.cancelledByCustomerTag
                                        : statusHint}
                                    </span>
                                  </div>
                                  {o.cancellationReason && (
                                    <p className="text-[11px] text-red-200/80 ps-6">
                                      {o.cancellationReason}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className={`px-3 py-2.5 border space-y-2 ${bannerCls}`}>
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className={`font-bold flex items-center gap-1.5 ${textCls}`}>
                                      <Icon className="w-3.5 h-3.5 shrink-0" />
                                      <span>{statusHint}</span>
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {progressSteps.map(({ num, label, StepIcon }) => {
                                      const reached = step >= num;
                                      const current = step === num;
                                      return (
                                        <div key={`${o.id}-step-${num}`} className="space-y-1">
                                          <div
                                            className={`h-1.5 w-full transition-colors ${
                                              reached ? barCls : 'bg-[#2A2620]'
                                            } ${current && isActive ? 'animate-pulse' : ''}`}
                                          />
                                          <div
                                            className={`flex items-center gap-1 text-[10px] font-semibold ${
                                              current
                                                ? textCls
                                                : reached
                                                  ? 'text-[#F7F3E9]'
                                                  : 'text-[#7A7164]'
                                            }`}
                                          >
                                            <StepIcon className="w-3 h-3 shrink-0" />
                                            <span className="truncate">{label}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Items breakdown */}
                              <ul className="space-y-1.5 text-xs">
                              {o.items.map((item) => (
                                <li
                                  key={`${o.id}-${item.menuItemId}`}
                                  className="flex items-center justify-between gap-2 text-[#F7F3E9]"
                                >
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span className="px-1.5 py-0.5 bg-[#1E1E1E] border border-[#D4AF37]/25 text-[#D4AF37] font-mono text-[11px] font-bold shrink-0">
                                      ×{item.quantity}
                                    </span>
                                    <span className="truncate">
                                      {lang === 'ar' ? item.titleAr : item.titleEn}
                                    </span>
                                  </span>
                                  <span className="text-[#C9C1B1] tabular-nums shrink-0">
                                    {item.price * item.quantity} {currency}
                                  </span>
                                </li>
                              ))}
                            </ul>

                            {/* Footer row: Total + Cancel (within 15 min) + Rate + Repeat Order buttons */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#D4AF37]/15 pt-3">
                              <div className="space-y-0.5">
                                <div className="text-xs">
                                  <span className="text-[#9E9585] me-1.5">
                                    {lang === 'ar' ? 'الإجمالي:' : 'Total:'}
                                  </span>
                                  <span className="font-bold text-sm text-[#D4AF37] tabular-nums">
                                    {o.totalAmount} {currency}
                                  </span>
                                </div>
                                {cancelWindowExpired && (
                                  <p className="text-[10px] text-[#7A7164] flex items-center gap-1">
                                    <Timer className="w-3 h-3 shrink-0" />
                                    <span>{t.cancelWindowExpired}</span>
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                {wasJustRepeated && (
                                  <span className="text-[11px] text-[#10B981] font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t.repeatOrderAdded}
                                  </span>
                                )}
                                {canCancelOrder && cancellingOrderId !== o.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCancellingOrderId(o.id);
                                      setCancelReason('');
                                      setCancelError(null);
                                      setRatingOrderId(null);
                                    }}
                                    className="px-3 py-2 bg-red-950/50 hover:bg-red-900/70 border border-red-500/50 text-red-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>{t.cancelOrderBtn}</span>
                                  </button>
                                )}
                                {ratingOrderId !== o.id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRatingOrderId(o.id);
                                      setCancellingOrderId(null);
                                      setRatingValue(o.rating || 5);
                                      setRatingHoverValue(null);
                                      setRatingComment(o.ratingComment || '');
                                    }}
                                    className="px-3 py-2 bg-[#1E1E1E] hover:bg-[#2A2518] border border-[#D4AF37]/45 hover:border-[#D4AF37] text-[#D4AF37] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                  >
                                    {o.rating ? (
                                      <Pencil className="w-3.5 h-3.5" />
                                    ) : (
                                      <Star className="w-3.5 h-3.5" />
                                    )}
                                    <span>{o.rating ? t.editRatingBtn : t.rateOrderBtn}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRepeatOrderClick(o)}
                                  className="px-3.5 py-2 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{t.repeatOrderBtn}</span>
                                </button>
                              </div>
                            </div>

                            {/* Inline 15-Minute Order Cancellation Confirmation */}
                            {cancellingOrderId === o.id && (
                              <form
                                onSubmit={async (e) => {
                                  e.preventDefault();
                                  if (isSubmittingCancel) return;
                                  setCancelError(null);
                                  setIsSubmittingCancel(true);
                                  selfCancelledIdsRef.current.add(o.id);
                                  try {
                                    const result = await onCancelOrder(o.id, cancelReason);
                                    if (result.ok) {
                                      pushToast({
                                        orderId: o.id,
                                        newStatus: 'cancelled',
                                        customMessage: 'تم الإلغاء وإخطار إدارة المطعم',
                                        variant: 'cancel_success',
                                      });
                                      setCancellingOrderId(null);
                                      setCancelReason('');
                                      setCancelError(null);
                                    } else {
                                      selfCancelledIdsRef.current.delete(o.id);
                                      const errMessage =
                                        result.error ||
                                        (result.reason === 'expired'
                                          ? t.cancelExpiredError
                                          : 'تعذر إلغاء الطلب حالياً، يرجى المحاولة مرة أخرى.');
                                      setCancelError(errMessage);
                                      pushToast({
                                        orderId: o.id,
                                        newStatus: o.status,
                                        customMessage: errMessage,
                                        variant: 'error',
                                      });
                                      if (result.reason === 'expired' || result.reason === 'already_final') {
                                        setCancellingOrderId(null);
                                      }
                                    }
                                  } catch {
                                    selfCancelledIdsRef.current.delete(o.id);
                                    const errMessage =
                                      'تعذر الاتصال بقاعدة البيانات لإلغاء الطلب. يرجى المحاولة مرة أخرى.';
                                    setCancelError(errMessage);
                                    pushToast({
                                      orderId: o.id,
                                      newStatus: o.status,
                                      customMessage: errMessage,
                                      variant: 'error',
                                    });
                                  } finally {
                                    setIsSubmittingCancel(false);
                                  }
                                }}
                                className="bg-red-950/30 border border-red-500/45 p-3.5 space-y-3"
                              >
                                <div className="flex items-start gap-2 text-red-200">
                                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-bold">{t.cancelConfirmTitle}</p>
                                    <p className="text-[11px] text-red-200/80">
                                      {t.cancelConfirmDesc}
                                    </p>
                                  </div>
                                </div>

                                {cancelError && (
                                  <div
                                    role="alert"
                                    className="p-2.5 bg-red-950/80 border border-red-500 text-red-200 text-[11px] font-bold"
                                  >
                                    {cancelError}
                                  </div>
                                )}

                                <div>
                                  <label className="block text-[11px] text-[#C9C1B1] mb-1">
                                    {t.cancelReasonLabel}
                                  </label>
                                  <input
                                    type="text"
                                    maxLength={180}
                                    disabled={isSubmittingCancel}
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder={t.cancelReasonPlaceholder}
                                    className="w-full px-3 py-2 bg-[#121212] border border-red-500/35 focus:border-red-400 focus:outline-none text-[#F7F3E9] text-xs disabled:opacity-60"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    disabled={isSubmittingCancel}
                                    onClick={() => {
                                      setCancellingOrderId(null);
                                      setCancelReason('');
                                      setCancelError(null);
                                    }}
                                    className="px-3 py-1.5 bg-[#121212] border border-[#D4AF37]/30 text-[#C9C1B1] hover:text-[#F7F3E9] text-xs font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    {t.keepOrderBtn}
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isSubmittingCancel}
                                    className="px-4 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                                  >
                                    {isSubmittingCancel
                                      ? lang === 'ar'
                                        ? 'جاري الإلغاء...'
                                        : 'Cancelling...'
                                      : t.confirmCancelBtn}
                                  </button>
                                </div>
                              </form>
                            )}

                            {/* Existing Submitted Rating Display */}
                            {o.rating && ratingOrderId !== o.id && (
                              <div className="bg-[#1A1710] border border-[#D4AF37]/30 p-3 space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-[#C9C1B1]">
                                      {t.yourRatingLabel}:
                                    </span>
                                    <div
                                      className="flex items-center gap-0.5"
                                      aria-label={`${o.rating} / 5`}
                                    >
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                          key={`display-${o.id}-${star}`}
                                          className={`w-3.5 h-3.5 ${
                                            star <= (o.rating || 0)
                                              ? 'fill-[#D4AF37] text-[#D4AF37]'
                                              : 'text-[#4A4338]'
                                          }`}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-[#D4AF37]">
                                      {o.rating}/5
                                    </span>
                                  </div>
                                  {justRatedOrderId === o.id && (
                                    <span className="text-[11px] text-[#10B981] font-bold flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      {t.ratingSavedBadge}
                                    </span>
                                  )}
                                </div>
                                {o.ratingComment && (
                                  <p className="text-xs text-[#F7F3E9] leading-relaxed">
                                    “{o.ratingComment}”
                                  </p>
                                )}
                              </div>
                            )}

                            {/* Inline Rating & Short Comment Form */}
                            {ratingOrderId === o.id && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  onRateOrder(o.id, ratingValue, ratingComment);
                                  setRatingOrderId(null);
                                  setRatingHoverValue(null);
                                  setJustRatedOrderId(o.id);
                                  setTimeout(() => {
                                    setJustRatedOrderId((prev) => (prev === o.id ? null : prev));
                                  }, 3000);
                                }}
                                className="bg-[#1A1710] border border-[#D4AF37]/45 p-3.5 space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-[#D4AF37]">
                                    {t.ratingStarsLabel}
                                  </span>
                                  <div
                                    className="flex items-center gap-1"
                                    onMouseLeave={() => setRatingHoverValue(null)}
                                  >
                                    {[1, 2, 3, 4, 5].map((star) => {
                                      const activeStars = ratingHoverValue ?? ratingValue;
                                      const isFilled = star <= activeStars;
                                      return (
                                        <button
                                          key={`rate-${o.id}-${star}`}
                                          type="button"
                                          aria-label={`${star} / 5`}
                                          aria-pressed={ratingValue === star}
                                          onMouseEnter={() => setRatingHoverValue(star)}
                                          onClick={() => setRatingValue(star)}
                                          className="p-1 cursor-pointer transition-transform hover:scale-110"
                                        >
                                          <Star
                                            className={`w-5 h-5 transition-colors ${
                                              isFilled
                                                ? 'fill-[#D4AF37] text-[#D4AF37]'
                                                : 'text-[#6E6558] hover:text-[#D4AF37]/60'
                                            }`}
                                          />
                                        </button>
                                      );
                                    })}
                                    <span className="text-xs font-mono font-bold text-[#D4AF37] ms-1.5">
                                      {ratingValue}/5
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[11px] text-[#C9C1B1] mb-1">
                                    {t.ratingCommentLabel}
                                  </label>
                                  <textarea
                                    rows={2}
                                    maxLength={240}
                                    value={ratingComment}
                                    onChange={(e) => setRatingComment(e.target.value)}
                                    placeholder={t.ratingCommentPlaceholder}
                                    className="w-full px-3 py-2 bg-[#121212] border border-[#D4AF37]/35 focus:border-[#D4AF37] focus:outline-none text-[#F7F3E9] text-xs"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRatingOrderId(null);
                                      setRatingHoverValue(null);
                                    }}
                                    className="px-3 py-1.5 bg-[#121212] border border-[#D4AF37]/30 text-[#C9C1B1] hover:text-[#F7F3E9] text-xs font-semibold cursor-pointer"
                                  >
                                    {t.cancelRatingBtn}
                                  </button>
                                  <button
                                    type="submit"
                                    className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] text-xs font-bold cursor-pointer"
                                  >
                                    {t.submitRatingBtn}
                                  </button>
                                </div>
                              </form>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                );
              })()}

              {accountSection === 'reservations' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs sm:text-sm text-[#D4AF37] flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{t.myReservationsTitle}</span>
                  </h4>
                  {customerReservations.length === 0 ? (
                    <p className="text-xs text-[#9E9585] bg-[#121212] border border-[#D4AF37]/20 p-6 text-center">
                      {t.noReservationsYet}
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {customerReservations.map((r) => {
                        const { cls, cardCls, dotCls, isActive, Icon } = getOrderStatusStyle(r.status);
                        const statusLabel =
                          getTranslations(lang).admin.statuses[r.status] || r.status;
                        return (
                          <div
                            key={r.id}
                            className={`border p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs ${cardCls}`}
                          >
                            <div>
                              <span className="font-mono font-bold text-[#D4AF37]">#{r.id}</span>
                              <p className="text-[#F7F3E9] mt-1">
                                {r.date} · {r.time} ({r.guests}{' '}
                                {lang === 'ar' ? 'أفراد' : 'guests'})
                              </p>
                            </div>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 border text-[11px] font-bold ${cls}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotCls} ${
                                  isActive ? 'animate-pulse' : ''
                                }`}
                              />
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{statusLabel}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Login / Signup Tabs */
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 bg-[#121212] p-1.5 border border-[#D4AF37]/25">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className={`py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    tab === 'login'
                      ? 'bg-[#D4AF37] text-[#121212]'
                      : 'text-[#C9C1B1] hover:text-[#F7F3E9]'
                  }`}
                >
                  {t.loginTab}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className={`py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    tab === 'signup'
                      ? 'bg-[#D4AF37] text-[#121212]'
                      : 'text-[#C9C1B1] hover:text-[#F7F3E9]'
                  }`}
                >
                  {t.signupTab}
                </button>
              </div>

              {(localPhoneError || authError) && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs">
                  {localPhoneError || authError}
                </div>
              )}

              {tab === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {t.identifierLabel}
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        required
                        dir="ltr"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(normalizeEgyptianPhoneInput(e.target.value));
                          if (localPhoneError) setLocalPhoneError(null);
                        }}
                        placeholder={t.identifierPlaceholder}
                        className="w-full pr-9 pl-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {t.passwordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                      <input
                        type="password"
                        required
                        dir="ltr"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder={t.passwordPlaceholder}
                        className="w-full pr-9 pl-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#D4AF37] bg-[#121212] p-2.5 border border-[#D4AF37]/20">
                    {t.signInPrompt}
                  </p>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm cursor-pointer"
                  >
                    {authLoading ? '...' : t.loginBtn}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignupSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">{t.nameLabel} *</label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pr-9 pl-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1">{t.phoneLabel} *</label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={11}
                          required
                          dir="ltr"
                          value={phone}
                          onChange={(e) => {
                            setPhone(normalizeEgyptianPhoneInput(e.target.value));
                            if (localPhoneError) setLocalPhoneError(null);
                          }}
                          placeholder={t.identifierPlaceholder}
                          className="w-full pr-9 pl-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">{t.addressLabel}</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={t.addressPlaceholder}
                        className="w-full pr-9 pl-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1">{t.passwordLabel} *</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#D4AF37] absolute top-3 right-3" />
                      <input
                        type="password"
                        required
                        dir="ltr"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full pr-9 pl-3 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3.5 bg-[#D4AF37] hover:bg-[#e3be42] text-[#121212] font-bold text-sm cursor-pointer"
                  >
                    {authLoading ? '...' : t.signupBtn}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
