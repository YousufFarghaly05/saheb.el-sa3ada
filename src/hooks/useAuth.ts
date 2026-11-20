import { useState, useCallback, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import type { CustomerUser, AuthSession } from '../types.ts';
import { auth, isAdminEmail } from '../firebase.ts';

const CUSTOMER_STORAGE_KEY = 'saheb_elsaada_customer_session_v2';
const GUEST_FAVORITES_KEY = 'saheb_elsaada_guest_favorites_v1';

const NON_ADMIN_ERROR_AR = 'عذراً، هذا الحساب لا يملك صلاحيات الإدارة';
const INVALID_CREDENTIALS_ERROR_AR = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';

export function useAuth() {
  const [customer, setCustomer] = useState<CustomerUser | null>(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const [adminSession, setAdminSession] = useState<AuthSession | null>(null);
  const [adminAuthReady, setAdminAuthReady] = useState<boolean>(false);
  const [firebaseNonAdminEmail, setFirebaseNonAdminEmail] = useState<string | null>(null);

  const [guestFavorites, setGuestFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(GUEST_FAVORITES_KEY);
      return raw ? JSON.parse(raw) : ['m-1', 'm-5'];
    } catch {
      return ['m-1', 'm-5'];
    }
  });

  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Clean up any legacy localStorage admin session/credential keys from previous builds
  useEffect(() => {
    try {
      localStorage.removeItem('saheb_elsaada_admin_session_v2');
      localStorage.removeItem('saheb_elsaada_admin_credentials_v1');
      localStorage.removeItem('saheb_elsaada_admin_credentials_v2');
    } catch {
      // ignore storage errors
    }
  }, []);

  // Strictly verify Admin session via Firebase Authentication onAuthStateChanged
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        if (isAdminEmail(firebaseUser.email)) {
          setAdminSession({
            token: firebaseUser.uid,
            role: 'admin',
            adminUsername: firebaseUser.email || '',
          });
          setFirebaseNonAdminEmail(null);
          setAuthError(null);
        } else {
          setAdminSession(null);
          setFirebaseNonAdminEmail(firebaseUser.email || 'unknown');
        }
      } else {
        setAdminSession(null);
        setFirebaseNonAdminEmail(null);
      }
      setAdminAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const loginCustomer = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'فشل تسجيل الدخول');
        setAuthLoading(false);
        return false;
      }
      setCustomer(data.user);
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(data.user));
      setAuthLoading(false);
      return true;
    } catch {
      setAuthError('حدث خطأ في الاتصال بالخادم');
      setAuthLoading(false);
      return false;
    }
  }, []);

  const signupCustomer = useCallback(
    async (payload: {
      name: string;
      phone: string;
      address: string;
      password: string;
    }): Promise<boolean> => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/customer/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || 'فشل إنشاء الحساب');
          setAuthLoading(false);
          return false;
        }
        setCustomer(data.user);
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(data.user));
        setAuthLoading(false);
        return true;
      } catch {
        setAuthError('حدث خطأ في الاتصال بالخادم');
        setAuthLoading(false);
        return false;
      }
    },
    []
  );

  const updateCustomerProfile = useCallback(
    async (payload: {
      id: string;
      name: string;
      phone: string;
      address: string;
      favoriteMenuIds?: string[];
    }): Promise<boolean> => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await fetch('/api/auth/customer/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setAuthError(data.error || 'فشل تحديث الحساب');
          setAuthLoading(false);
          return false;
        }
        setCustomer(data.user);
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(data.user));
        setAuthLoading(false);
        return true;
      } catch {
        setAuthError('حدث خطأ في الاتصال');
        setAuthLoading(false);
        return false;
      }
    },
    []
  );

  const toggleFavoriteDish = useCallback(
    (menuItemId: string) => {
      if (customer) {
        const currentFavs = customer.favoriteMenuIds || [];
        const nextFavs = currentFavs.includes(menuItemId)
          ? currentFavs.filter((id) => id !== menuItemId)
          : [...currentFavs, menuItemId];
        const updatedCustomer: CustomerUser = {
          ...customer,
          favoriteMenuIds: nextFavs,
        };
        setCustomer(updatedCustomer);
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updatedCustomer));
        fetch('/api/auth/customer/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            address: customer.address,
            favoriteMenuIds: nextFavs,
          }),
        }).catch(() => {});
      } else {
        setGuestFavorites((prev) => {
          const next = prev.includes(menuItemId)
            ? prev.filter((id) => id !== menuItemId)
            : [...prev, menuItemId];
          try {
            localStorage.setItem(GUEST_FAVORITES_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      }
    },
    [customer]
  );

  const favoriteIds = customer ? customer.favoriteMenuIds || [] : guestFavorites;

  const logoutCustomer = useCallback(() => {
    setCustomer(null);
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError(INVALID_CREDENTIALS_ERROR_AR);
      setAuthLoading(false);
      return false;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      const signedInEmail = credential.user.email;

      if (!isAdminEmail(signedInEmail)) {
        await signOut(auth).catch(() => {});
        setAdminSession(null);
        setAuthError(NON_ADMIN_ERROR_AR);
        setAuthLoading(false);
        return false;
      }

      setAdminSession({
        token: credential.user.uid,
        role: 'admin',
        adminUsername: signedInEmail || '',
      });
      setFirebaseNonAdminEmail(null);
      setAuthLoading(false);
      return true;
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';

      if (code === 'auth/too-many-requests') {
        setAuthError('تم تجاوز عدد محاولات الدخول المسموح بها مؤقتاً. يرجى المحاولة بعد قليل.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('تعذر الاتصال بخدمة المصادقة. يرجى التحقق من الاتصال بالإنترنت.');
      } else {
        setAuthError(INVALID_CREDENTIALS_ERROR_AR);
      }

      setAdminSession(null);
      setAuthLoading(false);
      return false;
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors
    } finally {
      setAdminSession(null);
      setFirebaseNonAdminEmail(null);
      setAuthError(null);
    }
  }, []);

  return {
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
  };
}
