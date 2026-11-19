import { useState, useCallback } from 'react';
import type { CustomerUser, AuthSession } from '../types.ts';

const CUSTOMER_STORAGE_KEY = 'saheb_elsaada_customer_session_v2';
const ADMIN_STORAGE_KEY = 'saheb_elsaada_admin_session_v2';
const ADMIN_CREDENTIALS_KEY = 'saheb_elsaada_admin_credentials_v1';
const GUEST_FAVORITES_KEY = 'saheb_elsaada_guest_favorites_v1';

interface StoredAdminCredentials {
  username: string;
  password: string;
}

function getStoredAdminCredentials(): StoredAdminCredentials | null {
  try {
    const raw = localStorage.getItem(ADMIN_CREDENTIALS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAdminCredentials>;
    if (parsed.username && parsed.password) {
      return { username: parsed.username, password: parsed.password };
    }
    return null;
  } catch {
    return null;
  }
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

  const [adminSession, setAdminSession] = useState<AuthSession | null>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

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

  const loginAdmin = useCallback(async (username: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError(null);

    const customCreds = getStoredAdminCredentials();
    const inputUser = username.trim().toLowerCase();

    // If owner saved custom credentials in localStorage, validate strictly against them
    if (customCreds) {
      if (inputUser === customCreds.username.toLowerCase() && password === customCreds.password) {
        const session: AuthSession = {
          token: `local-owner-${Date.now()}`,
          role: 'admin',
          adminUsername: customCreds.username,
        };
        setAdminSession(session);
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
        setAuthLoading(false);
        return true;
      }
      setAuthError('بيانات دخول الإدارة غير صحيحة');
      setAuthLoading(false);
      return false;
    }

    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'بيانات دخول الإدارة غير صحيحة');
        setAuthLoading(false);
        return false;
      }
      setAdminSession(data.session);
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data.session));
      setAuthLoading(false);
      return true;
    } catch {
      if (inputUser === 'admin' && password === '123456') {
        const fallbackSession: AuthSession = {
          token: 'local-owner-token',
          role: 'admin',
          adminUsername: 'admin',
        };
        setAdminSession(fallbackSession);
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(fallbackSession));
        setAuthLoading(false);
        return true;
      }
      setAuthError('حدث خطأ في الاتصال بالخادم');
      setAuthLoading(false);
      return false;
    }
  }, []);

  const updateAdminCredentials = useCallback(
    (payload: {
      currentPassword: string;
      newUsername: string;
      newPassword: string;
    }): { ok: boolean; error?: string } => {
      const existing = getStoredAdminCredentials() ?? { username: 'admin', password: '123456' };
      if (payload.currentPassword !== existing.password) {
        return {
          ok: false,
          error: 'كلمة المرور الحالية غير صحيحة.',
        };
      }
      const cleanUser = payload.newUsername.trim();
      if (cleanUser.length < 3) {
        return {
          ok: false,
          error: 'يجب أن يكون اسم المستخدم ٣ أحرف على الأقل.',
        };
      }
      if (payload.newPassword.length < 4) {
        return {
          ok: false,
          error: 'يجب أن تكون كلمة المرور الجديدة ٤ أحرف على الأقل.',
        };
      }

      const nextCreds: StoredAdminCredentials = {
        username: cleanUser,
        password: payload.newPassword,
      };
      try {
        localStorage.setItem(ADMIN_CREDENTIALS_KEY, JSON.stringify(nextCreds));
      } catch {
        return { ok: false, error: 'تعذر الحفظ في المتصفح.' };
      }

      setAdminSession((prev) => {
        if (!prev) return prev;
        const updated: AuthSession = { ...prev, adminUsername: cleanUser };
        try {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });

      return { ok: true };
    },
    []
  );

  const logoutAdmin = useCallback(() => {
    setAdminSession(null);
    localStorage.removeItem(ADMIN_STORAGE_KEY);
  }, []);

  return {
    customer,
    adminSession,
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
    updateAdminCredentials,
    logoutAdmin,
  };
}
