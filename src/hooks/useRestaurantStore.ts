import { useState, useEffect, useCallback, useRef } from 'react';
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

const BRANCH_STORAGE_KEYS: Record<BranchId, string> = {
  branch_tagamoa: 'branch_tagamoa',
  branch_moez: 'branch_moez',
  branch_zayed: 'branch_zayed',
};

const STORE_BROADCAST_CHANNEL = 'saheb_elsaada_store_sync_v1';
export const ORDER_CANCEL_WINDOW_MS = 15 * 60 * 1000;

export const LIVE_REVIEWS_STORAGE_KEY = 'saheb_elsaada_live_reviews_v1';

function readLiveReviewsFromStorage(): CustomerReview[] {
  try {
    const raw = localStorage.getItem(LIVE_REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is CustomerReview =>
        Boolean(r && typeof r === 'object' && typeof r.id === 'string' && typeof r.author === 'string' && typeof r.comment === 'string')
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
  // Detect old pre-PDF 12-15 item sample menus or unmigrated juice sahlab images
  return (
    menu.some((m) => m.id === 'm-1' || m.id === 'moez-m-1') ||
    menu.some((m) => m.id.endsWith('-juc-1') && m.imageUrl === '/assets/aistudio/unnamed_062b5ea3.jpg') ||
    (menu.length < 30 && !menu.some((m) => m.id.startsWith('tag-') || m.id.startsWith('moez-brk-') || m.id.startsWith('zayed-')))
  );
}

const CMS_MIGRATION_KEY = 'saheb_elsaada_cms_neutral_v3';

function hasLegacyPartyShows(shows: ShowSchedule[] | undefined): boolean {
  if (!Array.isArray(shows) || shows.length === 0) return false;
  return shows.some((s) =>
    ['s-sat', 'moez-s-sat', 'zayed-s-sat'].includes(s.id)
  );
}

function hasLegacyShishaOrGallery(parsed: Partial<StoreState>): boolean {
  const hasLegacyShisha =
    Array.isArray(parsed.menu) &&
    parsed.menu.some((m) => m.category === 'shisha' || ['tag-shs-1', 'tag-shs-2', 'moez-shs-1', 'moez-shs-2'].includes(m.id));
  const hasLegacyGallery =
    Array.isArray(parsed.gallery) &&
    parsed.gallery.some(
      (g) =>
        ['g-2', 'g-4', 'moez-g-2', 'moez-g-3', 'zayed-g-1', 'zayed-g-3'].includes(g.id) &&
        /تنورة|شيشة|عود|مسرح|tanoura|shisha|oud/i.test(`${g.titleAr} ${g.titleEn || ''}`)
    );
  return hasLegacyShisha || hasLegacyGallery;
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
    shows:
      Array.isArray(parsed.shows) && parsed.shows.length && !hasLegacyPartyShows(parsed.shows)
        ? parsed.shows
        : fallback.shows,
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
        shows: hasLegacyPartyShows(parsed.shows) ? INITIAL_BRANCH_STORES[branchId].shows : normalized.shows,
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

export function useRestaurantStore() {
  const [stores, setStores] = useState<DualBranchStoreState>(() => {
    try {
      // Remove legacy single-branch storage keys
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

  const lastLocalWriteRef = useRef<number>(0);
  const channelRef = useRef<BroadcastChannel | null>(null);

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
      if (
        e.key === 'branch_tagamoa' ||
        e.key === 'branch_moez' ||
        e.key === 'branch_zayed'
      ) {
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

  useEffect(() => {
    let active = true;
    fetch('/api/store')
      .then((res) => (res.ok ? res.json() : null))
      .then((serverPayload: Partial<DualBranchStoreState> | null) => {
        if (!active || !serverPayload) return;

        const hasLocalTagamoa = Boolean(localStorage.getItem(BRANCH_STORAGE_KEYS.branch_tagamoa));
        const hasLocalMoez = Boolean(localStorage.getItem(BRANCH_STORAGE_KEYS.branch_moez));
        const hasLocalZayed = Boolean(localStorage.getItem(BRANCH_STORAGE_KEYS.branch_zayed));

        setStores((prev) => {
          const nextTagamoa =
            !hasLocalTagamoa && serverPayload.branch_tagamoa
              ? normalizeBranchStore(
                  serverPayload.branch_tagamoa,
                  INITIAL_BRANCH_STORES.branch_tagamoa
                )
              : prev.branch_tagamoa;

          const nextMoez =
            !hasLocalMoez && serverPayload.branch_moez
              ? normalizeBranchStore(serverPayload.branch_moez, INITIAL_BRANCH_STORES.branch_moez)
              : prev.branch_moez;

          const nextZayed =
            !hasLocalZayed && serverPayload.branch_zayed
              ? normalizeBranchStore(
                  serverPayload.branch_zayed,
                  INITIAL_BRANCH_STORES.branch_zayed
                )
              : prev.branch_zayed;

          if (!hasLocalTagamoa) writeBranchToLocalStorage('branch_tagamoa', nextTagamoa);
          if (!hasLocalMoez) writeBranchToLocalStorage('branch_moez', nextMoez);
          if (!hasLocalZayed) writeBranchToLocalStorage('branch_zayed', nextZayed);

          return {
            branch_tagamoa: nextTagamoa,
            branch_moez: nextMoez,
            branch_zayed: nextZayed,
          };
        });
      })
      .catch(() => {});

    // Periodic lightweight sync for orders & reservations across sessions
    const pollInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastLocalWriteRef.current < 3000) return;

      fetch('/api/store')
        .then((res) => (res.ok ? res.json() : null))
        .then((serverPayload: Partial<DualBranchStoreState> | null) => {
          if (!active || !serverPayload) return;
          if (Date.now() - lastLocalWriteRef.current < 3000) return;

          setStores((prev) => {
            let changed = false;
            const next: DualBranchStoreState = { ...prev };

            (['branch_tagamoa', 'branch_moez', 'branch_zayed'] as BranchId[]).forEach((bId) => {
              const serverOrders = serverPayload[bId]?.orders;
              if (!Array.isArray(serverOrders)) return;
              const prevOrders = prev[bId].orders;
              const prevOrderMap = new Map(prevOrders.map((o) => [o.id, o]));
              let branchOrdersChanged = false;
              const mergedOrders = [...prevOrders];

              serverOrders.forEach((srvOrder) => {
                const localOrder = prevOrderMap.get(srvOrder.id);
                if (!localOrder) {
                  mergedOrders.unshift(srvOrder);
                  branchOrdersChanged = true;
                } else if (
                  localOrder.status !== srvOrder.status ||
                  localOrder.adminCancelAcknowledged !== srvOrder.adminCancelAcknowledged ||
                  localOrder.cancelledBy !== srvOrder.cancelledBy
                ) {
                  const idx = mergedOrders.findIndex((o) => o.id === srvOrder.id);
                  if (idx >= 0) {
                    mergedOrders[idx] = { ...localOrder, ...srvOrder };
                    branchOrdersChanged = true;
                  }
                }
              });

              if (branchOrdersChanged) {
                changed = true;
                const updatedBranch = { ...prev[bId], orders: mergedOrders };
                next[bId] = updatedBranch;
                writeBranchToLocalStorage(bId, updatedBranch);
              }
            });

            return changed ? next : prev;
          });
        })
        .catch(() => {});
    }, 4500);

    return () => {
      active = false;
      window.clearInterval(pollInterval);
    };
  }, []);

  const persistBranch = useCallback(
    (branchId: BranchId, updater: (prevBranch: StoreState) => StoreState) => {
      lastLocalWriteRef.current = Date.now();
      setStores((prev) => {
        const nextBranch = updater(prev[branchId]);
        const nextStores: DualBranchStoreState = {
          ...prev,
          [branchId]: nextBranch,
        };
        writeBranchToLocalStorage(branchId, nextBranch);
        channelRef.current?.postMessage({ branchId, data: nextBranch });
        fetch('/api/store', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextStores),
        }).catch(() => {});
        return nextStores;
      });
    },
    []
  );

  // Branch Contact / WhatsApp / Payment Settings (Scoped strictly to branchId)
  const updateBranchSettings = useCallback(
    (branchId: BranchId, settings: Partial<BranchContactSettings>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        branchSettings: {
          ...(prev.branchSettings || {}),
          ...settings,
        },
      }));
    },
    [persistBranch]
  );

  // Branch CMS Announcements & Reservation Notes (Scoped strictly to branchId)
  const updateCmsSettings = useCallback(
    (branchId: BranchId, settings: Partial<BranchCmsSettings>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        cmsSettings: {
          ...(prev.cmsSettings || {}),
          ...settings,
        },
      }));
    },
    [persistBranch]
  );

  // Menu CRUD (Scoped strictly to branchId)
  const addMenuItem = useCallback(
    (branchId: BranchId, item: Omit<MenuItem, 'id'>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        menu: [{ ...item, id: `${branchId}-m-${Date.now()}` }, ...prev.menu],
      }));
    },
    [persistBranch]
  );

  const updateMenuItem = useCallback(
    (branchId: BranchId, id: string, item: Partial<MenuItem>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        menu: prev.menu.map((m) => (m.id === id ? { ...m, ...item } : m)),
      }));
    },
    [persistBranch]
  );

  const deleteMenuItem = useCallback(
    (branchId: BranchId, id: string) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        menu: prev.menu.filter((m) => m.id !== id),
      }));
    },
    [persistBranch]
  );

  // Live Shows CRUD (Scoped strictly to branchId)
  const addShow = useCallback(
    (branchId: BranchId, show: Omit<ShowSchedule, 'id'>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        shows: [...prev.shows, { ...show, id: `${branchId}-s-${Date.now()}` }],
      }));
    },
    [persistBranch]
  );

  const updateShow = useCallback(
    (branchId: BranchId, id: string, show: Partial<ShowSchedule>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        shows: prev.shows.map((s) => (s.id === id ? { ...s, ...show } : s)),
      }));
    },
    [persistBranch]
  );

  const deleteShow = useCallback(
    (branchId: BranchId, id: string) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        shows: prev.shows.filter((s) => s.id !== id),
      }));
    },
    [persistBranch]
  );

  // Gallery CRUD (Scoped strictly to branchId)
  const addGalleryPhoto = useCallback(
    (branchId: BranchId, photo: Omit<GalleryPhoto, 'id'>) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        gallery: [
          {
            ...photo,
            id: `${branchId}-g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          },
          ...prev.gallery,
        ],
      }));
    },
    [persistBranch]
  );

  const addGalleryPhotosBulk = useCallback(
    (branchId: BranchId, photos: Omit<GalleryPhoto, 'id'>[]) => {
      persistBranch(branchId, (prev) => {
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
      });
    },
    [persistBranch]
  );

  const deleteGalleryPhoto = useCallback(
    (branchId: BranchId, id: string) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        gallery: prev.gallery.filter((g) => g.id !== id),
      }));
    },
    [persistBranch]
  );

  // Reservations & Orders CRUD (Scoped strictly to branchId)
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
      persistBranch(branchId, (prev) => ({
        ...prev,
        reservations: prev.reservations.map((r) => (r.id === id ? { ...r, status } : r)),
      }));
    },
    [persistBranch]
  );

  const deleteReservation = useCallback(
    (branchId: BranchId, id: string) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        reservations: prev.reservations.filter((r) => r.id !== id),
      }));
    },
    [persistBranch]
  );

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
      const created: OnlineOrder = {
        ...entry,
        branchId,
        id: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: [created, ...prev.orders],
      }));
      return created;
    },
    [persistBranch]
  );

  const updateOrderStatus = useCallback(
    (branchId: BranchId, id: string, status: BookingStatus) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) => {
          if (o.id !== id) return o;
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
    },
    [persistBranch]
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
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === id ? { ...o, adminCancelAcknowledged: true } : o
        ),
      }));
    },
    [persistBranch]
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

  const deleteOrder = useCallback(
    (branchId: BranchId, id: string) => {
      persistBranch(branchId, (prev) => ({
        ...prev,
        orders: prev.orders.filter((o) => o.id !== id),
      }));
    },
    [persistBranch]
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
    setReviews((prev) => {
      const next = prev.filter((r) => r.id !== id);
      writeLiveReviewsToStorage(next);
      return next;
    });
  }, []);

  const resetBranchDefaults = useCallback(
    (branchId: BranchId) => {
      persistBranch(branchId, () => INITIAL_BRANCH_STORES[branchId]);
    },
    [persistBranch]
  );

  return {
    stores,
    reviews,
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
