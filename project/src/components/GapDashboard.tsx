import { useMemo } from 'react';
import {
  Target,
  Users,
  AlertTriangle,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  KeyRound,
} from 'lucide-react';
import {
  type Position,
  type Unit,
  type PositionStatus,
  POSITION_STATUS_CONFIG,
  getUnitTypeLabel,
  getUnitTypeColor,
} from '@/types';
import { buildHierarchicalUnitList, buildDescendantMaps, type HierarchicalUnit } from '@/lib/unitHierarchy';
import { useState } from 'react';

interface GapDashboardProps {
  positions: Position[];
  units: Unit[];
  statusMap: Record<string, { status: PositionStatus; activeAssignments?: { person_id: string; is_active?: boolean }[] }>;
  scopeUnitIds: Set<string> | null;
}

interface UnitGapMetrics {
  total: number;
  assigned: number;
  gap: number;
  keyGap: number;
  keyTotal: number;
  ready: number;
  unqualified: number;
  acting: number;
  overstaffed: number;
  fillRate: number;
}

function computeUnitMetrics(
  positions: Position[],
  descendantIds: Set<string>,
  statusMap: GapDashboardProps['statusMap'],
): UnitGapMetrics {
  const relevant = positions.filter(
    (p) => p.unit_id !== null && descendantIds.has(p.unit_id) && p.is_active,
  );

  const metrics: UnitGapMetrics = {
    total: 0,
    assigned: 0,
    gap: 0,
    keyGap: 0,
    keyTotal: 0,
    ready: 0,
    unqualified: 0,
    acting: 0,
    overstaffed: 0,
    fillRate: 0,
  };

  relevant.forEach((p) => {
    metrics.total++;
    if (p.is_key_position) metrics.keyTotal++;

    const posStatusInfo = statusMap[p.id];
    
    // בדיקה ודיבוג: נראה מה הסטטוס והשיוכים שמגיעים לכל תקן
    console.log(`Position [${p.title} - ${p.id}]:`, {
      posStatusInfo,
      activeAssignments: posStatusInfo?.activeAssignments
    });

    const activeAssigns = (posStatusInfo?.activeAssignments || []).filter((a) => a.is_active !== false);
    const effectiveCount = activeAssigns.length;

    const status = effectiveCount === 0 ? 'SHORTAGE' : posStatusInfo?.status;

    switch (status) {
      case 'READY':
        metrics.assigned++;
        metrics.ready++;
        break;
      case 'UNQUALIFIED':
        metrics.assigned++;
        metrics.unqualified++;
        break;
      case 'ACTING':
        metrics.assigned++;
        metrics.acting++;
        break;
      case 'OVERSTAFFED':
        metrics.assigned++;
        metrics.overstaffed++;
        break;
      case 'SHORTAGE':
      default:
        metrics.gap++;
        if (p.is_key_position) metrics.keyGap++;
        break;
    }
  });

  metrics.fillRate = metrics.total > 0 ? Math.round((metrics.assigned / metrics.total) * 100) : 0;
  return metrics;
}

export default function GapDashboard({ positions, units, statusMap, scopeUnitIds }: GapDashboardProps) {
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);
  const hierarchicalUnits = useMemo(() => buildHierarchicalUnitList(units), [units]);

  const scopedUnits = useMemo(() => {
    if (!scopeUnitIds) return hierarchicalUnits;
    return hierarchicalUnits.filter((h) => scopeUnitIds.has(h.unit.id));
  }, [hierarchicalUnits, scopeUnitIds]);

  const rootUnits = useMemo(
    () => scopedUnits.filter((h) => h.depth === 0),
    [scopedUnits],
  );

  const childrenMap = useMemo(() => {
    const map = new Map<string, HierarchicalUnit[]>();
    scopedUnits.forEach((h) => {
      if (h.unit.parent_unit_id) {
        const arr = map.get(h.unit.parent_unit_id) || [];
        arr.push(h);
        map.set(h.unit.parent_unit_id, arr);
      }
    });
    return map;
  }, [scopedUnits]);

  // Overall summary
  const overall = useMemo(() => {
    const allIds = new Set(scopedUnits.map((h) => h.unit.id));
    return computeUnitMetrics(positions, allIds, statusMap);
  }, [positions, scopedUnits, statusMap]);

  const toggleUnit = (id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderUnitRow = (hUnit: HierarchicalUnit): React.ReactNode => {
    const { unit, depth } = hUnit;
    const descendantIds = descendantMaps[unit.id] || new Set([unit.id]);
    const metrics = computeUnitMetrics(positions, descendantIds, statusMap);
    const children = childrenMap.get(unit.id) || [];
    const isExpanded = expandedUnits.has(unit.id);
    const hasChildren = children.length > 0;

    if (metrics.total === 0) return null;

    const fillColor =
      metrics.fillRate >= 80
        ? 'text-emerald-400'
        : metrics.fillRate >= 50
          ? 'text-amber-400'
          : 'text-red-400';

    const fillBg =
      metrics.fillRate >= 80
        ? 'bg-emerald-500'
        : metrics.fillRate >= 50
          ? 'bg-amber-500'
          : 'bg-red-500';

    return (
      <div key={unit.id}>
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
            depth === 0 ? 'bg-white/60 hover:bg-white/80' : 'bg-white/30 hover:bg-white/50'
          } ${hasChildren ? 'cursor-pointer' : ''}`}
          onClick={() => hasChildren && toggleUnit(unit.id)}
          style={{ paddingRight: `${12 + depth * 16}px` }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            )
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}

          <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${getUnitTypeColor(unit.unit_type)} ${depth > 0 ? 'opacity-60' : ''}`}>
            <span className="text-[10px] font-bold">{getUnitTypeLabel(unit.unit_type)}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-sm truncate ${depth === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
              {unit.name}
            </div>
          </div>

          {/* Key position gap warning */}
          {metrics.keyGap > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded flex-shrink-0">
              <KeyRound className="w-3 h-3" />
              {metrics.keyGap} תפקידי מפתח חסרים
            </span>
          )}

          {/* Metrics */}
          <div className="flex items-center gap-3 text-xs flex-shrink-0">
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3 text-slate-500" />
              <span className="text-slate-600 font-medium">{metrics.total}</span>
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-300 font-medium">{metrics.assigned}</span>
            </span>
            {metrics.gap > 0 && (
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500" />
                <span className="text-red-300 font-medium">{metrics.gap}</span>
              </span>
            )}
            {/* Fill rate bar */}
            <div className="hidden sm:flex items-center gap-1.5 w-20">
              <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className={`h-full ${fillBg} transition-all duration-500`}
                  style={{ width: `${metrics.fillRate}%` }}
                />
              </div>
              <span className={`text-[10px] font-bold ${fillColor} w-8`}>{metrics.fillRate}%</span>
            </div>
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="animate-slideDown">
            {children.map((child) => renderUnitRow(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{overall.total}</div>
            <div className="text-[11px] text-slate-500">סך תקנים פעילים</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{overall.assigned}</div>
            <div className="text-[11px] text-slate-500">תקנים מאוישים</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-300">{overall.gap}</div>
            <div className="text-[11px] text-slate-500">חוסר איוש</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-300">
              {overall.keyGap}<span className="text-sm text-slate-500">/{overall.keyTotal}</span>
            </div>
            <div className="text-[11px] text-slate-500">תפקידי מפתח חסרים</div>
          </div>
        </div>
      </div>

      {/* Qualitative breakdown bar */}
      <div className="card p-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            פילוח כשירות:
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${POSITION_STATUS_CONFIG.READY.dotColor}`} />
            <span className="text-slate-600">כשיר:</span>
            <span className="text-emerald-300 font-bold">{overall.ready}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${POSITION_STATUS_CONFIG.ACTING.dotColor}`} />
            <span className="text-slate-600">ממלא מקום:</span>
            <span className="text-amber-300 font-bold">{overall.acting}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${POSITION_STATUS_CONFIG.UNQUALIFIED.dotColor}`} />
            <span className="text-slate-600">חסר הסמכה:</span>
            <span className="text-orange-300 font-bold">{overall.unqualified}</span>
          </span>
          {overall.overstaffed > 0 && (
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${POSITION_STATUS_CONFIG.OVERSTAFFED.dotColor}`} />
              <span className="text-slate-600">איוש יתר:</span>
              <span className="text-blue-300 font-bold">{overall.overstaffed}</span>
            </span>
          )}
          <div className="mr-auto flex items-center gap-2">
            <span className="text-[11px] text-slate-500">אחוז איוש כללי:</span>
            <div className="w-24 h-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  overall.fillRate >= 80 ? 'bg-emerald-500' : overall.fillRate >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${overall.fillRate}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${
              overall.fillRate >= 80 ? 'text-emerald-300' : overall.fillRate >= 50 ? 'text-amber-300' : 'text-red-300'
            }`}>
              {overall.fillRate}%
            </span>
          </div>
        </div>
      </div>

      {/* Per-unit breakdown table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40">
          <h3 className="text-sm font-bold text-slate-800">פילוח חוסר איוש לפי יחידה</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">תקנים מול מאוישים — כולל תת-יחידות</p>
        </div>
        {/* Header row */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/40 border-b border-slate-200/40 text-[10px] text-slate-600 font-semibold">
          <span className="w-3.5 flex-shrink-0" />
          <span className="w-6 flex-shrink-0" />
          <span className="flex-1">יחידה</span>
          <span className="text-center w-16">תקנים</span>
          <span className="text-center w-16">מאוישים</span>
          <span className="text-center w-16">חוסר</span>
          <span className="hidden sm:block w-28 text-center">אחוז איוש</span>
        </div>
        {rootUnits.map((hUnit) => renderUnitRow(hUnit))}
      </div>
    </div>
  );
}
