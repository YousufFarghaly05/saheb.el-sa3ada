import { useState, useCallback, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { CustomerUser, AuthSession } from '../types.ts';
import { auth, db, isAdminEmail, logFirestoreError, OperationType } from '../firebase.ts';
import {
  EGYPTIAN_PHONE_ERROR_AR,
  isValidEgyptianPhone,
  normalizeEgyptianPhoneInput,
} from '../utils/egyptianPhone.ts';

const CUSTOMER_STORAGE_KEY = 'saheb_elsaada_customer_session_v2';
const GUEST_FAVORITES_KEY = 'saheb_elsaada_guest_favorites_v1';
const CUSTOMER_EMAIL_DOMAIN = 'customers.saheb-elsaada.com';

const NON_ADMIN_ERROR_AR = 'عذراً، هذا الحساب لا يملك صلاحيات الإدارة';
const INVALID_ADMIN_CREDENTIALS_ERROR_AR = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';

function phoneToSyntheticEmail(cleanPhone: string): string {
  return `${cleanPhone}@${CUSTOMER_EMAIL_DOMAIN}`;
}

function extractPhoneFromSyntheticEmail(email: string | null | undefined): string {
  if (!email) return '';
  const suffix = `@${CUSTOMER_EMAIL_DOMAIN}`;
  if (email.toLowerCase().endsWith(suffix)) {
    return email.slice(0, -suffix.length);
  }
  return '';
}

function getFirebaseErrorCodeAndMessage(err: unknown): { code: string; message: string } {
  if (typeof err === 'object' && err !== null) {
    const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
    const message = 'message' in err ? String((err as { message?: unknown }).message || '') : '';
    return { code, message };
  }
  return { code: '', message: String(err || '') };
}

function formatCustomerAuthError(err: unknown): string {
  const { code, message } = getFirebaseErrorCodeAndMessage(err);

  if (code === 'auth/email-already-in-use') {
    return 'رقم الهاتف مسجل بالفعل، يمكنك تسجيل الدخول مباشرة';
  }
  if (code === 'auth/weak-password') {
    return 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'رقم الهاتف أو كلمة المرور غير صحيحة';
  }
  if (code === 'auth/invalid-email') {
    return 'يرجى إدخال رقم هاتف صحيح';
  }
  if (code === 'auth/too-many-requests') {
    return 'تم تجاوز عدد المحاولات المسموح بها مؤقتاً. يرجى المحاولة بعد قليل.';
  }
  if (code === 'auth/network-request-failed') {
    return 'تعذر الاتصال بخدمة Firebase. يرجى التحقق من الاتصال بالإنترنت.';
  }

  return message || code || 'حدث خطأ غير متوقع أثناء المصادقة';
}

function parseCustomerFromDoc(
  uid: string,
  data: Record<string, unknown> | undefined,
  fallbackPhone: string
): CustomerUser {
  const fullName =
    typeof data?.fullName === 'string' && data.fullName.trim()
      ? data.fullName.trim()
      : typeof data?.name === 'string' && data.name.trim()
      ? data.name.trim()
      : fallbackPhone;

  const phone =
    typeof data?.phone === 'string' && data.phone.trim()
      ? data.phone.trim()
      : fallbackPhone;

  const address = typeof data?.address === 'string' ? data.address : '';

  const favoriteMenuIds = Array.isArray(data?.favoriteMenuIds)
    ? data.favoriteMenuIds.filter((id): id is string => typeof id === 'string')
    : [];

  let createdAt = new Date().toISOString();
  const rawCreated = data?.createdAt as { toDate?: () => Date } | string | undefined;
  if (typeof rawCreated === 'string') {
    createdAt = rawCreated;
  } else if (rawCreated && typeof rawCreated.toDate === 'function') {
    createdAt = rawCreated.toDate().toISOString();
  }

  return {
    id: uid,
    name: fullName,
    phone,
    address,
    favoriteMenuIds,
    createdAt,
  };
}

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

  // Sync both Admin and Customer sessions via Firebase Authentication onAuthStateChanged
  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;

      if (firebaseUser) {
        if (isAdminEmail(firebaseUser.email)) {
          setAdminSession({
            token: firebaseUser.uid,
            role: 'admin',
            adminUsername: firebaseUser.email || '',
          });
          setFirebaseNonAdminEmail(null);
          setCustomer(null);
          try {
            localStorage.removeItem(CUSTOMER_STORAGE_KEY);
          } catch {
            // ignore
          }
          setAuthError(null);
        } else {
          setAdminSession(null);
          setFirebaseNonAdminEmail(firebaseUser.email || 'unknown');

          // Load customer profile from Firestore users/{uid}
          const fallbackPhone = extractPhoneFromSyntheticEmail(firebaseUser.email);
          try {
            const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (!active) return;
            if (snap.exists()) {
              const loaded = parseCustomerFromDoc(
                firebaseUser.uid,
                snap.data() as Record<string, unknown>,
                fallbackPhone
              );
              setCustomer(loaded);
              try {
                localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(loaded));
              } catch {
                // ignore
              }
            }
          } catch (error) {
            logFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
        }
      } else {
        setAdminSession(null);
        setFirebaseNonAdminEmail(null);
        setCustomer(null);
        try {
          localStorage.removeItem(CUSTOMER_STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      if (active) {
        setAdminAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loginCustomer = useCallback(async (identifier: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    const cleanPhone = normalizeEgyptianPhoneInput(identifier);
    if (!isValidEgyptianPhone(cleanPhone)) {
      setAuthError(EGYPTIAN_PHONE_ERROR_AR);
      setAuthLoading(false);
      return false;
    }

    const syntheticEmail = phoneToSyntheticEmail(cleanPhone);

    try {
      const credential = await signInWithEmailAndPassword(auth, syntheticEmail, password);
      const uid = credential.user.uid;

      let loadedCustomer: CustomerUser = {
        id: uid,
        name: cleanPhone,
        phone: cleanPhone,
        address: '',
        favoriteMenuIds: [],
        createdAt: new Date().toISOString(),
      };

      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          loadedCustomer = parseCustomerFromDoc(
            uid,
            snap.data() as Record<string, unknown>,
            cleanPhone
          );
        }
      } catch (profileErr) {
        logFirestoreError(profileErr, OperationType.GET, `users/${uid}`);
      }

      setCustomer(loadedCustomer);
      try {
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(loadedCustomer));
      } catch {
        // ignore
      }
      setAuthLoading(false);
      return true;
    } catch (err: unknown) {
      setAuthError(formatCustomerAuthError(err));
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

      const trimmedName = payload.name.trim();
      const cleanPhone = normalizeEgyptianPhoneInput(payload.phone);
      const trimmedAddress = payload.address.trim();

      if (!trimmedName) {
        setAuthError('يرجى إدخال الاسم الكامل');
        setAuthLoading(false);
        return false;
      }

      if (!isValidEgyptianPhone(cleanPhone)) {
        setAuthError(EGYPTIAN_PHONE_ERROR_AR);
        setAuthLoading(false);
        return false;
      }

      if (payload.password.length < 6) {
        setAuthError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        setAuthLoading(false);
        return false;
      }

      const syntheticEmail = phoneToSyntheticEmail(cleanPhone);

      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          syntheticEmail,
          payload.password
        );
        const uid = credential.user.uid;

        await setDoc(doc(db, 'users', uid), {
          fullName: trimmedName,
          phone: cleanPhone,
          address: trimmedAddress,
          role: 'customer',
          favoriteMenuIds: guestFavorites,
          createdAt: serverTimestamp(),
        });

        const newCustomer: CustomerUser = {
          id: uid,
          name: trimmedName,
          phone: cleanPhone,
          address: trimmedAddress,
          favoriteMenuIds: guestFavorites,
          createdAt: new Date().toISOString(),
        };

        setCustomer(newCustomer);
        try {
          localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(newCustomer));
        } catch {
          // ignore
        }
        setAuthLoading(false);
        return true;
      } catch (err: unknown) {
        setAuthError(formatCustomerAuthError(err));
        setAuthLoading(false);
        return false;
      }
    },
    [guestFavorites]
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

      const uid = auth.currentUser?.uid || payload.id;
      const trimmedName = payload.name.trim();
      const cleanPhone = normalizeEgyptianPhoneInput(payload.phone);
      const trimmedAddress = payload.address.trim();

      if (!isValidEgyptianPhone(cleanPhone)) {
        setAuthError(EGYPTIAN_PHONE_ERROR_AR);
        setAuthLoading(false);
        return false;
      }

      try {
        const nextFavorites = payload.favoriteMenuIds ?? customer?.favoriteMenuIds ?? [];

        await setDoc(
          doc(db, 'users', uid),
          {
            fullName: trimmedName,
            phone: cleanPhone,
            address: trimmedAddress,
            role: 'customer',
            favoriteMenuIds: nextFavorites,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const updatedCustomer: CustomerUser = {
          id: uid,
          name: trimmedName,
          phone: cleanPhone,
          address: trimmedAddress,
          favoriteMenuIds: nextFavorites,
          createdAt: customer?.createdAt || new Date().toISOString(),
        };

        setCustomer(updatedCustomer);
        try {
          localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updatedCustomer));
        } catch {
          // ignore
        }
        setAuthLoading(false);
        return true;
      } catch (err: unknown) {
        logFirestoreError(err, OperationType.WRITE, `users/${uid}`);
        setAuthError(formatCustomerAuthError(err));
        setAuthLoading(false);
        return false;
      }
    },
    [customer]
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
        try {
          localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(updatedCustomer));
        } catch {
          // ignore
        }

        const uid = auth.currentUser?.uid || customer.id;
        if (uid) {
          void setDoc(
            doc(db, 'users', uid),
            {
              fullName: customer.name,
              phone: customer.phone,
              address: customer.address,
              role: 'customer',
              favoriteMenuIds: nextFavs,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch((error) => {
            logFirestoreError(error, OperationType.WRITE, `users/${uid}`);
          });
        }
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

  const logoutCustomer = useCallback(async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors
    } finally {
      setCustomer(null);
      setFirebaseNonAdminEmail(null);
      setAuthError(null);
      try {
        localStorage.removeItem(CUSTOMER_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError(INVALID_ADMIN_CREDENTIALS_ERROR_AR);
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
      const { code } = getFirebaseErrorCodeAndMessage(err);

      if (code === 'auth/too-many-requests') {
        setAuthError('تم تجاوز عدد محاولات الدخول المسموح بها مؤقتاً. يرجى المحاولة بعد قليل.');
      } else if (code === 'auth/network-request-failed') {
        setAuthError('تعذر الاتصال بخدمة المصادقة. يرجى التحقق من الاتصال بالإنترنت.');
      } else {
        setAuthError(INVALID_ADMIN_CREDENTIALS_ERROR_AR);
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
