import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FileText,
  Download,
  Printer,
  Users,
  Target,
  TrendingUp,
  AlertTriangle,
  KeyRound,
  Shield,
  Building2,
  Award,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type Position,
  type Assignment,
  type PositionRequirement,
  type PersonQualification,
  type Qualification,
  type Person,
  type PositionStatus,
  UNIT_TYPE_LABELS,
  getUnitTypeLabel,
  getFullName,
  calculatePositionStatus,
  POSITION_STATUS_CONFIG,
} from '@/types';
import { useUnitScope } from '@/context/UnitScopeContext';
import { buildDescendantMaps, buildHierarchicalUnitList } from '@/lib/unitHierarchy';
import { exportToCSV, printReport, timestampForFilename } from '@/lib/exportUtils';
import { useToast } from '@/components/Toast';

interface UnitReportRow {
  unitName: string;
  unitType: string;
  depth: number;
  total: number;
  assigned: number;
  gap: number;
  ready: number;
  unqualified: number;
  acting: number;
  overstaffed: number;
  fillRate: number;
}

interface PersonnelRow {
  personalId: string;
  fullName: string;
  rank: string;
  serviceStatus: string;
  positionTitle: string;
  unitName: string;
  qualifications: string;
  qualCount: number;
}

interface GapRow {
  positionTitle: string;
  positionCode: string;
  unitName: string;
  isKey: boolean;
  rankRequired: string;
}

export default function Reports() {
  const { toast } = useToast();
  const { descendantIds: scopeDescendantIds, scopeUnit, units: scopeAllUnits } = useUnitScope();
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [rawReqs, setRawReqs] = useState<PositionRequirement[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

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
    const [unitRes, qualRes, reqRes, assignRes, personQualRes, personsRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('qualifications').select('*').order('name'),
      supabase.from('position_requirements').select('*, qualifications(*)'),
      supabase.from('assignments').select('*, persons(*)').eq('is_active', true),
      supabase.from('person_qualifications').select('*, qualifications(*)'),
      supabase.from('persons').select('*, positions(*)').order('last_name').order('first_name'),
    ]);

    const positionsData = await fetchAllPositions();

    if (unitRes.data) setUnits(unitRes.data as Unit[]);
    if (positionsData) setPositions(positionsData as Position[]);
    if (qualRes.data) setQualifications(qualRes.data as Qualification[]);
    if (reqRes.data) setRawReqs(reqRes.data as PositionRequirement[]);
    if (assignRes.data) setRawAssignments(assignRes.data as Assignment[]);
    if (personQualRes.data) setRawPersonQuals(personQualRes.data as PersonQualification[]);
    if (personsRes.data) {
      const mapped = (personsRes.data as Record<string, unknown>[]).map((row) => {
        const assignments = row.assignments as Assignment[] | undefined;
        return row as unknown as Person;
      });
      setPersons(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  // Status map for all positions
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

  // Unit report rows (hierarchical)
  const unitReportRows = useMemo<UnitReportRow[]>(() => {
    const hierarchical = buildHierarchicalUnitList(units);
    const scoped = scopeDescendantIds
      ? hierarchical.filter((h) => scopeDescendantIds.has(h.unit.id))
      : hierarchical;

    return scoped.map(({ unit, depth }) => {
      const descIds = descendantMaps[unit.id] || new Set([unit.id]);
      const relevantPositions = positions.filter(
        (p) => p.unit_id !== null && descIds.has(p.unit_id) && p.is_active,
      );

      const row: UnitReportRow = {
        unitName: unit.name,
        unitType: getUnitTypeLabel(unit.unit_type),
        depth,
        total: 0, assigned: 0, gap: 0, ready: 0,
        unqualified: 0, acting: 0, overstaffed: 0, fillRate: 0,
      };

      relevantPositions.forEach((p) => {
        row.total++;
        switch (statusMap[p.id]) {
          case 'READY': row.assigned++; row.ready++; break;
          case 'UNQUALIFIED': row.assigned++; row.unqualified++; break;
          case 'ACTING': row.assigned++; row.acting++; break;
          case 'OVERSTAFFED': row.assigned++; row.overstaffed++; break;
          case 'SHORTAGE': row.gap++; break;
        }
      });

      row.fillRate = row.total > 0 ? Math.round((row.assigned / row.total) * 100) : 100;
      return row;
    });
  }, [units, positions, statusMap, scopeDescendantIds, descendantMaps]);

  // Overall KPI
  const overall = useMemo(() => {
    const top = unitReportRows.filter((r) => r.depth === 0);
    const total = top.reduce((s, r) => s + r.total, 0);
    const assigned = top.reduce((s, r) => s + r.assigned, 0);
    const gap = top.reduce((s, r) => s + r.gap, 0);
    const ready = top.reduce((s, r) => s + r.ready, 0);
    const unqualified = top.reduce((s, r) => s + r.unqualified, 0);
    const acting = top.reduce((s, r) => s + r.acting, 0);
    const fillRate = total > 0 ? Math.round((assigned / total) * 100) : 0;
    return { total, assigned, gap, ready, unqualified, acting, fillRate };
  }, [unitReportRows]);

  // Battalion breakdown
  const battalionRows = useMemo(() => {
    return unitReportRows.filter((r) => r.depth === 1 && r.total > 0);
  }, [unitReportRows]);

  // Critical gaps
  const gapRows = useMemo<GapRow[]>(() => {
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const gaps: GapRow[] = [];
    positions.forEach((p) => {
      if (!p.is_active) return;
      if (scopeDescendantIds && (!p.unit_id || !scopeDescendantIds.has(p.unit_id))) return;
      if (statusMap[p.id] === 'SHORTAGE') {
        const unit = p.unit_id ? unitMap.get(p.unit_id) : null;
        gaps.push({
          positionTitle: p.title,
          positionCode: p.code || '',
          unitName: unit?.name || '—',
          isKey: p.is_key_position,
          rankRequired: p.rank_required || '',
        });
      }
    });
    return gaps.sort((a, b) => {
      if (a.isKey !== b.isKey) return a.isKey ? -1 : 1;
      return a.unitName.localeCompare(b.unitName, 'he');
    });
  }, [positions, statusMap, scopeDescendantIds, units]);

  // Personnel rows for export
  const personnelRows = useMemo<PersonnelRow[]>(() => {
    const qualNamesByPerson = new Map<string, string[]>();
    rawPersonQuals.forEach((pq) => {
      const name = pq.qualifications?.name;
      if (name) {
        const arr = qualNamesByPerson.get(pq.person_id) || [];
        arr.push(name);
        qualNamesByPerson.set(pq.person_id, arr);
      }
    });

    const unitMap = new Map(units.map((u) => [u.id, u]));
    const posMap = new Map(positions.map((p) => [p.id, p]));

    const activeAssignByPerson = new Map<string, { positionId: string; posTitle: string; unitName: string }>();
    rawAssignments.forEach((a) => {
      if (!a.is_active) return;
      const pos = posMap.get(a.position_id);
      const unit = pos?.unit_id ? unitMap.get(pos.unit_id) : null;
      activeAssignByPerson.set(a.person_id, {
        positionId: a.position_id,
        posTitle: pos?.title || '',
        unitName: unit?.name || '',
      });
    });

    return persons
      .filter((p) => {
        if (!scopeDescendantIds) return true;
        const assignInfo = activeAssignByPerson.get(p.id);
        const personUnitId = assignInfo?.positionId ? posMap.get(assignInfo.positionId)?.unit_id : p.unit_id;
        return personUnitId && scopeDescendantIds.has(personUnitId);
      })
      .map((p) => {
        const assignInfo = activeAssignByPerson.get(p.id);
        const quals = qualNamesByPerson.get(p.id) || [];
        return {
          personalId: p.personal_id,
          fullName: getFullName(p),
          rank: p.rank || '',
          serviceStatus: p.service_status || '',
          positionTitle: assignInfo?.posTitle || '',
          unitName: assignInfo?.unitName || '',
          qualifications: quals.join('; '),
          qualCount: quals.length,
        };
      });
  }, [persons, rawPersonQuals, rawAssignments, positions, units, scopeDescendantIds]);

  // Qualification summary
  const qualSummary = useMemo(() => {
    const personCountByQual = new Map<string, number>();
    const reqCountByQual = new Map<string, number>();

    rawPersonQuals.forEach((pq) => {
      personCountByQual.set(pq.qualification_id, (personCountByQual.get(pq.qualification_id) || 0) + 1);
    });
    rawReqs.forEach((r) => {
      reqCountByQual.set(r.qualification_id, (reqCountByQual.get(r.qualification_id) || 0) + 1);
    });

    return qualifications.map((q) => ({
      name: q.name,
      category: q.category || '',
      personCount: personCountByQual.get(q.id) || 0,
      reqCount: reqCountByQual.get(q.id) || 0,
    }));
  }, [qualifications, rawPersonQuals, rawReqs]);

  const scopeLabel = scopeUnit?.name || 'חטיבה 189 (מלא)';
  const reportDate = new Date().toLocaleDateString('he-IL', { day: '2-digit', month: 'long', year: 'numeric' });

  // Export handlers
  const handleExportManpower = () => {
    exportToCSV(unitReportRows, `דוח_איוש_כוח_אדם_${timestampForFilename()}.csv`, [
      { key: 'unitName', label: 'יחידה' },
      { key: 'unitType', label: 'סוג יחידה' },
      { key: 'total', label: 'תקנים' },
      { key: 'assigned', label: 'מאוישים' },
      { key: 'gap', label: 'חוסר' },
      { key: 'ready', label: 'כשירים' },
      { key: 'unqualified', label: 'חסר הסמכה' },
      { key: 'acting', label: 'ממלאי מקום' },
      { key: 'overstaffed', label: 'איוש יתר' },
      { key: 'fillRate', label: 'אחוז איוש' },
    ]);
    toast('דוח איוש הופק בהצלחה');
  };

  const handleExportPersonnel = () => {
    exportToCSV(personnelRows, `דוח_אנשי_צוות_${timestampForFilename()}.csv`, [
      { key: 'personalId', label: 'מספר אישי' },
      { key: 'fullName', label: 'שם מלא' },
      { key: 'rank', label: 'דרגה' },
      { key: 'serviceStatus', label: 'סטטוס שירות' },
      { key: 'positionTitle', label: 'תקן' },
      { key: 'unitName', label: 'יחידה' },
      { key: 'qualCount', label: 'מספר הסמכות' },
      { key: 'qualifications', label: 'הסמכות' },
    ]);
    toast('דוח אנשי צוות הופק בהצלחה');
  };

  const handleExportGaps = () => {
    exportToCSV(gapRows, `דוח_חוסרי_איוש_${timestampForFilename()}.csv`, [
      { key: 'positionTitle', label: 'תקן' },
      { key: 'positionCode', label: 'קוד' },
      { key: 'unitName', label: 'יחידה' },
      { key: 'isKey', label: 'תפקיד מפתח' },
      { key: 'rankRequired', label: 'דרגה נדרשת' },
    ]);
    toast('דוח חוסרי איוש הופק בהצלחה');
  };

  const handleExportQuals = () => {
    exportToCSV(qualSummary, `דוח_הסמכות_${timestampForFilename()}.csv`, [
      { key: 'name', label: 'הסמכה' },
      { key: 'category', label: 'קטגוריה' },
      { key: 'personCount', label: 'מספר אנשים' },
      { key: 'reqCount', label: 'מספר תקנים דורשים' },
    ]);
    toast('דוח הסמכות הופק בהצלחה');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brigade-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="print-header">
        <h1 className="text-xl font-bold">דוח מצב כוח אדם ומוכנות — {scopeLabel}</h1>
        <p className="text-sm">תאריך: {reportDate}</p>
      </div>

      <div className="card p-4 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <FileText className="w-5 h-5 text-brigade-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">דוחות וייצוא נתונים</h3>
              <p className="text-[11px] text-slate-500">טווח נתונים: {scopeLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={printReport} className="btn-secondary flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" />
              <span>הדפסת דוח</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{overall.total}</div>
            <div className="text-[11px] text-slate-500">תקנים מורשים</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-300">{overall.assigned}</div>
            <div className="text-[11px] text-slate-500">אנשים מאוישים</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-300">{overall.fillRate}%</div>
            <div className="text-[11px] text-slate-500">אחוז איוש כללי</div>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-300">{overall.gap}</div>
            <div className="text-[11px] text-slate-500">חוסרי איוש</div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-800">סטטוס איוש כוח אדם</h3>
          </div>
          <button onClick={handleExportManpower} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 no-print">
            <Download className="w-3.5 h-3.5" />
            <span>ייצוא CSV</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/40 text-slate-600 text-xs border-b border-slate-300/40">
                <th className="text-right px-4 py-2 font-medium">יחידה</th>
                <th className="text-center px-2 py-2 font-medium">תקנים</th>
                <th className="text-center px-2 py-2 font-medium">מאוישים</th>
                <th className="text-center px-2 py-2 font-medium">חוסר</th>
                <th className="text-center px-2 py-2 font-medium hidden md:table-cell">כשירים</th>
                <th className="text-center px-2 py-2 font-medium hidden md:table-cell">חסר הסמכה</th>
                <th className="text-center px-2 py-2 font-medium hidden lg:table-cell">ממלא מקום</th>
                <th className="text-center px-2 py-2 font-medium">אחוז איוש</th>
              </tr>
            </thead>
            <tbody>
              {unitReportRows.map((row, idx) => (
                <tr key={idx} className={`border-b border-slate-200/30 ${row.depth === 0 ? 'font-bold' : ''}`}>
                  <td className="px-4 py-2 text-slate-800" style={{ paddingRight: `${16 + row.depth * 16}px` }}>
                    {row.depth > 0 && <span className="text-slate-600">↳ </span>}
                    {row.unitName}
                    <span className="text-[10px] text-slate-500 mr-2">({row.unitType})</span>
                  </td>
                  <td className="px-2 py-2 text-center text-slate-600">{row.total}</td>
                  <td className="px-2 py-2 text-center text-emerald-400">{row.assigned}</td>
                  <td className="px-2 py-2 text-center text-red-400 font-medium">{row.gap > 0 ? row.gap : '—'}</td>
                  <td className="px-2 py-2 text-center text-emerald-400 hidden md:table-cell">{row.ready}</td>
                  <td className="px-2 py-2 text-center text-orange-400 hidden md:table-cell">{row.unqualified > 0 ? row.unqualified : '—'}</td>
                  <td className="px-2 py-2 text-center text-amber-400 hidden lg:table-cell">{row.acting > 0 ? row.acting : '—'}</td>
                  <td className="px-2 py-2 text-center">
                    <span className={`font-bold ${row.fillRate >= 90 ? 'text-emerald-400' : row.fillRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                      {row.fillRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {battalionRows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brigade-400" />
            <h3 className="text-sm font-bold text-slate-800">אחוז איוש לפי גדוד</h3>
          </div>
          <div className="p-4 space-y-3">
            {battalionRows.map((b) => (
              <div key={b.unitName} className="flex items-center gap-3">
                <div className="w-40 flex-shrink-0 text-sm text-slate-800 font-medium truncate">{b.unitName}</div>
                <div className="flex-1 h-3 bg-slate-700/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      b.fillRate >= 90 ? 'bg-emerald-500' : b.fillRate >= 75 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${b.fillRate}%` }}
                  />
                </div>
                <div className="w-16 text-sm font-bold text-slate-800 text-left">
                  {b.assigned}/{b.total}
                </div>
                <div className={`w-12 text-sm font-bold text-left ${b.fillRate >= 90 ? 'text-emerald-400' : b.fillRate >= 75 ? 'text-amber-400' : 'text-red-400'}`}>
                  {b.fillRate}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-bold text-slate-800">תפקידים ללא איוש</h3>
            <span className="badge text-[10px] bg-red-500/15 text-red-300 border border-red-500/25">{gapRows.length}</span>
          </div>
          <button onClick={handleExportGaps} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 no-print">
            <Download className="w-3.5 h-3.5" />
            <span>ייצוא CSV</span>
          </button>
        </div>
        {gapRows.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400/50" />
            <p className="text-sm">אין חוסרי איוש</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/40 text-slate-600 text-xs border-b border-slate-300/40 sticky top-0">
                  <th className="text-right px-4 py-2 font-medium">תקן</th>
                  <th className="text-right px-4 py-2 font-medium">יחידה</th>
                  <th className="text-center px-2 py-2 font-medium hidden md:table-cell">קוד</th>
                  <th className="text-center px-2 py-2 font-medium hidden sm:table-cell">דרגה</th>
                  <th className="text-center px-2 py-2 font-medium">מפתח</th>
                </tr>
              </thead>
              <tbody>
                {gapRows.map((gap, idx) => (
                  <tr key={idx} className="border-b border-slate-200/30">
                    <td className="px-4 py-2 text-slate-800 font-medium">{gap.positionTitle}</td>
                    <td className="px-4 py-2 text-slate-600">{gap.unitName}</td>
                    <td className="px-2 py-2 text-center text-slate-500 font-mono text-xs hidden md:table-cell">{gap.positionCode || '—'}</td>
                    <td className="px-2 py-2 text-center text-slate-600 hidden sm:table-cell">{gap.rankRequired || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      {gap.isKey ? (
                        <KeyRound className="w-4 h-4 text-amber-400 mx-auto" />
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-800">רשימת אנשי צוות</h3>
            <span className="text-[11px] text-slate-500">({personnelRows.length} אנשים)</span>
          </div>
          <button onClick={handleExportPersonnel} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 no-print">
            <Download className="w-3.5 h-3.5" />
            <span>ייצוא CSV</span>
          </button>
        </div>
        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/40 text-slate-600 text-xs border-b border-slate-300/40 sticky top-0">
                <th className="text-right px-4 py-2 font-medium">מספר אישי</th>
                <th className="text-right px-4 py-2 font-medium">שם</th>
                <th className="text-right px-2 py-2 font-medium hidden md:table-cell">דרגה</th>
                <th className="text-right px-2 py-2 font-medium hidden md:table-cell">תקן</th>
                <th className="text-right px-2 py-2 font-medium hidden lg:table-cell">יחידה</th>
                <th className="text-center px-2 py-2 font-medium">הסמכות</th>
              </tr>
            </thead>
            <tbody>
              {personnelRows.slice(0, 50).map((p, idx) => (
                <tr key={idx} className="border-b border-slate-200/30">
                  <td className="px-4 py-2 text-slate-600 font-mono text-xs">{p.personalId}</td>
                  <td className="px-4 py-2 text-slate-800">{p.fullName}</td>
                  <td className="px-2 py-2 text-slate-600 hidden md:table-cell">{p.rank || '—'}</td>
                  <td className="px-2 py-2 text-slate-600 hidden md:table-cell">{p.positionTitle || '—'}</td>
                  <td className="px-2 py-2 text-slate-600 hidden lg:table-cell">{p.unitName || '—'}</td>
                  <td className="px-2 py-2 text-center text-slate-600">{p.qualCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {personnelRows.length > 50 && (
          <div className="px-4 py-2 text-center text-[11px] text-slate-500 no-print">
            מציג 50 מתוך {personnelRows.length} — לרשימה המלאה יש לייצא ל-CSV
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 bg-white/60 border-b border-slate-300/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-800">סיכום הסמכות</h3>
          </div>
          <button onClick={handleExportQuals} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 no-print">
            <Download className="w-3.5 h-3.5" />
            <span>ייצוא CSV</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/40 text-slate-600 text-xs border-b border-slate-300/40">
                <th className="text-right px-4 py-2 font-medium">הסמכה</th>
                <th className="text-right px-2 py-2 font-medium hidden sm:table-cell">קטגוריה</th>
                <th className="text-center px-2 py-2 font-medium">אנשים</th>
                <th className="text-center px-2 py-2 font-medium">תקנים דורשים</th>
              </tr>
            </thead>
            <tbody>
              {qualSummary.map((q, idx) => (
                <tr key={idx} className="border-b border-slate-200/30">
                  <td className="px-4 py-2 text-slate-800">{q.name}</td>
                  <td className="px-2 py-2 text-slate-600 hidden sm:table-cell">{q.category || '—'}</td>
                  <td className="px-2 py-2 text-center text-emerald-400">{q.personCount}</td>
                  <td className="px-2 py-2 text-center text-blue-400">{q.reqCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-500 print-only" style={{ marginTop: '2rem' }}>
        דוח הופק בתאריך {reportDate} — מערכת ניהול כוח אדם חטיבה 189
      </div>
    </div>
  );
}
