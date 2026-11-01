import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import type { Unit } from '@/types';
import { useSystemUser } from '@/context/SystemUserContext';

interface UnitScopeContextValue {
  /** null = all units (full brigade view); otherwise the selected unit ID */
  selectedScopeUnitId: string | null;
  setSelectedScopeUnitId: (id: string | null) => void;
  /** The selected unit object, or null if viewing all units */
  scopeUnit: Unit | null;
  /** Set of all descendant unit IDs (including the selected unit itself).
   *  null when no scope is selected (= all units). */
  descendantIds: Set<string> | null;
  /** All units fetched from the database (for dropdowns, path building, etc.) */
  units: Unit[];
  loading: boolean;
}

const UnitScopeContext = createContext<UnitScopeContextValue | undefined>(undefined);

export function UnitScopeProvider({ children }: { children: ReactNode }) {
  const { allowedUnitIds, activeUserId } = useSystemUser();
  const [selectedScopeUnitId, setSelectedScopeUnitId] = useState<string | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('units')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setUnits(data as Unit[]);
        setLoading(false);
      });
  }, []);

  // When the active user changes, reset scope to their assigned unit (or all for admin)
  useEffect(() => {
    if (allowedUnitIds && allowedUnitIds.size > 0) {
      const allowedUnits = units.filter((u) => allowedUnitIds.has(u.id));
      const root = allowedUnits.find((u) => !u.parent_unit_id || !allowedUnitIds.has(u.parent_unit_id));
      setSelectedScopeUnitId(root?.id || null);
    } else {
      // Admin / no restriction / no allowed units — full brigade
      setSelectedScopeUnitId(null);
    }
  }, [allowedUnitIds, activeUserId, units]);

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

  const scopeUnit = useMemo(
    () => units.find((u) => u.id === selectedScopeUnitId) || null,
    [units, selectedScopeUnitId],
  );

  // Compute effective descendant IDs — intersection of selected scope and allowed scope
  const descendantIds = useMemo(() => {
    let scopeSet: Set<string> | null = null;
    if (selectedScopeUnitId) {
      scopeSet = descendantMaps[selectedScopeUnitId] || new Set([selectedScopeUnitId]);
    }
    // If the user has an allowed scope, intersect or use the allowed scope directly
    if (allowedUnitIds) {
      if (scopeSet) {
        const intersection = new Set<string>();
        scopeSet.forEach((id) => {
          if (allowedUnitIds.has(id)) intersection.add(id);
        });
        return intersection.size > 0 ? intersection : allowedUnitIds;
      }
      return allowedUnitIds;
    }
    return scopeSet;
  }, [selectedScopeUnitId, descendantMaps, allowedUnitIds]);

  return (
    <UnitScopeContext.Provider
      value={{
        selectedScopeUnitId,
        setSelectedScopeUnitId,
        scopeUnit,
        descendantIds,
        units,
        loading,
      }}
    >
      {children}
    </UnitScopeContext.Provider>
  );
}

export function useUnitScope(): UnitScopeContextValue {
  const ctx = useContext(UnitScopeContext);
  if (!ctx) throw new Error('useUnitScope must be used within UnitScopeProvider');
  return ctx;
}
