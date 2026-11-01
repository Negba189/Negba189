import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Layers, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  ChevronRight, 
  Settings, 
  Filter,
  BarChart3,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { 
  type Unit, 
  type Position, 
  type Assignment, 
  type PositionRequirement, 
  type PersonQualification, 
  calculatePositionStatus 
} from '@/types';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

export default function UnitPositionsStatusView() {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawReqs, setRawReqs] = useState<PositionRequirement[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);
  const [unitPersonsMap, setUnitPersonsMap] = useState<Record<string, any[]>>({});

  // ספי כשירות דינמיים (ניתנים להגדרה על ידי המשתמש)
  const [greenThreshold, setGreenThreshold] = useState<number>(90);
  const [orangeThreshold, setOrangeThreshold] = useState<number>(75);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // סינון היררכי (3 רמות)
  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  // שליפת נתונים מלאה בלולאות עוקפות מגבלת Supabase
  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('positions').select('*').range(from, from + step - 1);
      if (error) break;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) keepFetching = false;
        else from += step;
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const fetchAllAssignments = async () => {
    let allData: Assignment[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, persons(*)')
        .eq('is_active', true)
        .range(from, from + step - 1);

      if (error) break;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) keepFetching = false;
        else from += step;
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const fetchAllPersons = async () => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('persons').select('*').range(from, from + step - 1);
      if (error) break;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) keepFetching = false;
        else from += step;
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [unitRes, reqRes, personQualRes, posList, assignList, personsData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('position_requirements').select('*'),
        supabase.from('person_qualifications').select('*'),
        fetchAllPositions(),
        fetchAllAssignments(),
        fetchAllPersons(),
      ]);

      if (unitRes.data) setUnits(unitRes.data as Unit[]);
      setPositions(posList);
      if (reqRes.data) setRawReqs(reqRes.data as PositionRequirement[]);
      if (personQualRes.data) setRawPersonQuals(personQualRes.data as PersonQualification[]);
      setRawAssignments(assignList);

      const unitAssignedPersons: Record<string, any[]> = {};
      if (personsData) {
        personsData.forEach(p => {
          if (p.unit_id) {
            const uKey = String(p.unit_id);
            if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
            if (!unitAssignedPersons[uKey].some(e => String(e.id) === String(p.id))) {
              unitAssignedPersons[uKey].push(p);
            }
          }
        });
      }
      setUnitPersonsMap(unitAssignedPersons);
    } catch (err) {
      console.error('Error fetching position status data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  // רמות סינון היררכיות
  const level1Units = useMemo(() => {
    if (!units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id !== null && String(u.parent_unit_id) === '189');
  }, [units]);

  const level2Units = useMemo(() => {
    if (!level1Id || !units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level1Id));
  }, [units, level1Id]);

  const level3Units = useMemo(() => {
    if (!level2Id || !units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level2Id));
  }, [units, level2Id]);

  // המסגרת הנבחרת כעת (אם לא נבחר כלום, היחידה הראשית ברמה 1 תיבחר כברירת מחדל או כולל)
  const currentSelectedUnit = useMemo(() => {
    if (!Array.isArray(units)) return null;
    if (level3Id) return units.find(u => String(u.id) === String(level3Id)) || null;
    if (level2Id) return units.find(u => String(u.id) === String(level2Id)) || null;
    if (level1Id) return units.find(u => String(u.id) === String(level1Id)) || null;
    return level1Units[0] || null; // ברירת מחדל גדוד ראשון
  }, [units, level1Id, level2Id, level3Id, level1Units]);

  // חישוב סטטוס תקינה לכל תקן
  const statusMap = useMemo(() => {
    const assignmentsByPos = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const posId = String(a.position_id);
      const arr = assignmentsByPos.get(posId) || [];
      arr.push(a);
      assignmentsByPos.set(posId, arr);
    });

    const reqsByPos = new Map<string, PositionRequirement[]>();
    rawReqs.forEach((r) => {
      const posId = String(r.position_id);
      const arr = reqsByPos.get(posId) || [];
      arr.push(r);
      reqsByPos.set(posId, arr);
    });

    const personQualsByPerson = new Map<string, Set<string>>();
    rawPersonQuals.forEach((pq) => {
      const pId = String(pq.person_id);
      const set = personQualsByPerson.get(pId) || new Set<string>();
      set.add(String(pq.qualification_id));
      personQualsByPerson.set(pId, set);
    });

    const map: Record<string, string> = {};
    positions.forEach((pos) => {
      const posIdStr = String(pos.id);
      const activeAssignments = assignmentsByPos.get(posIdStr) || [];
      const posReqs = reqsByPos.get(posIdStr) || [];
      const requiredQualIds = new Set(posReqs.map((r) => String(r.qualification_id)));
      let personQualIds = new Set<string>();
      if (activeAssignments.length === 1) {
        personQualIds = personQualsByPerson.get(String(activeAssignments[0].person_id)) || new Set<string>();
      }
      map[posIdStr] = calculatePositionStatus(activeAssignments, requiredQualIds, personQualIds);
    });
    return map;
  }, [positions, rawAssignments, rawReqs, rawPersonQuals]);

  // א. יחידות כפופות ישירות (Child Frameworks) למסגרת הנבחרת
  const childUnits = useMemo(() => {
    if (!currentSelectedUnit) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(currentSelectedUnit.id));
  }, [units, currentSelectedUnit]);

  // פונקציית עזר לחישוב מדדי מסגרת (כולל תתי היחידות שלה)
  const calculateUnitMetrics = useCallback((targetUnitId: string) => {
    const descSet = descendantMaps[targetUnitId] || new Set();
    const unitSet = new Set<string>([String(targetUnitId)]);
    descSet.forEach(id => unitSet.add(String(id)));

    const relevantPositions = positions.filter(
      p => p.is_active && p.unit_id && unitSet.has(String(p.unit_id))
    );

    let totalPositions = 0;
    let assignedCount = 0;
    let readyCount = 0;
    let unqualifiedCount = 0;
    let shortageCount = 0;
    let overstaffedCount = 0;

    const assignmentsCountByPos = new Map<string, number>();
    rawAssignments.forEach(a => {
      const pId = String(a.position_id);
      assignmentsCountByPos.set(pId, (assignmentsCountByPos.get(pId) || 0) + 1);
    });

    relevantPositions.forEach(p => {
      totalPositions++;
      const pIdStr = String(p.id);
      const st = statusMap[pIdStr];
      const assignCount = assignmentsCountByPos.get(pIdStr) || 0;

      if (assignCount > 1) overstaffedCount += (assignCount - 1);

      switch (st) {
        case 'READY':
          assignedCount++;
          readyCount++;
          break;
        case 'UNQUALIFIED':
        case 'ACTING':
        case 'OVERSTAFFED':
          assignedCount++;
          unqualifiedCount++;
          break;
        case 'SHORTAGE':
          shortageCount++;
          break;
      }
    });

    // אנשים פנויים/משויכים
    const personsInSubtreeSet = new Set<string>();
    unitSet.forEach(uId => {
      const pList = unitPersonsMap[uId] || [];
      pList.forEach(p => { if (p && p.id) personsInSubtreeSet.add(String(p.id)); });
    });

    const unassignedPersons = Math.max(0, personsInSubtreeSet.size - (assignedCount + overstaffedCount));

    const manningRate = totalPositions > 0 ? (assignedCount / totalPositions) * 100 : 0;
    const readinessRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;

    return {
      totalPositions,
      assignedCount,
      readyCount,
      unqualifiedCount,
      shortageCount,
      unassignedPersons,
      manningRate,
      readinessRate
    };
  }, [positions, descendantMaps, rawAssignments, statusMap, unitPersonsMap]);

  // ב. נתוני טבלת המסגרות הכפופות + מטה המסגרת הנוכחית
  const subFrameworksTableData = useMemo(() => {
    if (!currentSelectedUnit) return [];

    const rows = childUnits.map(unit => {
      const stats = calculateUnitMetrics(String(unit.id));
      return {
        id: unit.id,
        name: unit.name,
        type: unit.unit_type,
        isSelfMete: false,
        ...stats
      };
    });

    // חישוב מטה המסגרת (תקנים שמשויכים ישירות ליחידה ולא לתתי היחידות שלה)
    const directPositions = positions.filter(
      p => p.is_active && p.unit_id && String(p.unit_id) === String(currentSelectedUnit.id)
    );
    
    if (directPositions.length > 0) {
      let total = 0, assigned = 0, ready = 0, unqualified = 0, shortage = 0;
      directPositions.forEach(p => {
        total++;
        const st = statusMap[String(p.id)];
        if (st === 'READY') { assigned++; ready++; }
        else if (st === 'UNQUALIFIED' || st === 'ACTING' || st === 'OVERSTAFFED') { assigned++; unqualified++; }
        else if (st === 'SHORTAGE') { shortage++; }
      });
      const manningRate = total > 0 ? (assigned / total) * 100 : 0;
      const readinessRate = total > 0 ? (ready / total) * 100 : 0;

      rows.unshift({
        id: currentSelectedUnit.id + '_HQ',
        name: `מפקדת ${currentSelectedUnit.name}`,
        type: 'HEADQUARTERS',
        isSelfMete: true,
        totalPositions: total,
        assignedCount: assigned,
        readyCount: ready,
        unqualifiedCount: unqualified,
        shortageCount: shortage,
        unassignedPersons: 0,
        manningRate,
        readinessRate
      });
    }

    return rows;
  }, [currentSelectedUnit, childUnits, calculateUnitMetrics, positions, statusMap]);

  // ג. שורת סיכום כוללת (TOTAL ROW)
  const totalSummaryRow = useMemo(() => {
    let totalPositions = 0, assignedCount = 0, readyCount = 0, unqualifiedCount = 0, shortageCount = 0, unassignedPersons = 0;

    subFrameworksTableData.forEach(r => {
      totalPositions += r.totalPositions;
      assignedCount += r.assignedCount;
      readyCount += r.readyCount;
      unqualifiedCount += r.unqualifiedCount;
      shortageCount += r.shortageCount;
      unassignedPersons += r.unassignedPersons;
    });

    const manningRate = totalPositions > 0 ? (assignedCount / totalPositions) * 100 : 0;
    const readinessRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;

    return {
      totalPositions,
      assignedCount,
      readyCount,
      unqualifiedCount,
      shortageCount,
      unassignedPersons,
      manningRate,
      readinessRate
    };
  }, [subFrameworksTableData]);

 // ד. רשימת פערים משמעותיים בתפקידים - מאוחד לפי שש התפקיד בלבד ללא פירוט מסגרות
  const criticalGapsData = useMemo(() => {
    if (!currentSelectedUnit) return [];

    const unitIdsToInclude = new Set<string>([String(currentSelectedUnit.id)]);
    const descSet = descendantMaps[currentSelectedUnit.id];
    if (descSet) descSet.forEach(id => unitIdsToInclude.add(String(id)));

    const scopedPositions = positions.filter(
      p => p.is_active && p.unit_id && unitIdsToInclude.has(String(p.unit_id))
    );

    // קבוצה לפי שם התפקיד בלבד
    const gapMap = new Map<string, { positionTitle: string; totalReq: number; readyCount: number; gapCount: number }>();

    scopedPositions.forEach(p => {
      const key = p.title.trim(); // איחוד לפי שם התפקיד

      const st = statusMap[String(p.id)];
      const isReady = st === 'READY';
      const isShortage = st === 'SHORTAGE';

      const existing = gapMap.get(key) || {
        positionTitle: p.title,
        totalReq: 0,
        readyCount: 0,
        gapCount: 0
      };

      existing.totalReq += 1;
      if (isReady) existing.readyCount += 1;
      if (isShortage) existing.gapCount += 1;

      gapMap.set(key, existing);
    });

    // סינון רק תפקידים עם פער (פער > 0) ומיון לפי הפער הגדול ביותר
    return Array.from(gapMap.values())
      .filter(g => g.gapCount > 0)
      .sort((a, b) => b.gapCount - a.gapCount)
      .slice(0, 10); // מציג את 10 הפערים הקריטיים ביותר
  }, [currentSelectedUnit, descendantMaps, positions, statusMap]);

  // פונקציית צביעה מותנית לפי ספים
  const getReadinessBadgeColor = (rate: number) => {
    if (rate >= greenThreshold) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (rate >= orangeThreshold) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  // מנגנון Drill Down בלחיצה על מסגרת
  const handleDrillDown = (frameworkId: string, isSelfMete: boolean) => {
    if (isSelfMete) return; // מפקדה לא יורדת רמה נוספת
    
    // בדיקה באיזו רמה אנחנו כרגע וקידום לרמה הבאה
    if (!level1Id || String(currentSelectedUnit?.id) === String(level1Id)) {
      setLevel1Id(String(currentSelectedUnit?.id || level1Units[0]?.id));
      setLevel2Id(frameworkId);
    } else if (String(currentSelectedUnit?.id) === String(level2Id)) {
      setLevel3Id(frameworkId);
    }
  };

  // חזרה רמה אחת למעלה בביצוע Drill Down
  const handleBreadcrumbClick = (level: number) => {
    if (level === 1) {
      setLevel2Id('');
      setLevel3Id('');
    } else if (level === 2) {
      setLevel3Id('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-2xl">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      
      {/* 1. כותרת ראשית וסרגל הגדרת ספים */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
            <Layers className="w-4 h-4" />
            <span>סטטוס תקינה ופערי איוש לפי מסגרות</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">תמונת איוש והשוואת מסגרות כפופות</h1>
          <p className="text-xs text-slate-300 mt-1">
            ניתוח מעמיק של תקינה, איוש וכשירות עבור {currentSelectedUnit ? currentSelectedUnit.name : 'כלל היחידה'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-bold rounded-xl border border-white/15 transition-all cursor-pointer text-indigo-100"
          >
            <Settings className="w-4 h-4" />
            <span>הגדרת ספי כשירות</span>
          </button>
        </div>
      </div>

      {/* 2. סרגל סינון היררכי מסלול (Breadcrumb & Hierarchy Filter) */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        
        {/* נתיב צלילה (Breadcrumb) */}
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 overflow-x-auto">
          <span className="text-slate-400">מיקומים:</span>
          <button 
            onClick={() => { setLevel1Id(''); setLevel2Id(''); setLevel3Id(''); }}
            className={`hover:underline cursor-pointer ${!level1Id ? 'text-cyan-600 font-extrabold' : 'text-slate-600'}`}
          >
            כלל המערכת
          </button>
          
          {level1Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <button 
                onClick={() => handleBreadcrumbClick(1)}
                className={`hover:underline cursor-pointer ${level1Id && !level2Id ? 'text-cyan-600 font-extrabold' : 'text-slate-600'}`}
              >
                {units.find(u => String(u.id) === String(level1Id))?.name || 'רמה 1'}
              </button>
            </>
          )}

          {level2Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <button 
                onClick={() => handleBreadcrumbClick(2)}
                className={`hover:underline cursor-pointer ${level2Id && !level3Id ? 'text-cyan-600 font-extrabold' : 'text-slate-600'}`}
              >
                {units.find(u => String(u.id) === String(level2Id))?.name || 'רמה 2'}
              </button>
            </>
          )}

          {level3Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <span className="text-cyan-600 font-extrabold">
                {units.find(u => String(u.id) === String(level3Id))?.name || 'רמה 3'}
              </span>
            </>
          )}
        </div>

        {/* בחירת סינונים */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={level1Id}
            onChange={(e) => { setLevel1Id(e.target.value); setLevel2Id(''); setLevel3Id(''); }}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">– בחר גדוד / רמה 1 –</option>
            {level1Units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={level2Id}
            onChange={(e) => { setLevel2Id(e.target.value); setLevel3Id(''); }}
            disabled={!level1Id}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– בחר פלוגה / רמה 2 –</option>
            {level2Units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={level3Id}
            onChange={(e) => setLevel3Id(e.target.value)}
            disabled={!level2Id}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– בחר מחלקה / רמה 3 –</option>
            {level3Units.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* א. טבלת מסגרות מרכזית */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">
              פירוט מסגרות כפופות – {currentSelectedUnit ? currentSelectedUnit.name : ''}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            לחץ על שורה בטבלה כדי לבצע Drill Down פנימה
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 pr-5">מסגרת</th>
                <th className="p-3.5 text-center">תקינה</th>
                <th className="p-3.5 text-center">מאויש</th>
                <th className="p-3.5 text-center">כשיר</th>
                <th className="p-3.5 text-center">לא כשיר</th>
                <th className="p-3.5 text-center">פער איוש</th>
                <th className="p-3.5 text-center">פנויים</th>
                <th className="p-3.5 text-center">איוש %</th>
                <th className="p-3.5 text-center">כשירות %</th>
                <th className="p-3.5 pl-5 text-center">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {subFrameworksTableData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400">
                    אין מסגרות כפופות להצגה ברמה זו
                  </td>
                </tr>
              ) : (
                subFrameworksTableData.map((row) => (
                  <tr 
                    key={row.id} 
                    onClick={() => handleDrillDown(String(row.id), row.isSelfMete)}
                    className={`hover:bg-slate-50/80 transition-colors ${row.isSelfMete ? 'bg-indigo-50/30' : 'cursor-pointer'}`}
                  >
                    <td className="p-3.5 pr-5 font-bold text-slate-900 flex items-center gap-2">
                      <span>{row.name}</span>
                      {row.isSelfMete && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                          מטה היחידה
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center text-slate-800 font-bold">{row.totalPositions}</td>
                    <td className="p-3.5 text-center text-blue-600 font-bold">{row.assignedCount}</td>
                    <td className="p-3.5 text-center text-emerald-600 font-bold">{row.readyCount}</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">{row.unqualifiedCount}</td>
                    <td className="p-3.5 text-center text-rose-600 font-bold">{row.shortageCount}</td>
                    <td className="p-3.5 text-center text-purple-600 font-bold">{row.unassignedPersons}</td>
                    <td className="p-3.5 text-center text-slate-700">{row.manningRate.toFixed(0)}%</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${getReadinessBadgeColor(row.readinessRate)}`}>
                        {row.readinessRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3.5 pl-5 text-center">
                      {!row.isSelfMete && (
                        <span className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center justify-center gap-1">
                          צלוֹל <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            
            {/* שורת סה"כ */}
            <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="p-3.5 pr-5">סה"כ מסגרת</td>
                <td className="p-3.5 text-center">{totalSummaryRow.totalPositions}</td>
                <td className="p-3.5 text-center text-blue-700">{totalSummaryRow.assignedCount}</td>
                <td className="p-3.5 text-center text-emerald-700">{totalSummaryRow.readyCount}</td>
                <td className="p-3.5 text-center text-amber-700">{totalSummaryRow.unqualifiedCount}</td>
                <td className="p-3.5 text-center text-rose-700">{totalSummaryRow.shortageCount}</td>
                <td className="p-3.5 text-center text-purple-700">{totalSummaryRow.unassignedPersons}</td>
                <td className="p-3.5 text-center">{totalSummaryRow.manningRate.toFixed(0)}%</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${getReadinessBadgeColor(totalSummaryRow.readinessRate)}`}>
                    {totalSummaryRow.readinessRate.toFixed(0)}%
                  </span>
                </td>
                <td className="p-3.5 pl-5 text-center"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ב. גרף השוואת מסגרות (Horizontal Stacked Bar Chart) */}
      <div className="card p-6 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">השוואת התפלגות מצב תקינה לפי מסגרות</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> מאויש וכשיר</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"></span> מאויש ולא כשיר</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500"></span> לא מאויש (פער)</div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {subFrameworksTableData.map(row => {
            if (row.totalPositions === 0) return null;
            const readyPct = (row.readyCount / row.totalPositions) * 100;
            const unqualPct = (row.unqualifiedCount / row.totalPositions) * 100;
            const shortPct = (row.shortageCount / row.totalPositions) * 100;

            return (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{row.name}</span>
                  <span className="text-slate-400 font-normal">
                    {row.readyCount} כשירים / {row.totalPositions} תקנים ({row.readinessRate.toFixed(0)}% כשירות)
                  </span>
                </div>

                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    style={{ width: `${readyPct}%` }} 
                    className="bg-emerald-500 transition-all duration-500" 
                    title={`כשיר: ${row.readyCount} (${readyPct.toFixed(1)}%)`}
                  />
                  <div 
                    style={{ width: `${unqualPct}%` }} 
                    className="bg-amber-400 transition-all duration-500" 
                    title={`לא כשיר: ${row.unqualifiedCount} (${unqualPct.toFixed(1)}%)`}
                  />
                  <div 
                    style={{ width: `${shortPct}%` }} 
                    className="bg-rose-500 transition-all duration-500" 
                    title={`לא מאויש: ${row.shortageCount} (${shortPct.toFixed(1)}%)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ד. רשימת פערים משמעותיים בתפקידים (מאוחד לפי תפקיד) */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">פערים קריטיים ומשמעותיים בתפקידים</h3>
          </div>
          <span className="text-xs text-slate-400">ריכוז כלל פערי האיוש לפי תפקיד במסגרת</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 pr-5">תפקיד</th>
                <th className="p-3.5 text-center">תקינה מוגדרת</th>
                <th className="p-3.5 text-center">כשירים בפועל</th>
                <th className="p-3.5 text-center text-rose-600">פער איוש</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {criticalGapsData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-400">
                    לא נמצאו פערים קריטיים בתפקידים במסגרת זו
                  </td>
                </tr>
              ) : (
                criticalGapsData.map((gap, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                    <td className="p-3.5 pr-5 font-bold text-slate-900">{gap.positionTitle}</td>
                    <td className="p-3.5 text-center text-slate-700">{gap.totalReq}</td>
                    <td className="p-3.5 text-center text-emerald-600 font-bold">{gap.readyCount}</td>
                    <td className="p-3.5 text-center text-rose-600 font-black text-sm">
                      <span className="bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl">
                        {gap.gapCount}-
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודל הגדרת ספי כשירות (Settings Modal) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                <span>הגדרת ספי כשירות דינמיים במערכת</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  סף כשירות ירוק (🟢 מעל או שווה ל-%)
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={greenThreshold} 
                  onChange={(e) => setGreenThreshold(Number(e.target.value))}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  סף כשירות כתום (🟠 מעל או שווה ל-% ומתחת לירוק)
                </label>
                <input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={orangeThreshold} 
                  onChange={(e) => setOrangeThreshold(Number(e.target.value))}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block">מקרא צבעים כעת:</span>
                <div className="text-emerald-700 font-medium">🟢 מעל {greenThreshold}% : תקין / כשירות גבוהה</div>
                <div className="text-amber-700 font-medium">🟠 בין {orangeThreshold}% ל-{greenThreshold}% : בסיכון / כשירות בינונית</div>
                <div className="text-rose-700 font-medium">🔴 מתחת ל-{orangeThreshold}% : פער קריטי</div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowSettingsModal(false)} 
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-bold transition-colors cursor-pointer"
              >
                שמור הגדרות ספים
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}