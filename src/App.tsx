import { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import type { BranchConfig, BranchId, CartItem, Lang, MenuItem } from './types.ts';
import { getEffectiveBranchConfig } from './data/initialData.ts';
import { useRestaurantStore } from './hooks/useRestaurantStore.ts';
import { useAuth } from './hooks/useAuth.ts';
import { Navbar } from './components/Navbar.tsx';
import { HeroSection } from './components/HeroSection.tsx';
import { DigitalMenu } from './components/DigitalMenu.tsx';
import { ShowsSchedule } from './components/ShowsSchedule.tsx';
import { DynamicGallery } from './components/DynamicGallery.tsx';
import { ReviewsSection } from './components/ReviewsSection.tsx';
import { LocationContact } from './components/LocationContact.tsx';
import { BookingOrderModal } from './components/BookingOrderModal.tsx';
import { CustomerAuthModal } from './components/CustomerAuthModal.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { Footer } from './components/Footer.tsx';
import { ScrollToTopButton } from './components/ScrollToTopButton.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { playOrderNotificationChime } from './utils/orderAlertSound.ts';
import { exportOrdersToExcel } from './utils/exportOrdersExcel.ts';

const ACTIVE_BRANCH_KEY = 'saheb_elsaada_active_branch';
const CART_STORAGE_KEY = 'saheb_elsaada_cart_v1';

function getInitialBranch(): BranchId {
  try {
    const urlBranch = new URLSearchParams(window.location.search).get('branch');
    if (
      urlBranch === 'branch_tagamoa' ||
      urlBranch === 'branch_moez' ||
      urlBranch === 'branch_zayed'
    ) {
      return urlBranch;
    }
    const saved = localStorage.getItem(ACTIVE_BRANCH_KEY);
    if (saved === 'branch_tagamoa' || saved === 'branch_moez' || saved === 'branch_zayed') {
      return saved;
    }
  } catch {
    // Ignore storage read failure
  }
  return 'branch_tagamoa';
}

function getInitialCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        Boolean(
          item &&
            typeof item === 'object' &&
            typeof item.menuItemId === 'string' &&
            typeof item.titleAr === 'string' &&
            typeof item.titleEn === 'string' &&
            typeof item.price === 'number' &&
            Number.isFinite(item.price) &&
            typeof item.quantity === 'number' &&
            item.quantity > 0
        )
    );
  } catch {
    return [];
  }
}

export function App() {
  const [lang, setLang] = useState<Lang>('ar');
  const [activeBranch, setActiveBranch] = useState<BranchId>(getInitialBranch);
  const [adminBranch, setAdminBranch] = useState<BranchId>(getInitialBranch);
  const [isAdminView, setIsAdminView] = useState<boolean>(() => {
    return window.location.pathname === '/admin' || window.location.hash === '#admin';
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(getInitialCart);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [branchNotice, setBranchNotice] = useState<{
    message: string;
    clearedCart: boolean;
  } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const {
    customer,
    adminSession,
    adminAuthReady,
    firebaseNonAdminEmail,
    favoriteIds,
    toggleFavoriteDish,
    authError,
    setAuthError,
    authLoading,
    loginCustomer,
    signupCustomer,
    updateCustomerProfile,
    logoutCustomer,
    loginAdmin,
    logoutAdmin,
  } = useAuth();

  const {
    stores,
    reviews,
    firestoreOrdersReady,
    addReview,
    deleteReview,
    updateBranchSettings,
    updateCmsSettings,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    addShow,
    updateShow,
    deleteShow,
    addGalleryPhoto,
    addGalleryPhotosBulk,
    deleteGalleryPhoto,
    addOrder,
    updateOrderStatus,
    cancelOrderByCustomer,
    acknowledgeOrderCancellation,
    rateOrder,
    deleteOrder,
    resetBranchDefaults,
  } = useRestaurantStore({ isAdminAuthenticated: Boolean(adminSession) });

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_BRANCH_KEY, activeBranch);
    } catch {
      // Ignore storage write failure
    }
  }, [activeBranch]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage write failure
    }
  }, [cart]);

  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) {
        setCart(getInitialCart());
      }
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, []);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  const effectiveBranchConfigs: Record<BranchId, BranchConfig> = useMemo(
    () => ({
      branch_tagamoa: getEffectiveBranchConfig('branch_tagamoa', stores.branch_tagamoa),
      branch_moez: getEffectiveBranchConfig('branch_moez', stores.branch_moez),
      branch_zayed: getEffectiveBranchConfig('branch_zayed', stores.branch_zayed),
    }),
    [stores]
  );

  const activeStore = stores[activeBranch];
  const activeBranchConfig = effectiveBranchConfigs[activeBranch];
  const adminStore = stores[adminBranch];
  const adminBranchConfig = effectiveBranchConfigs[adminBranch];

  const handleSwitchBranch = (nextBranch: BranchId) => {
    if (nextBranch === activeBranch) return;

    setActiveBranch(nextBranch);

    const cfg = effectiveBranchConfigs[nextBranch];
    const hasCartItems = cart.length > 0;
    const message = hasCartItems
      ? lang === 'ar'
        ? `تم الانتقال إلى ${cfg.nameAr} — وتم الاحتفاظ بأصناف سلة المشتريات الخاصة بك.`
        : `Switched to ${cfg.nameEn} — Your cart items have been preserved.`
      : lang === 'ar'
      ? `أنت تتصفح الآن بوابة ${cfg.nameAr}`
      : `You are now viewing ${cfg.nameEn}`;

    setBranchNotice({ message, clearedCart: false });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setBranchNotice(null);
    }, 5500);
  };

  const handleNavigateHome = (sectionId?: string) => {
    setIsAdminView(false);
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  const handleNavigateAdmin = () => {
    setAuthError(null);
    setAdminBranch(activeBranch);
    setIsAdminView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id);
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          menuItemId: item.id,
          titleAr: item.titleAr,
          titleEn: item.titleEn,
          price: item.price,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateCartQty = (menuItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.menuItemId === menuItemId ? { ...c, quantity: c.quantity + delta } : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const handleRepeatOrder = (items: CartItem[]) => {
    setCart((prev) => {
      const next = [...prev];
      items.forEach((orderItem) => {
        const existingIdx = next.findIndex((c) => c.menuItemId === orderItem.menuItemId);
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            quantity: next[existingIdx].quantity + orderItem.quantity,
          };
        } else {
          next.push({ ...orderItem });
        }
      });
      return next;
    });
  };

  const handleClearCart = () => setCart([]);

  const openOrderModal = () => {
    setModalOpen(true);
  };

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartAmount = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const customerOrders = customer
    ? [...activeStore.orders]
        .filter((o) => o.customerId === customer.id || o.phone.trim() === customer.phone.trim())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];

  const favoriteDishes = activeStore.menu.filter((item) => favoriteIds.includes(item.id));

  return (
    <div
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#121212] text-[#F7F3E9] font-cairo selection:bg-[#D4AF37] selection:text-[#121212]"
    >
      {mapsQuotaExceeded && (
        <div
          dir="ltr"
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm print:hidden"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <div className="print:hidden">
        <Navbar
          lang={lang}
          activeBranch={activeBranch}
          branchConfigs={effectiveBranchConfigs}
          onSwitchBranch={handleSwitchBranch}
          customerName={customer?.name}
          announcementBanner={
            activeStore.cmsSettings
              ? {
                  enabled: Boolean(activeStore.cmsSettings.announcementEnabled),
                  textAr: activeStore.cmsSettings.announcementTextAr || '',
                  textEn: activeStore.cmsSettings.announcementTextEn || '',
                }
              : undefined
          }
          onNavigateHome={handleNavigateHome}
          onNavigateAdmin={handleNavigateAdmin}
          onOpenAccount={() => {
            setAuthError(null);
            setCustomerModalOpen(true);
          }}
        />
      </div>

      {/* Automatic Branch Switch & Cart Cleared Notification */}
      {branchNotice && !isAdminView && (
        <div className="print:hidden sticky top-24 z-40 mx-auto max-w-[1200px] px-4 pt-3 pointer-events-none">
          <div
            role="status"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 border shadow-2xl text-xs sm:text-sm font-bold ${
              branchNotice.clearedCart
                ? 'bg-[#251A10] border-[#D4AF37] text-[#F7F3E9]'
                : 'bg-[#11241B] border-[#10B981] text-[#F7F3E9]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {branchNotice.clearedCart ? (
                <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
              )}
              <span>{branchNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBranchNotice(null)}
              aria-label="Close notice"
              className="p-1 text-[#C9C1B1] hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isAdminView ? (
        <AdminDashboard
          lang={lang}
          adminBranch={adminBranch}
          onChangeAdminBranch={setAdminBranch}
          stores={stores}
          branchConfig={adminBranchConfig}
          branchConfigs={effectiveBranchConfigs}
          onUpdateBranchSettings={(settings) => updateBranchSettings(adminBranch, settings)}
          cmsSettings={adminStore.cmsSettings}
          onUpdateCmsSettings={(settings) => updateCmsSettings(adminBranch, settings)}
          adminSession={adminSession}
          adminAuthReady={adminAuthReady}
          customer={customer}
          firebaseNonAdminEmail={firebaseNonAdminEmail}
          firestoreOrdersReady={firestoreOrdersReady}
          authError={authError}
          authLoading={authLoading}
          onAdminLogin={loginAdmin}
          onAdminLogout={logoutAdmin}
          onLogoutCustomer={logoutCustomer}
          menu={adminStore.menu}
          shows={adminStore.shows}
          gallery={adminStore.gallery}
          orders={adminStore.orders}
          onAddMenu={(item) => addMenuItem(adminBranch, item)}
          onUpdateMenu={(id, item) => updateMenuItem(adminBranch, id, item)}
          onDeleteMenu={(id) => deleteMenuItem(adminBranch, id)}
          onAddShow={(show) => addShow(adminBranch, show)}
          onUpdateShow={(id, show) => updateShow(adminBranch, id, show)}
          onDeleteShow={(id) => deleteShow(adminBranch, id)}
          onAddPhoto={(photo) => addGalleryPhoto(adminBranch, photo)}
          onAddPhotosBulk={(photos) => addGalleryPhotosBulk(adminBranch, photos)}
          onDeletePhoto={(id) => deleteGalleryPhoto(adminBranch, id)}
          onUpdateOrderStatus={(id, status, bId) =>
            updateOrderStatus(bId || adminBranch, id, status)
          }
          onAcknowledgeOrderCancellation={(branchId, orderId) =>
            acknowledgeOrderCancellation(branchId, orderId)
          }
          onDeleteOrder={(id, bId) => deleteOrder(bId || adminBranch, id)}
          onExportOrdersCsv={(ordersToExport) =>
            exportOrdersToExcel(
              ordersToExport || adminStore.orders,
              adminBranchConfig,
              lang,
              effectiveBranchConfigs
            )
          }
          reviews={reviews}
          onDeleteReview={deleteReview}
          onResetDefaults={() => resetBranchDefaults(adminBranch)}
          onExitAdmin={() => setIsAdminView(false)}
        />
      ) : (
        <main>
          <div className="print:hidden">
            <HeroSection
              lang={lang}
              activeBranch={activeBranch}
              branchConfig={activeBranchConfig}
              branchConfigs={effectiveBranchConfigs}
              onSwitchBranch={handleSwitchBranch}
              onOpenOrder={openOrderModal}
            />
          </div>

          <DigitalMenu
            lang={lang}
            branchConfig={activeBranchConfig}
            cmsSettings={activeStore.cmsSettings}
            menu={activeStore.menu}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavoriteDish}
            onAddToCart={handleAddToCart}
            cartCount={totalCartItems}
            cartTotal={totalCartAmount}
            onOpenOrderModal={openOrderModal}
          />

          <div className="print:hidden">
            <ShowsSchedule
              lang={lang}
              branchConfig={activeBranchConfig}
              shows={activeStore.shows}
            />

            <DynamicGallery lang={lang} gallery={activeStore.gallery} />

            <ReviewsSection
              lang={lang}
              branchConfig={activeBranchConfig}
              branchConfigs={effectiveBranchConfigs}
              reviews={reviews}
              customerName={customer?.name}
              isAdmin={Boolean(adminSession)}
              onAddReview={addReview}
              onDeleteReview={deleteReview}
            />

            <LocationContact
              lang={lang}
              branchConfig={activeBranchConfig}
              mapsQuotaExceeded={mapsQuotaExceeded}
            />
          </div>
        </main>
      )}

      <div className="print:hidden">
        <Footer
          lang={lang}
          branchConfig={activeBranchConfig}
          cmsSettings={activeStore.cmsSettings}
          onChangeLang={setLang}
          onNavigateHome={handleNavigateHome}
          onOpenAccount={() => {
            setAuthError(null);
            setCustomerModalOpen(true);
          }}
          onNavigateAdmin={handleNavigateAdmin}
        />
      </div>

      <BookingOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
        activeBranch={activeBranch}
        branchConfig={activeBranchConfig}
        branchConfigs={effectiveBranchConfigs}
        onSwitchBranch={handleSwitchBranch}
        cart={cart}
        customer={customer}
        onUpdateQty={handleUpdateCartQty}
        onClearCart={handleClearCart}
        onSubmitOrder={(entry) => {
          const created = addOrder(activeBranch, entry);
          playOrderNotificationChime();
          return created;
        }}
      />

      <CustomerAuthModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        lang={lang}
        customer={customer}
        customerOrders={customerOrders}
        favoriteDishes={favoriteDishes}
        onToggleFavorite={toggleFavoriteDish}
        onAddToCart={handleAddToCart}
        onRepeatOrder={handleRepeatOrder}
        onRateOrder={(orderId, rating, comment) =>
          rateOrder(activeBranch, orderId, rating, comment)
        }
        onCancelOrder={(orderId, reason) =>
          cancelOrderByCustomer(activeBranch, orderId, reason)
        }
        onOpenCheckout={() => {
          setCustomerModalOpen(false);
          openOrderModal();
        }}
        authError={authError}
        authLoading={authLoading}
        onLogin={loginCustomer}
        onSignup={signupCustomer}
        onUpdateProfile={updateCustomerProfile}
        onLogout={logoutCustomer}
      />

      <OfflineIndicator lang={lang} />
      <ScrollToTopButton lang={lang} />
    </div>
  );
}

export default App;
