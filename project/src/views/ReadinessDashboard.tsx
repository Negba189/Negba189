import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Target,
  Users,
  TrendingUp,
  AlertTriangle,
  KeyRound,
  Shield,
  Building2,
  Loader2,
  ChevronDown,
  ChevronLeft,
  XCircle,
  Download,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type Position,
  type Assignment,
  type PositionRequirement,
  type PersonQualification,
  type Qualification,
  type PositionStatus,
  getUnitTypeColor,
  getUnitTypeLabel,
  calculatePositionStatus,
} from '@/types';
import { useUnitScope } from '@/context/UnitScopeContext';
import { buildDescendantMaps, buildHierarchicalUnitList } from '@/lib/unitHierarchy';
import { exportToCSV, printReport, timestampForFilename } from '@/lib/exportUtils';

interface UnitReadiness {
  unit: Unit;
  depth: number;
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
  readinessLevel: 'green' | 'yellow' | 'red';
}

interface CriticalGap {
  position: Position;
  unit: Unit;
  isKey: boolean;
}

function getReadinessLevel(fillRate: number): 'green' | 'yellow' | 'red' {
  if (fillRate >= 90) return 'green';
  if (fillRate >= 75) return 'yellow';
  return 'red';
}

const READINESS_COLORS = {
  green: { text: 'text-emerald-400', bg: 'bg-emerald-500', bgLight: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'מוכן' },
  yellow: { text: 'text-amber-400', bg: 'bg-amber-500', bgLight: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'בסדר' },
  red: { text: 'text-red-400', bg: 'bg-red-500', bgLight: 'bg-red-500/10', border: 'border-red-500/30', label: 'קריטי' },
};

export default function ReadinessDashboard() {
  const { descendantIds: scopeDescendantIds } = useUnitScope();
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [rawReqs, setRawReqs] = useState<PositionRequirement[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

  // פונקציה לשליפת כל התקנים בפעימות (עוקפת את מגבלת ה-1000 שורות של Supabase)
  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('*, units(*)')
        .order('title')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching positions chunk:', error);
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) {
          keepFetching = false;
        } else {
          from += step;
        }
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [unitRes, qualRes, reqRes, assignRes, personQualRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('qualifications').select('*').order('name'),
      supabase.from('position_requirements').select('*, qualifications(*)'),
      supabase.from('assignments').select('*, persons(*)').eq('is_active', true),
      supabase.from('person_qualifications').select('*, qualifications(*)'),
    ]);

    const posList = await fetchAllPositions();

    if (unitRes.data) setUnits(unitRes.data as Unit[]);
    setPositions(posList);
    if (qualRes.data) setQualifications(qualRes.data as Qualification[]);
    if (reqRes.data) setRawReqs(reqRes.data as PositionRequirement[]);
    if (assignRes.data) setRawAssignments(assignRes.data as Assignment[]);
    if (personQualRes.data) setRawPersonQuals(personQualRes.data as PersonQualification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  const statusMap = useMemo(() => {
    const assignmentsByPos = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const arr = assignmentsByPos.get(a.position_id) || [];
      arr.push(a);
      assignmentsByPos.set(a.position_id, arr);
    });

    const reqsByPos = new Map<string, PositionRequirement[]>();
    rawReqs.forEach((r) => {
      const arr = reqsByPos.get(r.position_id) || [];
      arr.push(r);
      reqsByPos.set(r.position_id, arr);
    });

    const personQualsByPerson = new Map<string, Set<string>>();
    rawPersonQuals.forEach((pq) => {
      const set = personQualsByPerson.get(pq.person_id) || new Set<string>();
      set.add(pq.qualification_id);
      personQualsByPerson.set(pq.person_id, set);
    });

    const map: Record<string, PositionStatus> = {};
    positions.forEach((pos) => {
      const activeAssignments = assignmentsByPos.get(pos.id) || [];
      const posReqs = reqsByPos.get(pos.id) || [];
      const requiredQualIds = new Set(posReqs.map((r) => r.qualification_id));
      let personQualIds = new Set<string>();
      if (activeAssignments.length === 1) {
        personQualIds = personQualsByPerson.get(activeAssignments[0].person_id) || new Set<string>();
      }
      map[pos.id] = calculatePositionStatus(activeAssignments, requiredQualIds, personQualIds);
    });
    return map;
  }, [positions, rawAssignments, rawReqs, rawPersonQuals]);

  const unitReadinessList = useMemo<UnitReadiness[]>(() => {
    const hierarchical = buildHierarchicalUnitList(units);
    const scoped = scopeDescendantIds
      ? hierarchical.filter((h) => scopeDescendantIds.has(h.unit.id))
      : hierarchical;

    return scoped.map(({ unit, depth }) => {
      const descIds = descendantMaps[unit.id] || new Set([unit.id]);
      const relevantPositions = positions.filter(
        (p) => p.unit_id !== null && descIds.has(p.unit_id) && p.is_active,
      );

      const metrics: UnitReadiness = {
        unit,
        depth,
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
        readinessLevel: 'red',
      };

      relevantPositions.forEach((p) => {
        metrics.total++;
        if (p.is_key_position) metrics.keyTotal++;
        const status = statusMap[p.id];
        switch (status) {
          case 'READY': metrics.assigned++; metrics.ready++; break;
          case 'UNQUALIFIED': metrics.assigned++; metrics.unqualified++; break;
          case 'ACTING': metrics.assigned++; metrics.acting++; break;
          case 'OVERSTAFFED': metrics.assigned++; metrics.overstaffed++; break;
          case 'SHORTAGE':
            metrics.gap++;
            if (p.is_key_position) metrics.keyGap++;
            break;
        }
      });

      metrics.fillRate = metrics.total > 0 ? Math.round((metrics.assigned / metrics.total) * 100) : 100;
      metrics.readinessLevel = getReadinessLevel(metrics.fillRate);
      return metrics;
    });
  }, [units, positions, statusMap, scopeDescendantIds, descendantMaps]);

  const overall = useMemo(() => {
    const relevant = unitReadinessList.filter((u) => u.depth === 0);
    const total = relevant.reduce((s, u) => s + u.total, 0);
    const assigned = relevant.reduce((s, u) => s + u.assigned, 0);
    const gap = relevant.reduce((s, u) => s + u.gap, 0);
    const keyGap = relevant.reduce((s, u) => s + u.keyGap, 0);
    const keyTotal = relevant.reduce((s, u) => s + u.keyTotal, 0);
    const fillRate = total > 0 ? Math.round((assigned / total) * 100) : 0;
    return { total, assigned, gap, keyGap, keyTotal, fillRate };
  }, [unitReadinessList]);

  const battalionBreakdown = useMemo(() => {
    return unitReadinessList.filter((u) => u.depth === 1 && u.total > 0);
  }, [unitReadinessList]);

  const criticalGaps = useMemo<CriticalGap[]>(() => {
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const gaps: CriticalGap[] = [];
    positions.forEach((p) => {
      if (!p.is_active) return;
      if (scopeDescendantIds && (!p.unit_id || !scopeDescendantIds.has(p.unit_id))) return;
      const status = statusMap[p.id];
      if (status === 'SHORTAGE' && (p.is_key_position || isCommandRole(p.title))) {
        const unit = p.unit_id ? unitMap.get(p.unit_id) : null;
        if (unit) {
          gaps.push({ position: p, unit, isKey: p.is_key_position });
        }
      }
    });
    return gaps.sort((a, b) => {
      if (a.isKey !== b.isKey) return a.isKey ? -1 : 1;
      return a.unit.name.localeCompare(b.unit.name, 'he');
    });
  }, [positions, statusMap, scopeDescendantIds, units]);

  const toggleUnit = (id: string) => {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const childrenMap = useMemo(() => {
    const map = new Map<string, UnitReadiness[]>();
    const byId = new Map(unitReadinessList.map((u) => [u.unit.id, u]));
    unitReadinessList.forEach((u) => {
      if (u.unit.parent_unit_id) {
        const parent = byId.get(u.unit.parent_unit_id);
        if (parent) {
          const arr = map.get(u.unit.parent_unit_id) || [];
          arr.push(u);
          map.set(u.unit.parent_unit_id, arr);
        }
      }
    });
    return map;
  }, [unitReadinessList]);

  const renderUnitRow = (u: UnitReadiness): React.ReactNode => {
    const colors = READINESS_COLORS[u.readinessLevel];
    const children = childrenMap.get(u.unit.id) || [];
    const isExpanded = expandedUnits.has(u.unit.id);
    const hasChildren = children.length > 0;

    if (u.total === 0) return null;

    return (
      <div key={u.unit.id}>
        <div
          className={`flex items-center gap-2.5 px-3 py-3 transition-colors ${
            u.depth === 0 ? 'bg-white/60 hover:bg-white/80' : 'bg-white/30 hover:bg-white/50'
          } ${hasChildren ? 'cursor-pointer' : ''}`}
          onClick={() => hasChildren && toggleUnit(u.unit.id)}
          style={{ paddingRight: `${12 + u.depth * 16}px` }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                       : <ChevronLeft className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          ) : (
            <span className="w-3.5 flex-shrink-0" />
          )}

          <div className={`w-2.5 h-2.5 rounded-full ${colors.bg} flex-shrink-0 ${u.readinessLevel === 'red' ? 'animate-pulse' : ''}`} />

          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getUnitTypeColor(u.unit.unit_type)} ${u.depth > 0 ? 'opacity-60' : ''}`}>
            {u.unit.unit_type === 'BATTALION' ? <Shield className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-sm truncate ${u.depth === 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
              {u.unit.name}
            </div>
            <div className="text-[10px] text-slate-600">{getUnitTypeLabel(u.unit.unit_type)}</div>
          </div>

          <span className={`badge text-[10px] flex-shrink-0 ${colors.bgLight} ${colors.text} ${colors.border} border`}>
            {colors.label}
          </span>

          {u.keyGap > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-300 bg-red-500/15 border border-red-500/25 px-1.5 py-0.5 rounded flex-shrink-0">
              <KeyRound className="w-3 h-3" />
              {u.keyGap} תפקיד מפתח
            </span>
          )}

          <div className="hidden sm:flex items-center gap-2 w-28 flex-shrink-0">
            <div className="flex-1 h-2 bg-slate-700/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bg} transition-all duration-700`}
                style={{ width: `${u.fillRate}%` }}
              />
            </div>
            <span className={`text-xs font-bold ${colors.text} w-9 text-left`}>{u.fillRate}%</span>
          </div>

          <div className="flex items-center gap-2 text-xs flex-shrink-0">
            <span className="text-slate-500">{u.total}</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-300 font-medium">{u.assigned}</span>
            {u.gap > 0 && <span className="text-red-300 font-medium">{u.gap}</span>}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brigade-400 animate-spin" />
      </div>
    );
  }

  const overallLevel = getReadinessLevel(overall.fillRate);
  const overallColors = READINESS_COLORS[overallLevel];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 no-print">
        <button
          onClick={() => {
            const rows = unitReadinessList.map((u) => ({
              unit: u.unit.name,
              type: getUnitTypeLabel(u.unit.unit_type),
              total: u.total,
              assigned: u.assigned,
              gap: u.gap,
              ready: u.ready,
              unqualified: u.unqualified,
              acting: u.acting,
              fillRate: u.fillRate,
            }));
            exportToCSV(rows, `דוח_מוכנות_${timestampForFilename()}.csv`, [
              { key: 'unit', label: 'יחידה' },
              { key: 'type', label: 'סוג' },
              { key: 'total', label: 'תקנים' },
              { key: 'assigned', label: 'מאוישים' },
              { key: 'gap', label: 'חוסר' },
              { key: 'ready', label: 'כשירים' },
              { key: 'unqualified', label: 'חסר הסמכה' },
              { key: 'acting', label: 'ממלא מקום' },
              { key: 'fillRate', label: 'אחוז איוש' },
            ]);
          }}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          <span>ייצוא CSV</span>
        </button>
        <button onClick={printReport} className="btn-secondary flex items-center gap-2 text-sm">
          <Printer className="w-4 h-4" />
          <span>הדפסה</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-blue-500/5 blur-2xl" />
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 relative">
            <Target className="w-5.5 h-5.5 text-blue-400" />
          </div>
          <div className="relative">
            <div className="text-2xl font-bold text-slate-900">{overall.total}</div>
            <div className="text-[11px] text-slate-500">תקנים מורשים</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-emerald-500/5 blur-2xl" />
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 relative">
            <Users className="w-5.5 h-5.5 text-emerald-400" />
          </div>
          <div className="relative">
            <div className="text-2xl font-bold text-emerald-300">{overall.assigned}</div>
            <div className="text-[11px] text-slate-500">אנשים מאוישים</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className={`absolute -top-4 -left-4 w-20 h-20 rounded-full ${overallColors.bgLight} blur-2xl`} />
          <div className={`w-11 h-11 rounded-xl ${overallColors.bgLight} flex items-center justify-center flex-shrink-0 relative`}>
            <TrendingUp className={`w-5.5 h-5.5 ${overallColors.text}`} />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${overallColors.text}`}>{overall.fillRate}%</span>
              <span className={`badge text-[9px] ${overallColors.bgLight} ${overallColors.text} ${overallColors.border} border`}>
                {overallColors.label}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">אחוז איוש כללי</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-red-500/5 blur-2xl" />
          <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 relative">
            <AlertTriangle className="w-5.5 h-5.5 text-red-400" />
          </div>
          <div className="relative">
            <div className="text-2xl font-bold text-red-300">{overall.gap}</div>
            <div className="text-[11px] text-slate-500">
              חוסר איוש{overall.keyGap > 0 && ` (${overall.keyGap} קריטיים)`}
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">אחוז איוש כללי</h3>
          <span className={`text-2xl font-bold ${overallColors.text}`}>{overall.fillRate}%</span>
        </div>
        <div className="h-4 bg-slate-700/50 rounded-full overflow-hidden relative">
          <div
            className={`h-full ${overallColors.bg} transition-all duration-700 flex items-center justify-end rounded-full`}
            style={{ width: `${overall.fillRate}%` }}
          >
            <span className="text-[10px] font-bold text-white px-2">{overall.assigned}/{overall.total}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> מוכן (90%+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> בסדר (75-90%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" /> קריטי ({'<'}75%)
          </span>
        </div>
      </div>

      {battalionBreakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40">
            <h3 className="text-sm font-bold text-slate-800">פילוח מוכנות לפי גדוד</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">אחוז איוש ורמת מוכנות לכל גדוד</p>
          </div>
          <div className="space-y-1 p-3">
            {battalionBreakdown.map((b) => {
              const colors = READINESS_COLORS[b.readinessLevel];
              return (
                <div key={b.unit.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/40 rounded-lg">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getUnitTypeColor(b.unit.unit_type)}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{b.unit.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                      <span className="text-emerald-400">{b.ready} כשיר</span>
                      {b.acting > 0 && <span className="text-amber-400">{b.acting} ממלא מקום</span>}
                      {b.unqualified > 0 && <span className="text-orange-400">{b.unqualified} חסר הסמכה</span>}
                      {b.gap > 0 && <span className="text-red-400">{b.gap} חוסר</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-36 flex-shrink-0">
                    <div className="flex-1 h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors.bg} transition-all duration-700`}
                        style={{ width: `${b.fillRate}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${colors.text} w-10 text-left`}>{b.fillRate}%</span>
                  </div>
                  <span className={`badge text-[10px] flex-shrink-0 ${colors.bgLight} ${colors.text} ${colors.border} border`}>
                    {colors.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {criticalGaps.length > 0 && (
        <div className="card overflow-hidden border border-red-500/20">
          <div className="px-4 py-3 bg-red-500/5 border-b border-red-500/15 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-red-300">תפקידים קריטיים ללא איוש</h3>
            <span className="badge text-[10px] bg-red-500/15 text-red-300 border border-red-500/25 mr-auto">
              {criticalGaps.length} תפקידים
            </span>
          </div>
          <div className="divide-y divide-slate-800/30 max-h-72 overflow-y-auto">
            {criticalGaps.map((gap) => (
              <div key={gap.position.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100/30 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  gap.isKey ? 'bg-amber-500/10' : 'bg-red-500/10'
                }`}>
                  {gap.isKey ? <KeyRound className="w-4 h-4 text-amber-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 truncate">{gap.position.title}</span>
                    {gap.isKey && (
                      <span className="badge text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/25">
                        תפקיד מפתח
                      </span>
                    )}
                    {gap.position.code && (
                      <span className="text-[10px] text-slate-500 font-mono">{gap.position.code}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <Building2 className="w-3 h-3" />
                    {gap.unit.name}
                    {gap.position.rank_required && (
                      <span className="text-slate-600">דרגה: {gap.position.rank_required}</span>
                    )}
                  </div>
                </div>
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40">
          <h3 className="text-sm font-bold text-slate-800">מוכנות מלאה לפי יחידה</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">תקנים, איוש ורמת מוכנות — ניתן להרחיב תת-יחידות</p>
        </div>
        <div className="flex items-center gap-2.5 px-3 py-2 bg-white/40 border-b border-slate-200/40 text-[10px] text-slate-600 font-semibold">
          <span className="w-3.5 flex-shrink-0" />
          <span className="w-2.5 flex-shrink-0" />
          <span className="w-7 flex-shrink-0" />
          <span className="flex-1">יחידה</span>
          <span className="w-16 text-center hidden sm:inline">תק/מאויש/חסר</span>
          <span className="w-28 text-center hidden sm:inline">אחוז איוש</span>
          <span className="w-12 text-center">סטטוס</span>
        </div>
        {unitReadinessList
          .filter((u) => u.depth === 0)
          .map((u) => renderUnitRow(u))}
      </div>
    </div>
  );
}

function isCommandRole(title: string): boolean {
  const keywords = ['מ"מ', 'מפקד', 'סמג"ד', 'מג"ד', 'מפקד פלוגה', 'מ"פ', 'סמ"פ', 'רסמ"ר', 'רס"ר', 'קצין'];
  const lower = title.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}
