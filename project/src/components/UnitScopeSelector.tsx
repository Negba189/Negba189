import { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, Check, Building2, Lock } from 'lucide-react';
import { useUnitScope } from '@/context/UnitScopeContext';
import { useSystemUser } from '@/context/SystemUserContext';
import {
  type Unit,
  type UnitType,
  UNIT_TYPE_ORDER,
  UNIT_TYPE_LABELS,
  getUnitTypeColor,
} from '@/types';

interface ScopeOption {
  id: string | null;
  label: string;
  unit: Unit | null;
  depth: number;
}

export default function UnitScopeSelector() {
  const { selectedScopeUnitId, setSelectedScopeUnitId, units } = useUnitScope();
  const { allowedUnitIds, activeUser } = useSystemUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isScoped = !!allowedUnitIds;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const SCOPE_TYPES: UnitType[] = ['BRIGADE', 'BATTALION', 'COMPANY'];

  const options = useMemo((): ScopeOption[] => {
    // If the user has a restricted scope, the "all units" option shows their assigned unit name
    if (isScoped && allowedUnitIds) {
      const scopedUnits = units.filter((u) => allowedUnitIds.has(u.id));
      const root = scopedUnits.find((u) => !u.parent_unit_id || !allowedUnitIds.has(u.parent_unit_id));
      const result: ScopeOption[] = [
        { id: root?.id || null, label: root?.name || 'היחידה שלי', unit: root || null, depth: 0 },
      ];

      const childrenMap = new Map<string, Unit[]>();
      scopedUnits.forEach((u) => {
        if (u.parent_unit_id) {
          const arr = childrenMap.get(u.parent_unit_id) || [];
          arr.push(u);
          childrenMap.set(u.parent_unit_id, arr);
        }
      });

      const sortUnits = (arr: Unit[]) =>
        arr.sort((a, b) => {
          const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
          const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name, 'he');
        });

      const traverse = (unit: Unit, scopeDepth: number) => {
        if (SCOPE_TYPES.includes(unit.unit_type)) {
          if (unit.id !== root?.id) {
            result.push({ id: unit.id, label: unit.name, unit, depth: scopeDepth });
          }
          const children = (childrenMap.get(unit.id) || []).slice();
          sortUnits(children);
          children.forEach((child) => traverse(child, scopeDepth + 1));
        } else {
          const children = (childrenMap.get(unit.id) || []).slice();
          sortUnits(children);
          children.forEach((child) => traverse(child, scopeDepth));
        }
      };

      if (root) traverse(root, 1);
      return result;
    }

    // Full access (admin or no active user)
    const result: ScopeOption[] = [
      { id: null, label: 'כלל המערכת · חטיבה 189', unit: null, depth: 0 },
    ];

    const childrenMap = new Map<string, Unit[]>();
    units.forEach((u) => {
      if (u.parent_unit_id) {
        const arr = childrenMap.get(u.parent_unit_id) || [];
        arr.push(u);
        childrenMap.set(u.parent_unit_id, arr);
      }
    });

    const sortUnits = (arr: Unit[]) =>
      arr.sort((a, b) => {
        const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
        const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, 'he');
      });

    const traverse = (unit: Unit, scopeDepth: number) => {
      if (SCOPE_TYPES.includes(unit.unit_type)) {
        result.push({ id: unit.id, label: unit.name, unit, depth: scopeDepth });
        const children = (childrenMap.get(unit.id) || []).slice();
        sortUnits(children);
        children.forEach((child) => traverse(child, scopeDepth + 1));
      } else {
        const children = (childrenMap.get(unit.id) || []).slice();
        sortUnits(children);
        children.forEach((child) => traverse(child, scopeDepth));
      }
    };

    const roots = units.filter((u) => !u.parent_unit_id).slice();
    sortUnits(roots);
    roots.forEach((root) => traverse(root, 1));

    return result;
  }, [units, isScoped, allowedUnitIds]);

  const selectedOption = options.find((o) => o.id === selectedScopeUnitId) || options[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${
          open
            ? 'bg-brigade-600/20 border-brigade-500/40 text-brigade-300'
            : selectedScopeUnitId
              ? 'bg-brigade-600/10 border-brigade-500/25 text-brigade-300'
              : 'bg-slate-100/60 border-slate-300/50 text-slate-600 hover:text-slate-800 hover:border-slate-600'
        }`}
        disabled={isScoped && options.length <= 1}
      >
        {isScoped ? <Lock className="w-3.5 h-3.5 flex-shrink-0 text-brigade-400" /> : <Filter className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="font-medium hidden sm:inline">סינון לפי מסגרת:</span>
        <span className={`font-semibold truncate max-w-[120px] lg:max-w-[180px] ${
          selectedScopeUnitId ? 'text-slate-900' : 'text-slate-600'
        }`}>
          {selectedOption?.label}
        </span>
        {(!isScoped || options.length > 1) && (
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (!isScoped || options.length > 1) && (
        <div className="absolute left-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-2xl z-50 py-1.5">
          {options.map((opt) => {
            const isSelected = opt.id === selectedScopeUnitId;
            return (
              <button
                key={opt.id || 'all'}
                onClick={() => {
                  setSelectedScopeUnitId(opt.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-right transition-colors ${
                  isSelected
                    ? 'bg-brigade-600/20 text-brigade-300'
                    : 'text-slate-600 hover:bg-slate-100/60'
                }`}
                style={{ paddingRight: `${opt.depth * 16 + 12}px` }}
              >
                {isSelected ? (
                  <Check className="w-4 h-4 flex-shrink-0 text-brigade-400" />
                ) : (
                  <span className="w-4 flex-shrink-0" />
                )}
                {opt.unit ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <span className="text-sm flex-1 truncate">{opt.label}</span>
                    <span className={`badge text-[9px] flex-shrink-0 ${getUnitTypeColor(opt.unit.unit_type)}`}>
                      {UNIT_TYPE_LABELS[opt.unit.unit_type]}
                    </span>
                  </>
                ) : (
                  <>
                    {isScoped ? (
                      <Lock className="w-3.5 h-3.5 flex-shrink-0 text-brigade-400" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-brigade-400" />
                    )}
                    <span className="text-sm flex-1 font-semibold truncate">{opt.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
