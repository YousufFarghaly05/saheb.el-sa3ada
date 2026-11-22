import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Truck,
  CheckCircle2,
  MessageCircle,
  Wallet,
  Banknote,
  Copy,
  Check,
  Smartphone,
  MapPin,
} from 'lucide-react';
import type {
  BranchConfig,
  BranchId,
  CartItem,
  CustomerUser,
  Lang,
  OnlineOrder,
  PaymentMethod,
} from '../types.ts';
import { doc, getDoc } from 'firebase/firestore';
import { BRANCH_CONFIGS, BRANCH_ORDER } from '../data/initialData.ts';
import { getTranslations } from '../i18n/translations.ts';
import { db, logFirestoreError, OperationType } from '../firebase.ts';
import {
  BLOCKED_PHONE_ERROR_AR,
  EGYPTIAN_PHONE_ERROR_AR,
  isValidEgyptianPhone,
  normalizeEgyptianPhoneInput,
} from '../utils/egyptianPhone.ts';

interface BookingOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Lang;
  activeBranch: BranchId;
  branchConfig: BranchConfig;
  branchConfigs?: Record<BranchId, BranchConfig>;
  onSwitchBranch: (branchId: BranchId) => void;
  cart: CartItem[];
  customer: CustomerUser | null;
  onUpdateQty: (menuItemId: string, delta: number) => void;
  onClearCart: () => void;
  onSubmitOrder: (
    entry: Omit<OnlineOrder, 'id' | 'status' | 'createdAt' | 'branchId'>
  ) => OnlineOrder;
}

export const BookingOrderModal: React.FC<BookingOrderModalProps> = ({
  isOpen,
  onClose,
  lang,
  activeBranch,
  branchConfig,
  branchConfigs = BRANCH_CONFIGS,
  onSwitchBranch,
  cart,
  customer,
  onUpdateQty,
  onClearCart,
  onSubmitOrder,
}) => {
  const t = getTranslations(lang).modal;
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceType, setServiceType] = useState<'delivery' | 'takeaway'>('delivery');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Two Payment Methods ONLY: Cash/POS on Delivery or Instant Transfer (Vodafone Cash / InstaPay)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_on_delivery');
  const [transferSender, setTransferSender] = useState('');
  const [copiedField, setCopiedField] = useState<'vf' | 'instapay' | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [submittedWhatsAppUrl, setSubmittedWhatsAppUrl] = useState<string | null>(null);
  const [submittedRefId, setSubmittedRefId] = useState<string | null>(null);
  const [submittedPaymentSummary, setSubmittedPaymentSummary] = useState<string>('');

  useEffect(() => {
    setSubmittedWhatsAppUrl(null);
    setSubmittedRefId(null);
    setValidationError(null);
    setIsCheckingPhone(false);
  }, [isOpen, branchConfig.id]);

  useEffect(() => {
    if (customer) {
      setCustomerName(customer.name || '');
      setPhone(normalizeEgyptianPhoneInput(customer.phone || ''));
      setAddress(customer.address || '');
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const cartTotal = cart.reduce((acc, c) => acc + c.price * c.quantity, 0);
  const payableAmount = cartTotal;
  const branchShort = lang === 'ar' ? branchConfig.shortNameAr : branchConfig.shortNameEn;

  const handleCopy = (value: string, field: 'vf' | 'instapay') => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField((prev) => (prev === field ? null : prev));
    }, 1800);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCheckingPhone) return;
    setValidationError(null);

    if (!customerName.trim()) {
      setValidationError(t.validationName);
      return;
    }

    const cleanPhone = normalizeEgyptianPhoneInput(phone);
    if (cleanPhone !== phone) {
      setPhone(cleanPhone);
    }

    if (!isValidEgyptianPhone(cleanPhone)) {
      setValidationError(EGYPTIAN_PHONE_ERROR_AR);
      return;
    }

    if (cart.length === 0) {
      setValidationError(t.validationCart);
      return;
    }
    if (serviceType === 'delivery' && !address.trim()) {
      setValidationError(t.validationAddress);
      return;
    }
    if (paymentMethod === 'instapay_vodafone' && !transferSender.trim()) {
      setValidationError(t.validationTransferSender);
      return;
    }

    // Check Firestore blockedPhones blacklist before placing the order
    setIsCheckingPhone(true);
    try {
      const blockedSnap = await getDoc(doc(db, 'blockedPhones', cleanPhone));
      if (blockedSnap.exists()) {
        setValidationError(BLOCKED_PHONE_ERROR_AR);
        return;
      }
    } catch (err) {
      logFirestoreError(err, OperationType.GET, `blockedPhones/${cleanPhone}`);
    } finally {
      setIsCheckingPhone(false);
    }

    const nowTime = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const isTransfer = paymentMethod === 'instapay_vodafone';
    const createdOrder = onSubmitOrder({
      customerId: customer?.id,
      customerName: customerName.trim(),
      phone: cleanPhone,
      serviceType,
      address:
        serviceType === 'delivery'
          ? address.trim()
          : `استلام من الفرع - ${branchConfig.addressAr}`,
      requestedTime: nowTime,
      items: cart,
      totalAmount: cartTotal,
      paymentMethod,
      paymentStatus: isTransfer ? 'transfer_submitted' : 'pending_cod',
      transferSender: isTransfer ? transferSender.trim() : undefined,
      notes: notes.trim(),
    });

    const itemsLines = cart
      .map((c) => `• ${c.titleAr} (×${c.quantity}) = ${c.price * c.quantity} ج.م`)
      .join('\n');

    const paymentLine = isTransfer
      ? `تحويل فوري (${branchConfig.vodafoneCash} / ${branchConfig.instapay}) — الرقم المُحوَّل منه: ${transferSender.trim()}`
      : 'الدفع عند الاستلام (كاش أو فيزا مع المندوب)';

    const waLines = [
      `[${branchConfig.shortNameAr}]`,
      `🍽️ *طلب أونلاين جديد - مطعم وكافيه صاحب السعادة (${branchConfig.shortNameAr})* 🍽️`,
      `العنوان: ${branchConfig.addressAr}`,
      `رقم الطلب: ${createdOrder.id}`,
      `الاسم: ${createdOrder.customerName}`,
      `الهاتف: ${createdOrder.phone}`,
      `نوع الاستلام: ${
        serviceType === 'delivery' ? 'توصيل للمنزل (Delivery)' : 'سفري من الفرع (Takeaway)'
      }`,
      serviceType === 'delivery' ? `عنوان العميل: ${createdOrder.address}` : '',
      `--- الأصناف ---`,
      itemsLines,
      `*الإجمالي:* ${cartTotal} ج.م (+ ١٢٪ خدمة و ١٤٪ ضريبة)`,
      `طريقة الدفع: ${paymentLine}`,
      isTransfer ? `📎 مرفق صورة إيصال التحويل في المحادثة` : '',
      notes.trim() ? `ملاحظات: ${notes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const waUrl = `https://wa.me/${branchConfig.whatsappIntl}?text=${encodeURIComponent(waLines)}`;
    setSubmittedRefId(createdOrder.id);
    setSubmittedPaymentSummary(paymentLine);
    setSubmittedWhatsAppUrl(waUrl);
    onClearCart();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="animate-modal-backdrop fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="animate-modal-panel bg-[#1E1E1E] border border-[#D4AF37] max-w-2xl w-full overflow-hidden shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar — Delivery/Takeaway Order Header + Active Branch Badge */}
        <div className="bg-[#121212] px-6 py-4 border-b border-[#D4AF37]/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 bg-[#D4AF37] text-[#121212]">
              <Truck className="w-4 h-4" />
              <span>{t.orderTab}</span>
              {cart.length > 0 && (
                <span className="px-1.5 py-0.5 text-[11px] bg-[#121212] text-[#D4AF37]">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>

            <span className="text-xs font-bold text-[#D4AF37] px-2">· {branchShort}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#C9C1B1] hover:text-[#D4AF37] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[82vh] overflow-y-auto">
          {submittedWhatsAppUrl ? (
            <div className="text-center py-8 space-y-5">
              <div className="w-16 h-16 bg-[#10B981]/15 border border-[#10B981] text-[#10B981] mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h3 className="font-display-serif text-2xl sm:text-3xl font-bold text-[#F7F3E9]">
                {t.successTitle}
              </h3>
              <p className="text-[#C9C1B1] text-sm max-w-md mx-auto leading-relaxed">
                {t.successOrderDesc}
              </p>

              <div className="bg-[#121212] border border-[#D4AF37]/30 p-4 max-w-md mx-auto text-xs text-[#C9C1B1] space-y-1.5">
                <div className="flex justify-between">
                  <span>{lang === 'ar' ? 'الفرع:' : 'Branch:'}</span>
                  <span className="text-[#D4AF37] font-bold">{branchShort}</span>
                </div>
                <div className="flex justify-between">
                  <span>{lang === 'ar' ? 'رقم المرجع:' : 'Reference ID:'}</span>
                  <span className="text-[#D4AF37] font-mono font-bold">{submittedRefId}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>{lang === 'ar' ? 'التفاصيل:' : 'Details:'}</span>
                  <span className="text-[#F7F3E9] font-bold text-end">{submittedPaymentSummary}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={submittedWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3.5 bg-[#10B981] hover:bg-[#0ea572] text-[#121212] font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-[0_0_25px_rgba(16,185,129,0.3)]"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>
                    {t.openWhatsappBtn} ({branchConfig.phone})
                  </span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3.5 bg-[#121212] border border-[#D4AF37]/40 text-[#F7F3E9] font-semibold text-sm cursor-pointer"
                >
                  {t.newBookingBtn}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* Branch Selection Strip Inside Order Modal */}
              <div className="bg-[#121212] border border-[#D4AF37]/35 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ar' ? 'اختر الفرع المطلوب للطلب:' : 'Select Branch:'}
                    </span>
                  </span>
                  {cart.length > 0 && (
                    <span className="text-[10px] text-[#9E9585]">
                      {lang === 'ar'
                        ? 'تغيير الفرع يفرغ السلة تلقائياً'
                        : 'Switching clears cart'}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {BRANCH_ORDER.map((bId) => {
                    const bCfg = branchConfigs[bId];
                    const isSelected = activeBranch === bId;
                    return (
                      <button
                        key={`modal-branch-${bId}`}
                        type="button"
                        onClick={() => onSwitchBranch(bId)}
                        className={`p-2.5 text-start border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37] font-bold'
                            : 'bg-[#1E1E1E] text-[#C9C1B1] border-[#D4AF37]/25 hover:border-[#D4AF37]'
                        }`}
                      >
                        <span className="text-xs font-bold block">
                          {lang === 'ar' ? bCfg.shortNameAr : bCfg.shortNameEn}
                        </span>
                        <span
                          className={`text-[10px] block truncate mt-0.5 ${
                            isSelected ? 'text-[#121212]/80' : 'text-[#9E9585]'
                          }`}
                        >
                          {lang === 'ar' ? bCfg.addressAr : bCfg.addressEn}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {validationError && (
                <div className="p-3 bg-red-950/60 border border-red-500/50 text-red-200 text-xs font-semibold">
                  {validationError}
                </div>
              )}

              {/* Order Cart Summary */}
              <div className="bg-[#121212] border border-[#D4AF37]/25 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-[#D4AF37]">
                      {t.cartSummary} — {branchShort}
                    </h4>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearCart}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'إفراغ السلة' : 'Clear'}</span>
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-xs text-[#9E9585] py-3 text-center">{t.emptyCart}</p>
                  ) : (
                    <div className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                      {cart.map((c) => {
                        const title = lang === 'ar' ? c.titleAr : c.titleEn || c.titleAr;
                        return (
                          <div
                            key={c.menuItemId}
                            className="flex items-center justify-between text-xs sm:text-sm border-b border-[#D4AF37]/15 pb-2"
                          >
                            <div>
                              <p className="text-[#F7F3E9] font-semibold">{title}</p>
                              <span className="text-[#D4AF37] text-xs tabular-nums">
                                {c.price * c.quantity} ج.م
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onUpdateQty(c.menuItemId, -1)}
                                className="w-6 h-6 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#F7F3E9] flex items-center justify-center cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-[#F7F3E9] font-bold w-5 text-center tabular-nums">
                                {c.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQty(c.menuItemId, 1)}
                                className="w-6 h-6 bg-[#1E1E1E] border border-[#D4AF37]/40 text-[#F7F3E9] flex items-center justify-center cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-2 flex items-center justify-between font-bold text-sm sm:text-base">
                        <span className="text-[#C9C1B1]">{t.totalLabel}:</span>
                        <span className="text-[#D4AF37] tabular-nums">{cartTotal} ج.م</span>
                      </div>
                      <p className="text-[11px] text-[#9E9585]">
                        {lang === 'ar'
                          ? 'يضاف ١٢٪ خدمة و ١٤٪ ضريبة طبقاً لقائمة الفرع'
                          : '12% service charge & 14% VAT apply per branch menu'}
                      </p>
                    </div>
                  )}
                </div>

              {/* Common Customer Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">{t.nameLabel} *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={t.namePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#C9C1B1] mb-1.5">{t.phoneLabel} *</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    required
                    dir="ltr"
                    value={phone}
                    onChange={(e) => {
                      setPhone(normalizeEgyptianPhoneInput(e.target.value));
                      if (validationError) setValidationError(null);
                    }}
                    placeholder={t.phonePlaceholder}
                    className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Delivery / Takeaway & Payment Fields */}
              <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-[#C9C1B1] mb-1.5">
                      {t.serviceTypeLabel}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setServiceType('delivery')}
                        className={`py-2.5 px-3 text-xs font-bold border transition-colors cursor-pointer ${
                          serviceType === 'delivery'
                            ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                            : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30'
                        }`}
                      >
                        {t.deliveryOption}
                      </button>
                      <button
                        type="button"
                        onClick={() => setServiceType('takeaway')}
                        className={`py-2.5 px-3 text-xs font-bold border transition-colors cursor-pointer ${
                          serviceType === 'takeaway'
                            ? 'bg-[#D4AF37] text-[#121212] border-[#D4AF37]'
                            : 'bg-[#121212] text-[#C9C1B1] border-[#D4AF37]/30'
                        }`}
                      >
                        {t.takeawayOption}
                      </button>
                    </div>
                  </div>

                  {serviceType === 'delivery' && (
                    <div>
                      <label className="block text-xs text-[#C9C1B1] mb-1.5">
                        {t.addressLabel} *
                      </label>
                      <input
                        type="text"
                        required
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={t.addressPlaceholder}
                        className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  )}

                  {/* Payment Method Section — STRICTLY 2 OPTIONS (No OTP / No Card / No CVV) */}
                  <div className="pt-2 border-t border-[#D4AF37]/20 space-y-4">
                    <label className="block text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
                      {t.paymentTitle}
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Cash / POS on Delivery */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('cash_on_delivery');
                          setValidationError(null);
                        }}
                        className={`p-3.5 border text-start flex items-start gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'cash_on_delivery'
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#F7F3E9] shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                            : 'bg-[#121212] border-[#D4AF37]/30 text-[#C9C1B1] hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <Banknote className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs sm:text-sm font-bold block">
                            {t.paymentMethods.cash_on_delivery}
                          </span>
                          <span className="text-[11px] text-[#9E9585] block mt-1 leading-relaxed">
                            {t.codDescription}
                          </span>
                        </div>
                      </button>

                      {/* Option 2: Instant Transfer (Vodafone Cash / InstaPay for Active Branch) */}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod('instapay_vodafone');
                          setValidationError(null);
                        }}
                        className={`p-3.5 border text-start flex items-start gap-3 transition-all cursor-pointer ${
                          paymentMethod === 'instapay_vodafone'
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#F7F3E9] shadow-[0_0_20px_rgba(212,175,55,0.2)]'
                            : 'bg-[#121212] border-[#D4AF37]/30 text-[#C9C1B1] hover:border-[#D4AF37]/60'
                        }`}
                      >
                        <Wallet className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs sm:text-sm font-bold block">
                            {t.paymentMethods.instapay_vodafone}
                          </span>
                          <span dir="ltr" className="text-[11px] text-[#9E9585] block mt-1 leading-relaxed">
                            {branchConfig.vodafoneCash} · {branchConfig.instapay}
                          </span>
                        </div>
                      </button>
                    </div>

                    {/* Branch-Specific Vodafone Cash & InstaPay Transfer Card */}
                    {paymentMethod === 'instapay_vodafone' && (
                      <div className="bg-gradient-to-br from-[#121212] via-[#18150E] to-[#121212] border-2 border-[#D4AF37] p-5 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
                        <div className="flex items-center justify-between border-b border-[#D4AF37]/30 pb-3">
                          <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
                            <Smartphone className="w-4 h-4" />
                            <span>
                              {lang === 'ar'
                                ? `بيانات التحويل الفوري — ${branchShort}`
                                : `Instant Transfer Details — ${branchShort}`}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 bg-[#D4AF37] text-[#121212] font-bold text-[11px]">
                            INSTAPAY / VF CASH
                          </span>
                        </div>

                        {/* Prominent Total Amount */}
                        <div className="bg-[#1E1E1E] border border-[#D4AF37]/50 p-3.5 flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-[#C9C1B1] font-semibold">
                            {t.transferAmountLabel}:
                          </span>
                          <span className="text-xl sm:text-2xl font-bold text-[#D4AF37] tabular-nums">
                            {payableAmount} {lang === 'ar' ? 'ج.م' : 'EGP'}
                          </span>
                        </div>

                        {/* Branch-specific Vodafone Cash & InstaPay Copy Rows */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-[#121212] border border-[#D4AF37]/40 p-3 flex items-center justify-between gap-2">
                            <div>
                              <span className="text-[11px] text-[#9E9585] block">
                                {t.vodafoneCashLabel}
                              </span>
                              <span
                                className="text-sm sm:text-base font-mono font-bold text-[#F7F3E9] select-all"
                                dir="ltr"
                              >
                                {branchConfig.vodafoneCash}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(branchConfig.vodafoneCash, 'vf')}
                              className="px-2.5 py-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border border-[#D4AF37]/50 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            >
                              {copiedField === 'vf' ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t.copiedBtn}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>{t.copyBtn}</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="bg-[#121212] border border-[#D4AF37]/40 p-3 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[11px] text-[#9E9585] block">
                                {t.instapayLabel}
                              </span>
                              <span
                                className="text-xs sm:text-sm font-mono font-bold text-[#D4AF37] truncate block select-all"
                                dir="ltr"
                              >
                                {branchConfig.instapay}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopy(branchConfig.instapay, 'instapay')}
                              className="px-2.5 py-1.5 bg-[#D4AF37]/15 hover:bg-[#D4AF37] text-[#D4AF37] hover:text-[#121212] border border-[#D4AF37]/50 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                            >
                              {copiedField === 'instapay' ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t.copiedBtn}</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>{t.copyBtn}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Single Input Field: Sender Phone */}
                        <div>
                          <label className="block text-xs font-bold text-[#F7F3E9] mb-1.5">
                            {lang === 'ar'
                              ? 'رقم الهاتف المُحوَّل منه للتأكيد *'
                              : 'Sender Phone Number for Confirmation *'}
                          </label>
                          <input
                            type="text"
                            required
                            dir="ltr"
                            value={transferSender}
                            onChange={(e) => setTransferSender(e.target.value)}
                            placeholder={t.transferSenderPlaceholder}
                            className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#D4AF37] text-[#F7F3E9] text-sm font-mono focus:outline-none"
                          />
                        </div>

                        <p className="text-xs text-[#D4AF37] bg-[#D4AF37]/10 border border-[#D4AF37]/30 p-3 leading-relaxed">
                          💡 {t.transferNote}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

              <div className="space-y-2">
                <label className="block text-xs text-[#C9C1B1]">{t.notesLabel}</label>

                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  className="w-full px-3.5 py-2 bg-[#121212] border border-[#D4AF37]/35 text-[#F7F3E9] text-sm focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                disabled={isCheckingPhone || cart.length === 0}
                className="w-full py-4 bg-[#D4AF37] hover:bg-[#e3be42] disabled:opacity-40 text-[#121212] font-bold text-sm sm:text-base transition-colors cursor-pointer shadow-[0_0_25px_rgba(212,175,55,0.3)]"
              >
                {isCheckingPhone
                  ? lang === 'ar'
                    ? 'جاري التحقق من الرقم...'
                    : 'Verifying phone...'
                  : t.submitOrderNow}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
