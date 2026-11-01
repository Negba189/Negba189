import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { SystemUser } from '@/types';

interface AuthContextValue {
  authenticatedUser: SystemUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'brigade189_auth_user_id';

function isValidSystemUser(data: unknown): data is SystemUser {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.full_name === 'string' &&
    typeof obj.role === 'string';
}

function safeGetItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked — in-memory state is the source of truth
  }
}

function safeRemoveItem(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // No-op
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticatedUser, setAuthenticatedUser] = useState<SystemUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const storedId = safeGetItem(STORAGE_KEY);
    if (!storedId) {
      setLoading(false);
      return;
    }

    supabase
      .from('system_users')
      .select('*, units(*)')
      .eq('id', storedId)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !isValidSystemUser(data)) {
          safeRemoveItem(STORAGE_KEY);
          safeRemoveItem('system_user');
          setLoading(false);
          return;
        }
        setAuthenticatedUser(data);
        setLoading(false);
      });
  }, []);

  const login = async (email: string, _pass: string) => {
    try {
      if (!email) {
        return { success: false, error: 'יש להזין אימייל' };
      }

      const { data, error } = await supabase
        .from('system_users')
        .select('*, units(*)')
        .eq('email', email.trim().toLowerCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data || !isValidSystemUser(data)) {
        return { success: false, error: 'המשתמש אינו קיים במערכת או אינו פעיל' };
      }

      setAuthenticatedUser(data);
      safeSetItem(STORAGE_KEY, data.id);
      return { success: true };
    } catch {
      return { success: false, error: 'שגיאה בהתחברות למערכת' };
    }
  };

  const logout = useCallback(() => {
    safeRemoveItem(STORAGE_KEY);
    safeRemoveItem('system_user');
    setAuthenticatedUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticatedUser,
        isAuthenticated: !!authenticatedUser,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}