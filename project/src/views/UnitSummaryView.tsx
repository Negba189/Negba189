import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  Layers, 
  BarChart3,
  Calendar,
  Loader2,
  Filter,
  ShieldAlert
} from 'lucide-react';
import { useUnitScope } from '@/context/UnitScopeContext';
import { 
  type Unit, 
  type Position, 
  type Assignment, 
  type PositionRequirement, 
  type PersonQualification, 
  calculatePositionStatus 
} from '@/types';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

export default function UnitSummaryView() {
  const { selectedScopeUnitId } = useUnitScope();

  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawReqs, setRawReqs] = useState<PositionRequirement[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);
  const [unitPersonsMap, setUnitPersonsMap] = useState<Record<string, any[]>>({});

  // סינון היררכי (3 רמות בלבד)
  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
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
            if (!unitAssignedPersons[uKey].some(existing => String(existing.id) === String(p.id))) {
              unitAssignedPersons[uKey].push(p);
            }
          }
        });
      }

      assignList.forEach((a: any) => {
        let pObj = a.persons || a.person;
        if (Array.isArray(pObj)) pObj = pObj[0];
        const targetUnitId = a.unit_id || (a.positions?.unit_id);
        if (targetUnitId && pObj) {
          const uKey = String(targetUnitId);
          if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
          if (!unitAssignedPersons[uKey].some(p => String(p.id) === String(pObj.id))) {
            unitAssignedPersons[uKey].push(pObj);
          }
        }
      });

      setUnitPersonsMap(unitAssignedPersons);
    } catch (err) {
      console.error('Error loading unit summary data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  const level1Units = useMemo(() => {
    try {
      if (!units || !Array.isArray(units)) return [];
      return units.filter(u => u && u.parent_unit_id !== null && String(u.parent_unit_id) === '189');
    } catch {
      return [];
    }
  }, [units]);

  const level2Units = useMemo(() => {
    try {
      if (!level1Id || !units || !Array.isArray(units)) return [];
      return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level1Id));
    } catch {
      return [];
    }
  }, [units, level1Id]);

  const level3Units = useMemo(() => {
    try {
      if (!level2Id || !units || !Array.isArray(units)) return [];
      return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level2Id));
    } catch {
      return [];
    }
  }, [units, level2Id]);

  const targetUnit = useMemo(() => {
    if (!Array.isArray(units)) return null;
    if (level3Id) return units.find(u => u && String(u.id) === String(level3Id)) || null;
    if (level2Id) return units.find(u => u && String(u.id) === String(level2Id)) || null;
    if (level1Id) return units.find(u => u && String(u.id) === String(level1Id)) || null;
    return null;
  }, [units, level1Id, level2Id, level3Id]);

  // רשימת מזהי יחידות רלוונטיות בהיררכיה כולל תתי-יחידות
  const unitIdsToInclude = useMemo(() => {
    if (!targetUnit) {
      const allIds = new Set<string>();
      units.forEach(u => allIds.add(String(u.id)));
      return allIds;
    }
    const set = new Set<string>([String(targetUnit.id)]);
    const descSet = descendantMaps[targetUnit.id];
    if (descSet) {
      descSet.forEach(id => set.add(String(id)));
    }
    return set;
  }, [targetUnit, units, descendantMaps]);

  // מיפוי סטטוסים מדויק
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
      const status = calculatePositionStatus(activeAssignments, requiredQualIds, personQualIds);
      map[posIdStr] = status;
    });
    return map;
  }, [positions, rawAssignments, rawReqs, rawPersonQuals]);

  // תקנים רלוונטיים במסגרת הנבחרת בלבד
  const subtreePositions = useMemo(() => {
    return positions.filter(
      p => p.unit_id !== null && p.unit_id !== undefined && unitIdsToInclude.has(String(p.unit_id))
    );
  }, [positions, unitIdsToInclude]);

  // חישוב מדדים וגילאים תוך טיפול בנתונים חסרים (מתייחס כ-0 / לא מוסיף שגיאה אם חסר)
  const metrics = useMemo(() => {
    const personsInSubtreeSet = new Set<string>();
    unitIdsToInclude.forEach(uId => {
      const pList = unitPersonsMap[uId] || [];
      pList.forEach(p => {
        if (p && p.id) personsInSubtreeSet.add(String(p.id));
      });
    });

    let filledPositionsCount = 0;
    let overStaffedPersonsCount = 0;
    let missingPositionsCount = 0;
    let qualified = 0;
    let notQualified = 0;
    let acting = 0;

    const assignmentsByPos = new Map<string, any[]>();
    rawAssignments.forEach(a => {
      const pId = String(a.position_id);
      const arr = assignmentsByPos.get(pId) || [];
      arr.push(a);
      assignmentsByPos.set(pId, arr);
    });

    const relevantPersonObjectsMap = new Map<string, any>();
    const processedPersonIds = new Set<string>();

    subtreePositions.forEach(p => {
      const assignedList = assignmentsByPos.get(String(p.id)) || [];
      const personsArr = assignedList.map(a => a.persons || a.person).flat().filter(Boolean);

      if (personsArr.length > 0) {
        filledPositionsCount++;
        if (personsArr.length > 1) {
          overStaffedPersonsCount += (personsArr.length - 1);
        }
        personsArr.forEach(person => {
          if (person && person.id) {
            personsInSubtreeSet.add(String(person.id));
            if (!processedPersonIds.has(String(person.id))) {
              processedPersonIds.add(String(person.id));
              relevantPersonObjectsMap.set(String(person.id), person);
            }

            const status = statusMap[String(p.id)];
            if (status === 'READY') qualified++;
            else if (status === 'UNQUALIFIED' || status === 'ACTING' || status === 'OVERSTAFFED') notQualified++;
            else qualified++;

            if (person.is_acting || p.is_acting) acting++;
          }
        });
      } else {
        missingPositionsCount++;
      }
    });

    unitIdsToInclude.forEach(uId => {
      const pList = unitPersonsMap[uId] || [];
      pList.forEach(p => {
        if (p && p.id) {
          personsInSubtreeSet.add(String(p.id));
          if (!processedPersonIds.has(String(p.id))) {
            processedPersonIds.add(String(p.id));
            relevantPersonObjectsMap.set(String(p.id), p);
          }
        }
      });
    });

    const totalAssignedOrExtra = filledPositionsCount + overStaffedPersonsCount;
    const unassignedPersonsCount = Math.max(0, personsInSubtreeSet.size - totalAssignedOrExtra);

    // חישוב גילאים: אם אין תאריך לידה או גיל, החייל מתורגם ל-0 (לא נכנס לממוצע ולדույות החלוקה אך אינו גורם לשגיאה)
    let totalAgeSum = 0;
    let ageCount = 0;
    const agesList: number[] = [];
    const ageBuckets = { under25: 0, b26_30: 0, b31_35: 0, b36_40: 0, b41_45: 0, b46_50: 0, over51: 0 };

    relevantPersonObjectsMap.forEach(p => {
      let calculatedAge = p.age || p.PersonAge || p.calculated_age;
      const bDate = p.birth_date || p.birthdate || p.dob || p.date_of_birth;
      
      if (!calculatedAge && bDate) {
        const birthYear = new Date(bDate).getFullYear();
        if (!isNaN(birthYear)) {
          const currentYear = new Date().getFullYear();
          calculatedAge = currentYear - birthYear;
        }
      }

      const ageNum = Number(calculatedAge);
      if (!isNaN(ageNum) && ageNum > 0) {
        totalAgeSum += ageNum;
        ageCount++;
        agesList.push(ageNum);

        if (ageNum <= 25) ageBuckets.under25++;
        else if (ageNum <= 30) ageBuckets.b26_30++;
        else if (ageNum <= 35) ageBuckets.b31_35++;
        else if (ageNum <= 40) ageBuckets.b36_40++;
        else if (ageNum <= 45) ageBuckets.b41_45++;
        else if (ageNum <= 50) ageBuckets.b46_50++;
        else ageBuckets.over51++;
      }
      // חיילים שאין להם גיל או תאריך לידה מוגדר מתייחסים באופן שקוף (0 בקשירות הגילאים, ללא קריסה)
    });

    const avgAge = ageCount > 0 ? (totalAgeSum / ageCount).toFixed(1) : '0';
    let medianAge = ageCount > 0 ? 0 : 'אין נתונים';
    if (agesList.length > 0) {
      agesList.sort((x, y) => x - y);
      const mid = Math.floor(agesList.length / 2);
      medianAge = agesList.length % 2 !== 0 ? agesList[mid] : Math.round((agesList[mid - 1] + agesList[mid]) / 2);
    }

    return {
      total: subtreePositions.length,
      assigned: filledPositionsCount,
      ready: qualified,
      unqualified: notQualified,
      shortage: missingPositionsCount,
      overstaffed: overStaffedPersonsCount,
      unassignedPersons: unassignedPersonsCount,
      avgAge,
      medianAge,
      ageBuckets,
      totalPersonsCount: personsInSubtreeSet.size
    };
  }, [subtreePositions, statusMap, rawAssignments, unitIdsToInclude, unitPersonsMap]);

  const manningRate = metrics.total > 0 ? ((metrics.assigned / metrics.total) * 100).toFixed(1) : '0';
  const readinessRate = metrics.total > 0 ? ((metrics.ready / metrics.total) * 100).toFixed(1) : '0';
  const unqualifiedRate = metrics.total > 0 ? ((metrics.unqualified / metrics.total) * 100).toFixed(1) : '0';
  const shortageRate = metrics.total > 0 ? ((metrics.shortage / metrics.total) * 100).toFixed(1) : '0';

  const ageDistribution = [
    { range: 'עד 25', count: metrics.ageBuckets.under25 },
    { range: '26–30', count: metrics.ageBuckets.b26_30 },
    { range: '31–35', count: metrics.ageBuckets.b31_35 },
    { range: '36–40', count: metrics.ageBuckets.b36_40 },
    { range: '41–45', count: metrics.ageBuckets.b41_45 },
    { range: '46–50', count: metrics.ageBuckets.b46_50 },
    { range: '51+', count: metrics.ageBuckets.over51 },
  ];

  const maxAgeCount = Math.max(...ageDistribution.map(item => item.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-2xl">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      
      {/* כותרת ראשית */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>דוחות מבצעיים ותמונת כשירות</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">סיכום יחידה | תמונת מצב גדודית</h1>
          <p className="text-xs text-slate-300 mt-1">
            {targetUnit ? `נתונים עבור יחידה: ${targetUnit.name}` : 'תמונת מצב אחודה של כלל היחידות במערכת'}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs font-mono text-indigo-200">
          סה"כ כוח אדם פעיל במסגרת: {metrics.totalPersonsCount} חיילים/אנשים
        </div>
      </div>

      {/* סרגל סינון היררכי (3 רמות בלבד) */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <Filter className="w-4 h-4 text-cyan-600" />
          <span>סינון היררכי (3 רמות):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={level1Id}
            onChange={(e) => {
              setLevel1Id(e.target.value);
              setLevel2Id('');
              setLevel3Id('');
            }}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">– רמה 1 (יחידת אב) –</option>
            {Array.isArray(level1Units) && level1Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>

          <select
            value={level2Id}
            onChange={(e) => {
              setLevel2Id(e.target.value);
              setLevel3Id('');
            }}
            disabled={!level1Id}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">– רמה 2 (פלוגה) –</option>
            {Array.isArray(level2Units) && level2Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>

          <select
            value={level3Id}
            onChange={(e) => setLevel3Id(e.target.value)}
            disabled={!level2Id}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">– רמה 3 (מחלקה) –</option>
            {Array.isArray(level3Units) && level3Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* א. שורת מדדים מרכזיים (KPI) - 6 כרטיסיות */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="card p-4 bg-white border-slate-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">תקינה נדרשת</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{metrics.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">סך התקנים המוגדרים</div>
          </div>
        </div>

        <div className="card p-4 bg-white border-slate-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold">איוש בפועל</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-blue-600">{metrics.assigned}</div>
            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">{manningRate}% איוש כללי</div>
          </div>
        </div>

        <div className="card p-4 bg-emerald-50 border-emerald-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-bold">איוש כשיר</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-700">{metrics.ready}</div>
            <div className="text-[10px] text-emerald-800 font-bold mt-0.5">{readinessRate}% איוש כשיר</div>
          </div>
        </div>

        <div className="card p-4 bg-amber-50 border-amber-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-[11px] font-bold">איוש לא כשיר</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-700">{metrics.unqualified}</div>
            <div className="text-[10px] text-amber-800 font-medium mt-0.5">חסרי הסמכה ({unqualifiedRate}%)</div>
          </div>
        </div>

        <div className="card p-4 bg-rose-50 border-rose-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-[11px] font-bold">תקנים לא מאוישים</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-rose-700">{metrics.shortage}</div>
            <div className="text-[10px] text-rose-800 font-medium mt-0.5">פער איוש ({shortageRate}%)</div>
          </div>
        </div>

        <div className="card p-4 bg-indigo-50 border-indigo-200 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-[11px] font-bold">שיעור כשירות תקינה</span>
            <ShieldAlert className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl font-black text-indigo-700">{readinessRate}%</div>
            <div className="text-[10px] text-indigo-800 font-medium mt-0.5">מוכנות מבצעית בפועל</div>
          </div>
        </div>

      </div>

      {/* ב. גרף התפלגות מצב התקינה (Progress Bar רב שכבתי) */}
      <div className="card p-6 bg-white border-slate-200 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>התפלגות מצב התקינה הגדודית</span>
          </h3>
          <span className="text-xs text-slate-400">סה"כ {metrics.total} תקנים</span>
        </div>

        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          <div 
            style={{ width: `${readinessRate}%` }} 
            className="bg-emerald-500 transition-all duration-500" 
            title={`מאויש וכשיר: ${metrics.ready} (${readinessRate}%)`}
          />
          <div 
            style={{ width: `${unqualifiedRate}%` }} 
            className="bg-amber-400 transition-all duration-500" 
            title={`מאויש ולא כשיר: ${metrics.unqualified} (${unqualifiedRate}%)`}
          />
          <div 
            style={{ width: `${shortageRate}%` }} 
            className="bg-rose-500 transition-all duration-500" 
            title={`לא מאויש: ${metrics.shortage} (${shortageRate}%)`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-slate-700 font-medium">מאויש וכשיר ({readinessRate}% — {metrics.ready} תקנים)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-slate-700 font-medium">מאויש ולא כשיר ({unqualifiedRate}% — {metrics.unqualified} תקנים)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-slate-700 font-medium">לא מאויש ({shortageRate}% — {metrics.shortage} תקנים)</span>
          </div>
        </div>
      </div>

      {/* ג. כוח אדם שאינו משויך לתקינה */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="card p-5 bg-white border-slate-200 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 block">חריגה א': פנויים ממסגרת תקנית</span>
            <h4 className="text-sm font-bold text-slate-900">חיילים ללא שיוך לתקן</h4>
            <p className="text-xs text-slate-400">חיילים המשויכים ליחידה אך אינם משובצים לתפקיד תקני מוגדר</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-2xl font-black">
            {metrics.unassignedPersons}
          </div>
        </div>

        <div className="card p-5 bg-white border-slate-200 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-500 block">חריגה ב': תקינה עודפת</span>
            <h4 className="text-sm font-bold text-slate-900">שיבוצים עודפים</h4>
            <p className="text-xs text-slate-400">תקנים ספציפיים שאוישו ביותר מחייל אחד מעבר לכמות המוגדרת</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-3 rounded-2xl text-2xl font-black">
            {metrics.overstaffed}
          </div>
        </div>

      </div>

      {/* ד. התפלגות גילאים */}
      <div className="card p-6 bg-white border-slate-200 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>התפלגות גילאי החיילים ביחידה</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">חתך דמוגרפי של מצבת כוח האדם במסגרת הנבחרת</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
            <span>גיל ממוצע: <strong className="text-indigo-600">{metrics.avgAge}</strong></span>
            <span className="text-slate-300">|</span>
            <span>גיל חציוני: <strong className="text-indigo-600">{metrics.medianAge}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2">
          {ageDistribution.map((item, idx) => {
            const heightPct = Math.round((item.count / maxAgeCount) * 100);
            return (
              <div key={idx} className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl flex flex-col items-center justify-end h-48 group hover:border-indigo-300 transition-all">
                <div className="text-xs font-bold text-indigo-600 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.count} חיילים
                </div>
                <div className="w-full bg-slate-200/70 rounded-lg overflow-hidden h-32 flex items-end">
                  <div 
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition-all duration-500"
                  />
                </div>
                <div className="mt-3 text-center">
                  <span className="text-xs font-bold text-slate-800 block">{item.range}</span>
                  <span className="text-[10px] text-slate-400 block">{item.count} חיילים</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}