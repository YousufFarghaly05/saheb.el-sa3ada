import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type {
  BranchCmsSettings,
  BranchContactSettings,
  BranchId,
  DualBranchStoreState,
  StoreState,
  MenuItem,
  ShowSchedule,
  GalleryPhoto,
  Reservation,
  OnlineOrder,
  BookingStatus,
  CustomerReview,
} from '../types.ts';
import { INITIAL_BRANCH_STORES } from '../data/initialData.ts';
import { auth, db, isAdminEmail, logFirestoreError, OperationType } from '../firebase.ts';

const BRANCH_STORAGE_KEYS: Record<BranchId, string> = {
  branch_tagamoa: 'branch_tagamoa',
  branch_moez: 'branch_moez',
  branch_zayed: 'branch_zayed',
};

const VALID_BRANCH_IDS: BranchId[] = ['branch_tagamoa', 'branch_moez', 'branch_zayed'];

const STORE_BROADCAST_CHANNEL = 'saheb_elsaada_store_sync_v1';
export const ORDER_CANCEL_WINDOW_MS = 15 * 60 * 1000;

export const LIVE_REVIEWS_STORAGE_KEY = 'saheb_elsaada_live_reviews_v1';

function isBranchId(value: unknown): value is BranchId {
  return value === 'branch_tagamoa' || value === 'branch_moez' || value === 'branch_zayed';
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    });
    return out as T;
  }
  return value;
}

function readLiveReviewsFromStorage(): CustomerReview[] {
  try {
    const raw = localStorage.getItem(LIVE_REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CustomerReview =>
        Boolean(
          r &&
            typeof r === 'object' &&
            typeof r.id === 'string' &&
            typeof r.author === 'string' &&
            typeof r.comment === 'string'
        )
    );
  } catch {
    return [];
  }
}

function writeLiveReviewsToStorage(reviews: CustomerReview[]) {
  try {
    localStorage.setItem(LIVE_REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // ignore storage quota errors
  }
}

const CATALOG_VERSION_KEY = 'saheb_elsaada_menu_catalog_v3';

function hasLegacySampleMenu(menu: MenuItem[] | undefined): boolean {
  if (!Array.isArray(menu) || menu.length === 0) return true;
  return (
    menu.some((m) => m.id === 'm-1' || m.id === 'moez-m-1') ||
    menu.some((m) => m.id.endsWith('-juc-1') && m.imageUrl === '/assets/aistudio/unnamed_062b5ea3.jpg') ||
    (menu.length < 30 &&
      !menu.some(
        (m) => m.id.startsWith('tag-') || m.id.startsWith('moez-brk-') || m.id.startsWith('zayed-')
      ))
  );
}

const CMS_MIGRATION_KEY = 'saheb_elsaada_cms_neutral_v3';

function hasLegacyPartyShows(shows: ShowSchedule[] | undefined): boolean {
  if (!Array.isArray(shows) || shows.length === 0) return false;
  return shows.some((s) => ['s-sat', 'moez-s-sat', 'zayed-s-sat'].includes(s.id));
}

function hasLegacyShishaOrGallery(parsed: Partial<StoreState>): boolean {
  const hasLegacyShisha =
    Array.isArray(parsed.menu) &&
    parsed.menu.some(
      (m) =>
        m.category === 'shisha' ||
        ['tag-shs-1', 'tag-shs-2', 'moez-shs-1', 'moez-shs-2'].includes(m.id)
    );
  const hasLegacyGallery =
    Array.isArray(parsed.gallery) &&
    parsed.gallery.some(
      (g) =>
        ['g-2', 'g-4', 'moez-g-2', 'moez-g-3', 'zayed-g-1', 'zayed-g-3'].includes(g.id) &&
        /تنورة|شيشة|عود|مسرح|tanoura|shisha|oud/i.test(`${g.titleAr} ${g.titleEn || ''}`)
    );
  return hasLegacyShisha || hasLegacyGallery;
}

function normalizeShowsWithFallback(
  shows: ShowSchedule[] | undefined,
  fallbackShows: ShowSchedule[]
): ShowSchedule[] {
  if (!Array.isArray(shows) || !shows.length || hasLegacyPartyShows(shows)) {
    return fallbackShows;
  }
  return shows.map((show, idx) => {
    const url = show.imageUrl?.trim() || '';
    const isValidExternal =
      url.startsWith('https://') || url.startsWith('http://') || url.startsWith('data:image/');
    if (isValidExternal) return show;
    const matchingFallback =
      fallbackShows.find((f) => f.id === show.id) || fallbackShows[idx % fallbackShows.length];
    return {
      ...show,
      imageUrl: matchingFallback?.imageUrl,
    };
  });
}

function normalizeBranchStore(
  parsed: Partial<StoreState> | null | undefined,
  fallback: StoreState
): StoreState {
  if (!parsed || typeof parsed !== 'object') return fallback;
  const cleanedMenu =
    Array.isArray(parsed.menu) && parsed.menu.length
      ? parsed.menu.filter(
          (m) =>
            m.category !== 'shisha' &&
            !['tag-shs-1', 'tag-shs-2', 'moez-shs-1', 'moez-shs-2'].includes(m.id)
        )
      : fallback.menu;
  const hasUnmigratedJuiceImages = cleanedMenu.some(
    (m) => m.id.endsWith('-juc-1') && m.imageUrl === '/assets/aistudio/unnamed_062b5ea3.jpg'
  );
  const hasLegacyGallery =
    Array.isArray(parsed.gallery) &&
    parsed.gallery.some(
      (g) =>
        ['g-2', 'g-4', 'moez-g-2', 'moez-g-3', 'zayed-g-1', 'zayed-g-3'].includes(g.id) &&
        /تنورة|شيشة|عود|مسرح|tanoura|shisha|oud/i.test(`${g.titleAr} ${g.titleEn || ''}`)
    );

  return {
    menu: cleanedMenu.length && !hasUnmigratedJuiceImages ? cleanedMenu : fallback.menu,
    shows: normalizeShowsWithFallback(parsed.shows, fallback.shows),
    gallery:
      Array.isArray(parsed.gallery) && parsed.gallery.length && !hasLegacyGallery
        ? parsed.gallery
        : fallback.gallery,
    reservations: Array.isArray(parsed.reservations)
      ? parsed.reservations
      : fallback.reservations,
    orders: Array.isArray(parsed.orders) ? parsed.orders : fallback.orders,
    branchSettings:
      parsed.branchSettings && typeof parsed.branchSettings === 'object'
        ? parsed.branchSettings
        : undefined,
    cmsSettings:
      parsed.cmsSettings && typeof parsed.cmsSettings === 'object'
        ? {
            ...parsed.cmsSettings,
            instagramUrl:
              parsed.cmsSettings.instagramUrl !== undefined &&
              !/^https?:\/\/(www\.)?instagram\.com\/sahebelsaada\.(eg|tagamoa|moez|zayed)\/?$/i.test(
                parsed.cmsSettings.instagramUrl.trim()
              )
                ? parsed.cmsSettings.instagramUrl
                : fallback.cmsSettings?.instagramUrl,
            facebookUrl:
              parsed.cmsSettings.facebookUrl !== undefined &&
              !/^https?:\/\/(www\.)?facebook\.com\/sahebelsaada\.(eg|tagamoa|moez|zayed)\/?$/i.test(
                parsed.cmsSettings.facebookUrl.trim()
              )
                ? parsed.cmsSettings.facebookUrl
                : fallback.cmsSettings?.facebookUrl,
            tiktokUrl:
              parsed.cmsSettings.tiktokUrl !== undefined &&
              !/^https?:\/\/(www\.)?tiktok\.com\/@sahebelsaada\.(eg|tagamoa|moez|zayed)\/?$/i.test(
                parsed.cmsSettings.tiktokUrl.trim()
              )
                ? parsed.cmsSettings.tiktokUrl
                : fallback.cmsSettings?.tiktokUrl,
          }
        : fallback.cmsSettings,
  };
}

function readBranchFromLocalStorage(branchId: BranchId): StoreState | null {
  try {
    const raw = localStorage.getItem(BRANCH_STORAGE_KEYS[branchId]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    const normalized = normalizeBranchStore(parsed, INITIAL_BRANCH_STORES[branchId]);
    const catalogMigrated = localStorage.getItem(CATALOG_VERSION_KEY) === 'true';
    const cmsMigrated = localStorage.getItem(CMS_MIGRATION_KEY) === 'true';
    if (!catalogMigrated && hasLegacySampleMenu(normalized.menu)) {
      return {
        ...normalized,
        menu: INITIAL_BRANCH_STORES[branchId].menu,
      };
    }
    if (!cmsMigrated && (hasLegacyPartyShows(parsed.shows) || hasLegacyShishaOrGallery(parsed))) {
      return {
        ...normalized,
        menu: normalized.menu,
        shows: hasLegacyPartyShows(parsed.shows)
          ? INITIAL_BRANCH_STORES[branchId].shows
          : normalized.shows,
        gallery: INITIAL_BRANCH_STORES[branchId].gallery,
      };
    }
    return normalized;
  } catch {
    return null;
  }
}

function writeBranchToLocalStorage(branchId: BranchId, data: StoreState) {
  try {
    localStorage.setItem(BRANCH_STORAGE_KEYS[branchId], JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function parseFirestoreOrder(docId: string, raw: Record<string, unknown>): OnlineOrder | null {
  const branchId: BranchId = isBranchId(raw.branchId) ? raw.branchId : 'branch_tagamoa';
  const customerName = typeof raw.customerName === 'string' ? raw.customerName : '';
  const phone = typeof raw.phone === 'string' ? raw.phone : '';
  if (!customerName && !phone) return null;

  let createdAtStr = new Date().toISOString();
  if (typeof raw.createdAt === 'string' && raw.createdAt.trim()) {
    createdAtStr = raw.createdAt;
  } else if (
    raw.createdAtServer &&
    typeof raw.createdAtServer === 'object' &&
    'toDate' in raw.createdAtServer &&
    typeof (raw.createdAtServer as { toDate?: () => Date }).toDate === 'function'
  ) {
    createdAtStr = (raw.createdAtServer as { toDate: () => Date }).toDate().toISOString();
  }

  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items = rawItems
    .filter((it): it is Record<string, unknown> => Boolean(it && typeof it === 'object'))
    .map((it) => ({
      menuItemId: String(it.menuItemId || ''),
      titleAr: String(it.titleAr || ''),
      titleEn: String(it.titleEn || it.titleAr || ''),
      price: Number(it.price) || 0,
      quantity: Math.max(1, Number(it.quantity) || 1),
    }));

  const statusVal = String(raw.status || 'pending');
  const status: BookingStatus =
    statusVal === 'pending' ||
    statusVal === 'preparing' ||
    statusVal === 'confirmed' ||
    statusVal === 'completed' ||
    statusVal === 'cancelled'
      ? statusVal
      : 'pending';

  return {
    id: typeof raw.orderCode === 'string' && raw.orderCode.trim() ? raw.orderCode : docId,
    firestoreDocId: docId,
    branchId,
    customerId: typeof raw.customerId === 'string' ? raw.customerId : undefined,
    customerName,
    phone,
    serviceType: raw.serviceType === 'takeaway' ? 'takeaway' : 'delivery',
    address: typeof raw.address === 'string' ? raw.address : '',
    requestedTime: typeof raw.requestedTime === 'string' ? raw.requestedTime : '',
    items,
    totalAmount: Number(raw.totalAmount) || 0,
    paymentMethod:
      raw.paymentMethod === 'instapay_vodafone' ? 'instapay_vodafone' : 'cash_on_delivery',
    paymentStatus:
      raw.paymentStatus === 'paid' || raw.paymentStatus === 'transfer_submitted'
        ? raw.paymentStatus
        : 'pending_cod',
    transferSender: typeof raw.transferSender === 'string' ? raw.transferSender : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    status,
    rating: typeof raw.rating === 'number' ? raw.rating : undefined,
    ratingComment: typeof raw.ratingComment === 'string' ? raw.ratingComment : undefined,
    ratedAt: typeof raw.ratedAt === 'string' ? raw.ratedAt : undefined,
    cancelledBy:
      raw.cancelledBy === 'customer' || raw.cancelledBy === 'admin' ? raw.cancelledBy : undefined,
    cancelledAt: typeof raw.cancelledAt === 'string' ? raw.cancelledAt : undefined,
    cancellationReason:
      typeof raw.cancellationReason === 'string' ? raw.cancellationReason : undefined,
    adminCancelAcknowledged:
      typeof raw.adminCancelAcknowledged === 'boolean' ? raw.adminCancelAcknowledged : undefined,
    createdAt: createdAtStr,
  };
}

// Keep Firestore branch documents safely below the 1MB limit when syncing inline media
function sanitizeGalleryForFirestore(items: GalleryPhoto[]): GalleryPhoto[] {
  return items.filter((item) => {
    const approxBytes = (item.imageUrl?.length || 0) + (item.videoUrl?.length || 0);
    return approxBytes < 450_000;
  });
}

export function useRestaurantStore(options?: { isAdminAuthenticated?: boolean }) {
  const isAdminAuthenticated = Boolean(options?.isAdminAuthenticated);

  const [stores, setStores] = useState<DualBranchStoreState>(() => {
    try {
      localStorage.removeItem('saheb_elsaada_newcairo_v1');
      localStorage.removeItem('saheb_elsaada_newcairo_v2');
      localStorage.removeItem('saheb_elsaada_newcairo_v3');
      localStorage.removeItem('saheb_elsaada_newcairo_v4');
      localStorage.removeItem('saheb_elsaada_newcairo_v5');
    } catch {
      // ignore
    }

    const localTagamoa = readBranchFromLocalStorage('branch_tagamoa');
    const localMoez = readBranchFromLocalStorage('branch_moez');
    const localZayed = readBranchFromLocalStorage('branch_zayed');

    const initial: DualBranchStoreState = {
      branch_tagamoa: localTagamoa ?? INITIAL_BRANCH_STORES.branch_tagamoa,
      branch_moez: localMoez ?? INITIAL_BRANCH_STORES.branch_moez,
      branch_zayed: localZayed ?? INITIAL_BRANCH_STORES.branch_zayed,
    };

    writeBranchToLocalStorage('branch_tagamoa', initial.branch_tagamoa);
    writeBranchToLocalStorage('branch_moez', initial.branch_moez);
    writeBranchToLocalStorage('branch_zayed', initial.branch_zayed);

    try {
      localStorage.setItem(CATALOG_VERSION_KEY, 'true');
      localStorage.setItem(CMS_MIGRATION_KEY, 'true');
    } catch {
      // ignore
    }

    return initial;
  });

  const [firestoreOrdersReady, setFirestoreOrdersReady] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Sync across tabs in the same browser
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(STORE_BROADCAST_CHANNEL);
      channelRef.current = ch;
      ch.onmessage = (event: MessageEvent<{ branchId?: BranchId; data?: StoreState }>) => {
        const { branchId, data } = event.data || {};
        if (!branchId || !data) return;
        const normalized = normalizeBranchStore(data, INITIAL_BRANCH_STORES[branchId]);
        setStores((prev) => ({
          ...prev,
          [branchId]: normalized,
        }));
      };
    }

    const handleBranchStorageSync = (e: StorageEvent) => {
      if (isBranchId(e.key)) {
        const synced = readBranchFromLocalStorage(e.key);
        if (synced) {
          setStores((prev) => ({
            ...prev,
            [e.key as BranchId]: synced,
          }));
        }
      }
    };
    window.addEventListener('storage', handleBranchStorageSync);

    return () => {
      window.removeEventListener('storage', handleBranchStorageSync);
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, []);

  // --- Cloud Firestore Real-Time Sync: Menus, Offers/Announcements, and Gallery (All Users) ---
  useEffect(() => {
    const unsubMenus = onSnapshot(
      collection(db, 'branch_menus'),
      (snapshot) => {
        if (snapshot.empty) return;
        setStores((prev) => {
          let changed = false;
          const next = { ...prev };
          snapshot.forEach((docSnap) => {
            if (!isBranchId(docSnap.id)) return;
            const data = docSnap.data();
            if (Array.isArray(data.items) && data.items.length > 0) {
              const updatedBranch: StoreState = {
                ...prev[docSnap.id],
                menu: data.items as MenuItem[],
              };
              next[docSnap.id] = updatedBranch;
              writeBranchToLocalStorage(docSnap.id, updatedBranch);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, 'branch_menus');
      }
    );

    const unsubOffers = onSnapshot(
      collection(db, 'branch_offers'),
      (snapshot) => {
        if (snapshot.empty) return;
        setStores((prev) => {
          let changed = false;
          const next = { ...prev };
          snapshot.forEach((docSnap) => {
            if (!isBranchId(docSnap.id)) return;
            const data = docSnap.data();
            const updatedBranch: StoreState = {
              ...prev[docSnap.id],
              shows: Array.isArray(data.shows)
                ? normalizeShowsWithFallback(
                    data.shows as ShowSchedule[],
                    INITIAL_BRANCH_STORES[docSnap.id].shows
                  )
                : prev[docSnap.id].shows,
              cmsSettings:
                data.cmsSettings && typeof data.cmsSettings === 'object'
                  ? (data.cmsSettings as BranchCmsSettings)
                  : prev[docSnap.id].cmsSettings,
              branchSettings:
                data.branchSettings && typeof data.branchSettings === 'object'
                  ? (data.branchSettings as BranchContactSettings)
                  : prev[docSnap.id].branchSettings,
            };
            next[docSnap.id] = updatedBranch;
            writeBranchToLocalStorage(docSnap.id, updatedBranch);
            changed = true;
          });
          return changed ? next : prev;
        });
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, 'branch_offers');
      }
    );

    const unsubGallery = onSnapshot(
      collection(db, 'branch_gallery'),
      (snapshot) => {
        if (snapshot.empty) return;
        setStores((prev) => {
          let changed = false;
          const next = { ...prev };
          snapshot.forEach((docSnap) => {
            if (!isBranchId(docSnap.id)) return;
            const data = docSnap.data();
            if (Array.isArray(data.items)) {
              const updatedBranch: StoreState = {
                ...prev[docSnap.id],
                gallery: data.items as GalleryPhoto[],
              };
              next[docSnap.id] = updatedBranch;
              writeBranchToLocalStorage(docSnap.id, updatedBranch);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, 'branch_gallery');
      }
    );

    return () => {
      unsubMenus();
      unsubOffers();
      unsubGallery();
    };
  }, []);

  // --- Cloud Firestore Real-Time Orders Listener (STRICTLY Admin Authenticated Only) ---
  useEffect(() => {
    if (!isAdminAuthenticated || !isAdminEmail(auth.currentUser?.email)) {
      setFirestoreOrdersReady(false);
      return;
    }

    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const grouped: Record<BranchId, OnlineOrder[]> = {
          branch_tagamoa: [],
          branch_moez: [],
          branch_zayed: [],
        };

        snapshot.forEach((docSnap) => {
          const parsed = parseFirestoreOrder(docSnap.id, docSnap.data() as Record<string, unknown>);
          if (parsed && parsed.branchId && isBranchId(parsed.branchId)) {
            grouped[parsed.branchId].push(parsed);
          }
        });

        // Guarantee strict newest-first sorting per branch
        VALID_BRANCH_IDS.forEach((bId) => {
          grouped[bId].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });

        setStores((prev) => {
          const next: DualBranchStoreState = { ...prev };
          VALID_BRANCH_IDS.forEach((bId) => {
            const updatedBranch: StoreState = {
              ...prev[bId],
              orders: grouped[bId],
            };
            next[bId] = updatedBranch;
            writeBranchToLocalStorage(bId, updatedBranch);
          });
          return next;
        });
        setFirestoreOrdersReady(true);
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, 'orders');
        setFirestoreOrdersReady(true);
      }
    );

    return () => unsubOrders();
  }, [isAdminAuthenticated]);

  // Firestore write helpers (strictly admin-guarded)
  const syncMenuToFirestore = useCallback((branchId: BranchId, items: MenuItem[]) => {
    if (!isAdminEmail(auth.currentUser?.email)) return;
    void setDoc(
      doc(db, 'branch_menus', branchId),
      stripUndefinedDeep({
        items,
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    ).catch((error) => {
      logFirestoreError(error, OperationType.WRITE, `branch_menus/${branchId}`);
    });
  }, []);

  const syncOffersToFirestore = useCallback(
    (
      branchId: BranchId,
      payload: {
        shows?: ShowSchedule[];
        cmsSettings?: BranchCmsSettings;
        branchSettings?: BranchContactSettings;
      }
    ) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      void setDoc(
        doc(db, 'branch_offers', branchId),
        stripUndefinedDeep({
          ...payload,
          updatedAt: serverTimestamp(),
        }),
        { merge: true }
      ).catch((error) => {
        logFirestoreError(error, OperationType.WRITE, `branch_offers/${branchId}`);
      });
    },
    []
  );

  const syncGalleryToFirestore = useCallback((branchId: BranchId, items: GalleryPhoto[]) => {
    if (!isAdminEmail(auth.currentUser?.email)) return;
    void setDoc(
      doc(db, 'branch_gallery', branchId),
      stripUndefinedDeep({
        items: sanitizeGalleryForFirestore(items),
        updatedAt: serverTimestamp(),
      }),
      { merge: true }
    ).catch((error) => {
      logFirestoreError(error, OperationType.WRITE, `branch_gallery/${branchId}`);
    });
  }, []);

  const persistBranch = useCallback(
    (
      branchId: BranchId,
      updater: (prevBranch: StoreState) => StoreState,
      onNextBranch?: (nextBranch: StoreState) => void
    ) => {
      setStores((prev) => {
        const nextBranch = updater(prev[branchId]);
        const nextStores: DualBranchStoreState = {
          ...prev,
          [branchId]: nextBranch,
        };
        writeBranchToLocalStorage(branchId, nextBranch);
        channelRef.current?.postMessage({ branchId, data: nextBranch });
        if (onNextBranch) {
          onNextBranch(nextBranch);
        }
        return nextStores;
      });
    },
    []
  );

  // Branch Contact / WhatsApp / Payment Settings (Admin Only -> Synced to Firestore)
  const updateBranchSettings = useCallback(
    (branchId: BranchId, settings: Partial<BranchContactSettings>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          branchSettings: {
            ...(prev.branchSettings || {}),
            ...settings,
          },
        }),
        (next) => {
          syncOffersToFirestore(branchId, {
            branchSettings: next.branchSettings as BranchContactSettings | undefined,
          });
        }
      );
    },
    [persistBranch, syncOffersToFirestore]
  );

  // Branch CMS Announcements & Reservation Notes (Admin Only -> Synced to Firestore)
  const updateCmsSettings = useCallback(
    (branchId: BranchId, settings: Partial<BranchCmsSettings>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          cmsSettings: {
            ...(prev.cmsSettings || {}),
            ...settings,
          },
        }),
        (next) => {
          syncOffersToFirestore(branchId, {
            cmsSettings: next.cmsSettings as BranchCmsSettings | undefined,
          });
        }
      );
    },
    [persistBranch, syncOffersToFirestore]
  );

  // Menu CRUD (Admin Only -> Synced to Firestore branch_menus)
  const addMenuItem = useCallback(
    (branchId: BranchId, item: Omit<MenuItem, 'id'>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          menu: [{ ...item, id: `${branchId}-m-${Date.now()}` }, ...prev.menu],
        }),
        (next) => syncMenuToFirestore(branchId, next.menu)
      );
    },
    [persistBranch, syncMenuToFirestore]
  );

  const updateMenuItem = useCallback(
    (branchId: BranchId, id: string, item: Partial<MenuItem>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          menu: prev.menu.map((m) => (m.id === id ? { ...m, ...item } : m)),
        }),
        (next) => syncMenuToFirestore(branchId, next.menu)
      );
    },
    [persistBranch, syncMenuToFirestore]
  );

  const deleteMenuItem = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          menu: prev.menu.filter((m) => m.id !== id),
        }),
        (next) => syncMenuToFirestore(branchId, next.menu)
      );
    },
    [persistBranch, syncMenuToFirestore]
  );

  // Announcements / Offers CRUD (Admin Only -> Synced to Firestore branch_offers)
  const addShow = useCallback(
    (branchId: BranchId, show: Omit<ShowSchedule, 'id'>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          shows: [...prev.shows, { ...show, id: `${branchId}-s-${Date.now()}` }],
        }),
        (next) => syncOffersToFirestore(branchId, { shows: next.shows })
      );
    },
    [persistBranch, syncOffersToFirestore]
  );

  const updateShow = useCallback(
    (branchId: BranchId, id: string, show: Partial<ShowSchedule>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          shows: prev.shows.map((s) => (s.id === id ? { ...s, ...show } : s)),
        }),
        (next) => syncOffersToFirestore(branchId, { shows: next.shows })
      );
    },
    [persistBranch, syncOffersToFirestore]
  );

  const deleteShow = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          shows: prev.shows.filter((s) => s.id !== id),
        }),
        (next) => syncOffersToFirestore(branchId, { shows: next.shows })
      );
    },
    [persistBranch, syncOffersToFirestore]
  );

  // Gallery CRUD (Admin Only -> Synced to Firestore branch_gallery)
  const addGalleryPhoto = useCallback(
    (branchId: BranchId, photo: Omit<GalleryPhoto, 'id'>) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          gallery: [
            {
              ...photo,
              id: `${branchId}-g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            },
            ...prev.gallery,
          ],
        }),
        (next) => syncGalleryToFirestore(branchId, next.gallery)
      );
    },
    [persistBranch, syncGalleryToFirestore]
  );

  const addGalleryPhotosBulk = useCallback(
    (branchId: BranchId, photos: Omit<GalleryPhoto, 'id'>[]) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => {
          const existingKeys = new Set(prev.gallery.map((g) => g.videoUrl || g.imageUrl));
          const uniqueNew = photos
            .filter((p) => !existingKeys.has(p.videoUrl || p.imageUrl))
            .map((p, idx) => ({
              ...p,
              id: `${branchId}-g-${Date.now()}-${idx}`,
            }));
          return {
            ...prev,
            gallery: [...uniqueNew, ...prev.gallery],
          };
        },
        (next) => syncGalleryToFirestore(branchId, next.gallery)
      );
    },
    [persistBranch, syncGalleryToFirestore]
  );

  const deleteGalleryPhoto = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(
        branchId,
        (prev) => ({
          ...prev,
          gallery: prev.gallery.filter((g) => g.id !== id),
        }),
        (next) => syncGalleryToFirestore(branchId, next.gallery)
      );
    },
    [persistBranch, syncGalleryToFirestore]
  );

  // Reservations CRUD
  const addReservation = useCallback(
    (
      branchId: BranchId,
      entry: Omit<Reservation, 'id' | 'status' | 'createdAt' | 'branchId'>
    ): Reservation => {
      const prefix =
        branchId === 'branch_tagamoa'
          ? 'TAG-RES'
          : branchId === 'branch_zayed'
          ? 'ZAYED-RES'
          : 'MOEZ-RES';
      const created: Reservation = {
        ...entry,
        branchId,
        id: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      persistBranch(branchId, (prev) => ({
        ...prev,
        reservations: [created, ...prev.reservations],
      }));
      return created;
    },
    [persistBranch]
  );

  const updateReservationStatus = useCallback(
    (branchId: BranchId, id: string, status: BookingStatus) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(branchId, (prev) => ({
        ...prev,
        reservations: prev.reservations.map((r) => (r.id === id ? { ...r, status } : r)),
      }));
    },
    [persistBranch]
  );

  const deleteReservation = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      persistBranch(branchId, (prev) => ({
        ...prev,
        reservations: prev.reservations.filter((r) => r.id !== id),
      }));
    },
    [persistBranch]
  );

  // Online Orders -> Saved directly to Cloud Firestore `orders` collection via addDoc
  const addOrder = useCallback(
    (
      branchId: BranchId,
      entry: Omit<OnlineOrder, 'id' | 'status' | 'createdAt' | 'branchId'>
    ): OnlineOrder => {
      const prefix =
        branchId === 'branch_tagamoa'
          ? 'TAG-ORD'
          : branchId === 'branch_zayed'
          ? 'ZAYED-ORD'
          : 'MOEZ-ORD';
      const orderCode = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      const createdAt = new Date().toISOString();

      const created: OnlineOrder = {
        ...entry,
        branchId,
        id: orderCode,
        status: 'pending',
        createdAt,
      };

      // Optimistic local state update so customer gets immediate confirmation & WhatsApp summary
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: [created, ...prev.orders],
      }));

      // Save order to Cloud Firestore `orders` collection via addDoc
      const firestorePayload = stripUndefinedDeep({
        orderCode,
        branchId,
        customerId: entry.customerId || null,
        customerName: entry.customerName,
        phone: entry.phone,
        serviceType: entry.serviceType,
        address: entry.address,
        requestedTime: entry.requestedTime,
        items: entry.items,
        totalAmount: entry.totalAmount,
        paymentMethod: entry.paymentMethod,
        paymentStatus: entry.paymentStatus,
        transferSender: entry.transferSender || null,
        notes: entry.notes || '',
        status: 'pending',
        createdAt,
        createdAtServer: serverTimestamp(),
      });

      void addDoc(collection(db, 'orders'), firestorePayload)
        .then((docRef) => {
          persistBranch(branchId, (prev) => ({
            ...prev,
            orders: prev.orders.map((o) =>
              o.id === orderCode ? { ...o, firestoreDocId: docRef.id } : o
            ),
          }));
        })
        .catch((error) => {
          logFirestoreError(error, OperationType.CREATE, 'orders');
        });

      return created;
    },
    [persistBranch]
  );

  // Admin-Only Order Status Update via Firestore updateDoc
  const updateOrderStatus = useCallback(
    (branchId: BranchId, id: string, status: BookingStatus) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;

      const existing = stores[branchId].orders.find(
        (o) => o.id === id || o.firestoreDocId === id
      );
      const targetDocId = existing?.firestoreDocId;

      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) => {
          if (o.id !== id && o.firestoreDocId !== id) return o;
          if (status === 'cancelled') {
            return {
              ...o,
              status,
              cancelledBy: o.cancelledBy || 'admin',
              cancelledAt: o.cancelledAt || new Date().toISOString(),
              adminCancelAcknowledged: true,
            };
          }
          return { ...o, status };
        }),
      }));

      if (targetDocId) {
        const updatePayload: Record<string, unknown> =
          status === 'cancelled'
            ? {
                status,
                cancelledBy: existing?.cancelledBy || 'admin',
                cancelledAt: existing?.cancelledAt || new Date().toISOString(),
                adminCancelAcknowledged: true,
              }
            : { status };

        void updateDoc(doc(db, 'orders', targetDocId), updatePayload).catch((error) => {
          logFirestoreError(error, OperationType.UPDATE, `orders/${targetDocId}`);
        });
      }
    },
    [persistBranch, stores]
  );

  const cancelOrderByCustomer = useCallback(
    (
      branchId: BranchId,
      id: string,
      reason?: string
    ): { ok: boolean; reason?: 'not_found' | 'already_final' | 'expired' } => {
      const target = stores[branchId].orders.find((o) => o.id === id);
      if (!target) {
        return { ok: false, reason: 'not_found' };
      }
      if (target.status === 'cancelled' || target.status === 'completed') {
        return { ok: false, reason: 'already_final' };
      }
      const elapsedMs = Date.now() - new Date(target.createdAt).getTime();
      if (Number.isNaN(elapsedMs) || elapsedMs > ORDER_CANCEL_WINDOW_MS) {
        return { ok: false, reason: 'expired' };
      }

      const cancelledAt = new Date().toISOString();
      const trimmedReason = reason?.trim();
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                status: 'cancelled',
                cancelledBy: 'customer',
                cancelledAt,
                cancellationReason: trimmedReason || undefined,
                adminCancelAcknowledged: false,
              }
            : o
        ),
      }));
      return { ok: true };
    },
    [persistBranch, stores]
  );

  const acknowledgeOrderCancellation = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;

      const existing = stores[branchId].orders.find(
        (o) => o.id === id || o.firestoreDocId === id
      );
      const targetDocId = existing?.firestoreDocId;

      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id || o.firestoreDocId === id ? { ...o, adminCancelAcknowledged: true } : o
        ),
      }));

      if (targetDocId) {
        void updateDoc(doc(db, 'orders', targetDocId), {
          adminCancelAcknowledged: true,
        }).catch((error) => {
          logFirestoreError(error, OperationType.UPDATE, `orders/${targetDocId}`);
        });
      }
    },
    [persistBranch, stores]
  );

  const rateOrder = useCallback(
    (branchId: BranchId, id: string, rating: number, comment: string) => {
      const clampedRating = Math.min(5, Math.max(1, Math.round(rating)));
      const trimmedComment = comment.trim();
      const ratedAt = new Date().toISOString();
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id
            ? {
                ...o,
                rating: clampedRating,
                ratingComment: trimmedComment,
                ratedAt,
              }
            : o
        ),
      }));
    },
    [persistBranch]
  );

  // Admin-Only Permanent Order Deletion via Firestore deleteDoc
  const deleteOrder = useCallback(
    (branchId: BranchId, id: string) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;

      const existing = stores[branchId].orders.find(
        (o) => o.id === id || o.firestoreDocId === id
      );
      const targetDocId = existing?.firestoreDocId;

      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o.id !== id && o.firestoreDocId !== id),
      }));

      if (targetDocId) {
        void deleteDoc(doc(db, 'orders', targetDocId)).catch((error) => {
          logFirestoreError(error, OperationType.DELETE, `orders/${targetDocId}`);
        });
      }
    },
    [persistBranch, stores]
  );

  const [reviews, setReviews] = useState<CustomerReview[]>(() => readLiveReviewsFromStorage());

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === LIVE_REVIEWS_STORAGE_KEY) {
        setReviews(readLiveReviewsFromStorage());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const addReview = useCallback(
    (entry: Omit<CustomerReview, 'id' | 'createdAt'>): CustomerReview => {
      const created: CustomerReview = {
        ...entry,
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setReviews((prev) => {
        const next = [created, ...prev];
        writeLiveReviewsToStorage(next);
        return next;
      });
      return created;
    },
    []
  );

  const deleteReview = useCallback((id: string) => {
    if (!isAdminEmail(auth.currentUser?.email)) return;
    setReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeLiveReviewsToStorage(next);
      return next;
    });
  }, []);

  const resetBranchDefaults = useCallback(
    (branchId: BranchId) => {
      if (!isAdminEmail(auth.currentUser?.email)) return;
      const defaults = INITIAL_BRANCH_STORES[branchId];
      persistBranch(
        branchId,
        (prev) => ({
          ...defaults,
          // Keep live Firestore orders intact on menu/offers reset
          orders: prev.orders,
        }),
        (next) => {
          syncMenuToFirestore(branchId, next.menu);
          syncOffersToFirestore(branchId, {
            shows: next.shows,
            cmsSettings: next.cmsSettings as BranchCmsSettings | undefined,
          });
          syncGalleryToFirestore(branchId, next.gallery);
        }
      );
    },
    [persistBranch, syncGalleryToFirestore, syncMenuToFirestore, syncOffersToFirestore]
  );

  return {
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
    addReservation,
    updateReservationStatus,
    deleteReservation,
    addOrder,
    updateOrderStatus,
    cancelOrderByCustomer,
    acknowledgeOrderCancellation,
    rateOrder,
    deleteOrder,
    resetBranchDefaults,
  };
}
