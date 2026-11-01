import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { SystemUser, Unit } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface SystemUserContextValue {
  systemUsers: SystemUser[];
  activeUser: SystemUser | null;
  activeUserId: string | null;
  setActiveUserId: (id: string | null) => void;
  activeUnit: Unit | null;
  allowedUnitIds: Set<string> | null;
  canEdit: boolean;
  canManagePositionsAndQuals: boolean; // חדש: האם מותר לגעת בתקינה ובהסמכות (רק ADMIN)
  canManageUsers: boolean;
  loading: boolean;
  refresh: () => void;
}

const SystemUserContext = createContext<SystemUserContextValue | undefined>(undefined);

function isValidSystemUser(data: unknown): data is SystemUser {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return typeof obj.id === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.full_name === 'string' &&
    typeof obj.role === 'string';
}

export function SystemUserProvider({ children }: { children: ReactNode }) {
  const { authenticatedUser } = useAuth();
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [simulatedUserId, setSimulatedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    Promise.all([
      supabase.from('system_users').select('*, units(*)').order('full_name'),
      supabase.from('units').select('*').order('name'),
    ]).then(([usersRes, unitsRes]) => {
      if (usersRes.data) {
        const valid = (usersRes.data as unknown[]).filter(isValidSystemUser) as SystemUser[];
        setSystemUsers(valid);
      }
      if (unitsRes.data) setUnits(unitsRes.data as Unit[]);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [refreshKey]);

  useEffect(() => {
    setSimulatedUserId(null);
  }, [authenticatedUser]);

  const activeUserId = simulatedUserId ?? authenticatedUser?.id ?? null;
  
  // התאמה: שיוך המשתמש מתוך טבלת ה-system_users האמיתית לפי אימייל או מזהה
  const activeUser = useMemo<SystemUser | null>(() => {
    if (simulatedUserId) {
      const found = systemUsers.find((u) => u.id === simulatedUserId);
      if (found) return found;
    }
    if (authenticatedUser?.email) {
      const dbUser = systemUsers.find((u) => u.email.toLowerCase() === authenticatedUser.email.toLowerCase());
      if (dbUser) return dbUser;
    }
    return authenticatedUser ?? null;
  }, [systemUsers, simulatedUserId, authenticatedUser]);

  const setActiveUserId = (id: string | null) => {
    setSimulatedUserId(id);
  };

  const descendantMaps = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    units.forEach((u) => {
      if (u.parent_unit_id) {
        const arr = childrenMap.get(u.parent_unit_id) || [];
        arr.push(u.id);
        childrenMap.set(u.parent_unit_id, arr);
      }
    });

    const result: Record<string, Set<string>> = {};
    const collect = (unitId: string, seen: Set<string>): Set<string> => {
      if (result[unitId] !== undefined) {
        result[unitId].forEach((id) => seen.add(id));
        return seen;
      }
      seen.add(unitId);
      (childrenMap.get(unitId) || []).forEach((childId) => collect(childId, seen));
      return seen;
    };

    units.forEach((u) => {
      if (result[u.id] === undefined) {
        result[u.id] = collect(u.id, new Set());
      }
    });
    return result;
  }, [units]);

  const activeUnit = useMemo(
    () => units.find((u) => u.id === activeUser?.assigned_unit_id) || null,
    [units, activeUser],
  );

  const allowedUnitIds = useMemo((): Set<string> | null => {
    if (!activeUser) return null;
    if (activeUser.role === 'ADMIN') return null; // אדמין רואה הכל (סקופ מלא)
    if (!activeUser.assigned_unit_id) return null;
    return descendantMaps[activeUser.assigned_unit_id] || new Set([activeUser.assigned_unit_id]);
  }, [activeUser, descendantMaps]);

  // הגדרות הרשאה מדויקות לפי הדרישה:
  const canEdit = activeUser?.role !== 'VIEWER'; // האם יש הרשאת הוספה/שיבוץ כוח אדם
  const canManagePositionsAndQuals = activeUser?.role === 'ADMIN'; // רק אדמין יכול לגעת בתקינה ובהסמכות!
  const canManageUsers = activeUser?.role === 'ADMIN';

  return (
    <SystemUserContext.Provider
      value={{
        systemUsers,
        activeUser,
        activeUserId,
        setActiveUserId,
        activeUnit,
        allowedUnitIds,
        canEdit,
        canManagePositionsAndQuals,
        canManageUsers,
        loading,
        refresh,
      }}
    >
      {children}
    </SystemUserContext.Provider>
  );
}

export function useSystemUser(): SystemUserContextValue {
  const ctx = useContext(SystemUserContext);
  if (!ctx) throw new Error('useSystemUser must be used within SystemUserProvider');
  return ctx;
}