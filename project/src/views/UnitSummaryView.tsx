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
  ShieldAlert,
  ChevronLeft,
  Table as TableIcon
} from 'lucide-react';
import { useUnitScope } from '@/context/UnitScopeContext';
import { 
  type Unit, 
  type Position, 
  type Assignment, 
  type PositionRequirement, 
  type PersonQualification 
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

  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  // פונקציות שליפה מלאות ללא מגבלת 1000 שורות
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

  const fetchAllReqs = async () => {
    let allData: PositionRequirement[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('position_requirements')
        .select('*, qualifications(*)')
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

  const fetchAllPersonQuals = async () => {
    let allData: PersonQualification[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('person_qualifications')
        .select('*, qualifications(*)')
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
      const [unitRes, posList, assignList, reqList, personQualList, personsData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        fetchAllPositions(),
        fetchAllAssignments(),
        fetchAllReqs(),
        fetchAllPersonQuals(),
        fetchAllPersons(),
      ]);

      if (unitRes.data) setUnits(unitRes.data as Unit[]);
      setPositions(posList);
      setRawAssignments(assignList);
      setRawReqs(reqList);
      setRawPersonQuals(personQualList);

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
      return units.filter(u => u && u.parent_unit_id !== null && (String(u.parent_unit_id) === '189' || units.some(parent => String(parent.id) === String(u.parent_unit_id) && parent.parent_unit_id === '189')));
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

  // לוגיקת כשירות מדויקת עם כל הדרישות וההסמכות שנשלפו במלואן
  const statusMap = useMemo(() => {
    const assignmentsByPos = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const posId = String(a.position_id);
      const arr = assignmentsByPos.get(posId) || [];
      arr.push(a);
      assignmentsByPos.set(posId, arr);
    });

    const positionReqsMap = new Map<string, Array<{ id?: string; name: string }>>();
    rawReqs.forEach((req: any) => {
      const posId = String(req.position_id);
      const qName = req.qualifications?.name || req.qualification_name;
      const qId = req.qualification_id ? String(req.qualification_id) : undefined;
      if (qName) {
        if (!positionReqsMap.has(posId)) positionReqsMap.set(posId, []);
        positionReqsMap.get(posId)!.push({ id: qId, name: qName });
      }
    });

    const personQualsMap = new Map<string, string[]>();
    const personQualIdsMap = new Map<string, string[]>();
    rawPersonQuals.forEach((pq: any) => {
      const pId = String(pq.person_id);
      const qName = pq.qualifications?.name || pq.qualification_name;
      if (qName) {
        if (!personQualsMap.has(pId)) personQualsMap.set(pId, []);
        personQualsMap.get(pId)!.push(qName);
      }
      if (pq.qualification_id) {
        if (!personQualIdsMap.has(pId)) personQualIdsMap.set(pId, []);
        personQualIdsMap.get(pId)!.push(String(pq.qualification_id));
      }
    });

    const map: Record<string, string> = {};
    positions.forEach((pos) => {
      const posIdStr = String(pos.id);
      const activeAssignments = assignmentsByPos.get(posIdStr) || [];
      const reqsList = positionReqsMap.get(posIdStr) || [];

      if (activeAssignments.length === 0) {
        map[posIdStr] = 'EMPTY';
        return;
      }

      // אם לא הוגדרו דרישות הסמכה לתקן הנ"ל - התקן נחשב כשיר אוטומטית
      if (reqsList.length === 0) {
        map[posIdStr] = 'READY';
        return;
      }

      let isFullyReady = true;
      for (const assignment of activeAssignments) {
        let pObj = assignment.persons || (assignment as any).person;
        if (Array.isArray(pObj)) pObj = pObj[0];
        const pIdStr = String(assignment.person_id || pObj?.id || '');
        
        const pQuals = personQualsMap.get(pIdStr) || [];
        const pQualIds = personQualIdsMap.get(pIdStr) || [];

        for (const req of reqsList) {
          let hasIt = false;
          if (req.id && pQualIds.includes(req.id)) {
            hasIt = true;
          } else {
            const reqNameLower = req.name.toLowerCase();
            hasIt = pQuals.some((q) => q.toLowerCase().includes(reqNameLower));
          }

          if (!hasIt) {
            isFullyReady = false;
            break;
          }
        }
        if (!isFullyReady) break;
      }

      map[posIdStr] = isFullyReady ? 'READY' : 'UNQUALIFIED';
    });

    console.log('✅ Full Data Loaded & Calculated:', {
      totalPositions: positions.length,
      totalAssignments: rawAssignments.length,
      totalRequirements: rawReqs.length,
      unqualifiedCount: Object.values(map).filter(v => v === 'UNQUALIFIED').length,
      readyCount: Object.values(map).filter(v => v === 'READY').length
    });

    return map;
  }, [positions, rawAssignments, rawReqs, rawPersonQuals]);

  const subtreePositions = useMemo(() => {
    return positions.filter(
      p => p.unit_id !== null && p.unit_id !== undefined && unitIdsToInclude.has(String(p.unit_id))
    );
  }, [positions, unitIdsToInclude]);

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

        const status = statusMap[String(p.id)];
        if (status === 'UNQUALIFIED') {
          notQualified++;
        } else if (status === 'READY') {
          qualified++;
        }

        personsArr.forEach(person => {
          if (person && person.id) {
            personsInSubtreeSet.add(String(person.id));
            if (!processedPersonIds.has(String(person.id))) {
              processedPersonIds.add(String(person.id));
              relevantPersonObjectsMap.set(String(person.id), person);
            }
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
  const readinessRate = metrics.assigned > 0 ? ((metrics.ready / metrics.assigned) * 100).toFixed(1) : '0';
  const unqualifiedRate = metrics.assigned > 0 ? ((metrics.unqualified / metrics.assigned) * 100).toFixed(1) : '0';
  const shortageRate = metrics.total > 0 ? ((metrics.shortage / metrics.total) * 100).toFixed(1) : '0';

  const subUnitsTableData = useMemo(() => {
    let directUnits: Unit[] = [];
    if (!targetUnit) {
      directUnits = units.filter(u => u && u.parent_unit_id && (String(u.parent_unit_id) === '189' || units.some(parent => String(parent.id) === String(u.parent_unit_id) && parent.parent_unit_id === '189')));
      if (directUnits.length === 0) {
        directUnits = units.filter(u => u && !u.parent_unit_id);
      }
    } else {
      directUnits = units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(targetUnit.id));
    }

    if (directUnits.length === 0 && targetUnit) {
      directUnits = [targetUnit];
    }

    const rows = directUnits.map(u => {
      const subDescendantSet = new Set<string>([String(u.id)]);
      const desc = descendantMaps[u.id];
      if (desc) desc.forEach(id => subDescendantSet.add(String(id)));

      const subPositions = positions.filter(p => p.unit_id && subDescendantSet.has(String(p.unit_id)));
      const total = subPositions.length;
      
      let assigned = 0;
      let ready = 0;
      let unqualified = 0;

      subPositions.forEach(p => {
        const assignedList = rawAssignments.filter(a => String(a.position_id) === String(p.id));
        if (assignedList.length > 0) {
          assigned++;
          const status = statusMap[String(p.id)];
          if (status === 'UNQUALIFIED') {
            unqualified++;
          } else if (status === 'READY') {
            ready++;
          }
        }
      });

      const shortage = Math.max(0, total - assigned);
      
      const personsInUnitSet = new Set<string>();
      subDescendantSet.forEach(uId => {
        const pList = unitPersonsMap[uId] || [];
        pList.forEach(p => { if (p && p.id) personsInUnitSet.add(String(p.id)); });
      });
      const unassigned = Math.max(0, personsInUnitSet.size - assigned);

      const manningPct = total > 0 ? Math.round((assigned / total) * 100) : 0;
      const readinessPct = assigned > 0 ? Math.round((ready / assigned) * 100) : 0;

      return {
        unit: u,
        total,
        assigned,
        ready,
        unqualified,
        shortage,
        unassigned,
        manningPct,
        readinessPct
      };
    }).filter(row => row.total > 0 || row.assigned > 0 || row.unassigned > 0);

    return rows;
  }, [targetUnit, units, positions, rawAssignments, statusMap, descendantMaps, unitPersonsMap]);

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
    <div className="space-y-3 max-w-7xl mx-auto pb-6 text-xs" dir="rtl">
       
      {/* כותרת ראשית מצומצמת */}
      <div className="card p-3.5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-indigo-300 text-[10px] font-bold mb-0.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>דוחות מבצעיים ותמונת כשירות</span>
          </div>
          <h1 className="text-lg font-black tracking-tight">סיכום יחידה | תמונת מצב גדודית</h1>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono text-indigo-200">
          סה"כ כוח אדם פעיל: {metrics.totalPersonsCount}
        </div>
      </div>

      {/* סרגל סינון היררכי צפוף */}
      <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2 shadow-xs">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <Filter className="w-3.5 h-3.5 text-cyan-600" />
          <span>סינון היררכי:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={level1Id}
            onChange={(e) => {
              setLevel1Id(e.target.value);
              setLevel2Id('');
              setLevel3Id('');
            }}
            className="bg-slate-50 text-[11px] text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">– רמה 2 (גדוד/מטה) –</option>
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
            className="bg-slate-50 text-[11px] text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">– רמה 3 (פלוגה) –</option>
            {Array.isArray(level2Units) && level2Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>

          <select
            value={level3Id}
            onChange={(e) => setLevel3Id(e.target.value)}
            disabled={!level2Id}
            className="bg-slate-50 text-[11px] text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
          >
            <option value="">– רמה 4 (מחלקה) –</option>
            {Array.isArray(level3Units) && level3Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* א. שורת מדדים מרכזיים (KPI) - 7 כרטיסיות צפופות */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        
        <div className="card p-2.5 bg-cyan-50 border-cyan-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-cyan-700 mb-1">
            <span className="text-[10px] font-bold">מצבת כוח אדם</span>
            <Users className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div>
            <div className="text-xl font-black text-cyan-700">{metrics.totalPersonsCount}</div>
            <div className="text-[9px] text-cyan-800 font-bold">סה"כ אנשים</div>
          </div>
        </div>

        <div className="card p-2.5 bg-white border-slate-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold">תקינה נדרשת</span>
            <Layers className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div>
            <div className="text-xl font-black text-slate-900">{metrics.total}</div>
            <div className="text-[9px] text-slate-400">סך התקנים</div>
          </div>
        </div>

        <div className="card p-2.5 bg-white border-slate-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold">איוש בפועל</span>
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <div className="text-xl font-black text-blue-600">{metrics.assigned}</div>
            <div className="text-[9px] text-blue-600 font-semibold">{manningRate}% איוש</div>
          </div>
        </div>

        <div className="card p-2.5 bg-emerald-50 border-emerald-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-[10px] font-bold">איוש כשיר</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div>
            <div className="text-xl font-black text-emerald-700">{metrics.ready}</div>
            <div className="text-[9px] text-emerald-800 font-bold">{readinessRate}% כשיר</div>
          </div>
        </div>

        <div className="card p-2.5 bg-amber-50 border-amber-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-[10px] font-bold">איוש לא כשיר</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div>
            <div className="text-xl font-black text-amber-700">{metrics.unqualified}</div>
            <div className="text-[9px] text-amber-800 font-medium">לא כשיר ({unqualifiedRate}%)</div>
          </div>
        </div>

        <div className="card p-2.5 bg-rose-50 border-rose-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-[10px] font-bold">תקנים לא מאוישים</span>
            <UserX className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div>
            <div className="text-xl font-black text-rose-700">{metrics.shortage}</div>
            <div className="text-[9px] text-rose-800 font-medium">פער ({shortageRate}%)</div>
          </div>
        </div>

        <div className="card p-2.5 bg-indigo-50 border-indigo-200 flex flex-col justify-between shadow-xs rounded-xl">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-[10px] font-bold">שיעור כשירות תקינה</span>
            <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-black text-indigo-700">{readinessRate}%</div>
            <div className="text-[9px] text-indigo-800 font-medium">מוכנות בפועל</div>
          </div>
        </div>

      </div>

      {/* ב. טבלה מרכזית מפורטת לפי מסגרות (צפופה) */}
      <div className="card bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden p-3.5 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <TableIcon className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">סקירת כלל מסגרות המשנה</h3>
          </div>
          <span className="text-[10px] text-slate-400">לחץ על שורה בטבלה לביצוע Drill Down פנימה</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50/70">
                <th className="py-2 px-3">מסגרת</th>
                <th className="py-2 px-3 text-center">תקינה</th>
                <th className="py-2 px-3 text-center">מאויש</th>
                <th className="py-2 px-3 text-center text-emerald-700">כשיר</th>
                <th className="py-2 px-3 text-center text-amber-700">לא כשיר</th>
                <th className="py-2 px-3 text-center text-rose-700">פער איש</th>
                <th className="py-2 px-3 text-center text-purple-700">פנויים</th>
                <th className="py-2 px-3 text-center">איוש %</th>
                <th className="py-2 px-3 text-center">כשירות %</th>
                <th className="py-2 px-3 text-center">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {subUnitsTableData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">{row.unit.name}</td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{row.total}</td>
                  <td className="py-2.5 px-3 text-center text-blue-600 font-bold">{row.assigned}</td>
                  <td className="py-2.5 px-3 text-center text-emerald-600 font-bold">{row.ready}</td>
                  <td className="py-2.5 px-3 text-center text-amber-600 font-bold">{row.unqualified}</td>
                  <td className="py-2.5 px-3 text-center text-rose-600 font-bold">{row.shortage}</td>
                  <td className="py-2.5 px-3 text-center text-purple-600 font-bold">{row.unassigned}</td>
                  <td className="py-2.5 px-3 text-center text-slate-700">{row.manningPct}%</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      row.readinessPct >= 70 ? 'bg-emerald-100 text-emerald-800' :
                      row.readinessPct >= 30 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {row.readinessPct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={() => {
                        setLevel1Id(String(row.unit.id));
                      }}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer text-[10px]"
                    >
                      <span>צלוֹל</span>
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <td className="py-2.5 px-3">סה"כ מסגרת</td>
                <td className="py-2.5 px-3 text-center">{metrics.total}</td>
                <td className="py-2.5 px-3 text-center text-blue-600">{metrics.assigned}</td>
                <td className="py-2.5 px-3 text-center text-emerald-600">{metrics.ready}</td>
                <td className="py-2.5 px-3 text-center text-amber-600">{metrics.unqualified}</td>
                <td className="py-2.5 px-3 text-center text-rose-600">{metrics.shortage}</td>
                <td className="py-2.5 px-3 text-center text-purple-600">{metrics.unassignedPersons}</td>
                <td className="py-2.5 px-3 text-center">{manningRate}%</td>
                <td className="py-2.5 px-3 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                    {readinessRate}%
                  </span>
                </td>
                <td className="py-2.5 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ג. משבצות חריגים מעל הברים */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="card p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-500 block">חריגה א': פנויים ממסגרת תקנית</span>
            <h4 className="text-xs font-bold text-slate-900">חיילים ללא שיוך לתקן</h4>
            <p className="text-[10px] text-slate-400">חיילים המשויכים ליחידה אך אינם משובצים לתפקיד תקני מוגדר</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-xl text-xl font-black">
            {metrics.unassignedPersons}
          </div>
        </div>

        <div className="card p-3.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-slate-500 block">חריגה ב': תקינה עודפת</span>
            <h4 className="text-xs font-bold text-slate-900">שיבוצים עודפים</h4>
            <p className="text-[10px] text-slate-400">תקנים ספציפיים שאוישו ביותר מחייל אחד מעבר לכמות המוגדרת</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 text-purple-700 px-3 py-2 rounded-xl text-xl font-black">
            {metrics.overstaffed}
          </div>
        </div>
      </div>

      {/* ד. גרף השוואת התפלגות מצב תקינה (מוצמד מימין לשמאל: ירוק -> צהוב -> אדום) */}
      <div className="card p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900">השוואת התפלגות מצב תקינה לפי מסגרות</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-semibold">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>מאויש וכשיר</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>מאויש ולא כשיר</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>לא מאויש (פער)</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          {subUnitsTableData.map((row, idx) => {
            const total = row.total > 0 ? row.total : 1;
            const readyPct = (row.ready / total) * 100;
            const unqualPct = (row.unqualified / total) * 100;
            const shortagePct = (row.shortage / total) * 100;

            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-900">{row.unit.name}</span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    {row.ready} כשירים / {row.total} תקנים ({row.readinessPct}% כשירות)
                  </span>
                </div>
                {/* Progress Bar מסודר נכון מימין לשמאל: ירוק -> צהוב -> אדום */}
                <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    style={{ width: `${readyPct}%` }} 
                    className="bg-emerald-500 transition-all duration-500 shrink-0" 
                    title={`מאויש וכשיר: ${row.ready}`}
                  />
                  <div 
                    style={{ width: `${unqualPct}%` }} 
                    className="bg-amber-400 transition-all duration-500 shrink-0" 
                    title={`מאויש ולא כשיר: ${row.unqualified}`}
                  />
                  <div 
                    style={{ width: `${shortagePct}%` }} 
                    className="bg-rose-500 transition-all duration-500 shrink-0" 
                    title={`לא מאויש: ${row.shortage}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ה. התפלגות גילאים */}
      <div className="card p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>התפלגות גילאי החיילים ביחידה</span>
            </h3>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] font-medium text-slate-700">
            <span>גיל ממוצע: <strong className="text-indigo-600">{metrics.avgAge}</strong></span>
            <span className="text-slate-300">|</span>
            <span>גיל חציוני: <strong className="text-indigo-600">{metrics.medianAge}</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
          {ageDistribution.map((item, idx) => {
            const heightPct = Math.round((item.count / maxAgeCount) * 100);
            return (
              <div key={idx} className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl flex flex-col items-center justify-end h-36 group hover:border-indigo-300 transition-all">
                <div className="text-[10px] font-bold text-indigo-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.count} חיילים
                </div>
                <div className="w-full bg-slate-200/70 rounded-lg overflow-hidden h-20 flex items-end">
                  <div 
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-indigo-500 rounded-t-md group-hover:bg-indigo-600 transition-all duration-500"
                  />
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[10px] font-bold text-slate-800 block">{item.range}</span>
                  <span className="text-[9px] text-slate-400 block">{item.count} חיילים</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
