import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, Award, Shield, Filter, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import AssignmentModal from '../components/AssignmentModal';
import QualificationsModal from '../components/QualificationsModal';
import { useUnitScope } from '@/context/UnitScopeContext';

interface Person {
  id: string | number;
  first_name?: string;
  last_name?: string;
  name?: string;
  personal_id?: string;
  rank?: string;
  unit_id?: string | number;
}

interface Position {
  id: string | number;
  title: string;
  unit_id?: string | number;
  display_order?: number;
  tactical_order?: number;
  is_key_position?: boolean;
}

interface Unit {
  id: string | number;
  name: string;
  unit_type: string;
  parent_unit_id?: string | number;
}

export const PlatoonStructureView: React.FC = () => {
  const { selectedScopeUnitId } = useUnitScope();

  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [personsMap, setPersonsMap] = useState<Record<string, Person>>({});
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person[]>>({});
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});
  
  // סינון היררכי (3 רמות בלבד)
  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  // מודאלים
  const [assignModalOpen, setAssignModalOpen] = useState<Position | null>(null);
  const [qualModalOpen, setQualModalOpen] = useState<boolean>(false);
  const [qualPerson, setQualPerson] = useState<Person | null>(null);
  const [statusRefetch, setStatusRefetch] = useState<number>(0);
  const [canEdit] = useState<boolean>(true);

  // עדכון אוטומטי של רמות הסינון ברגע שהסינון הראשי (Scope) משתנה
  useEffect(() => {
  const loadData = async () => {
    try {
      // 1. שליפת טבלת היחידות ורשימת האנשים המלאה
      const [unitRes, personsData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        fetchAllPersons(),
      ]);

      if (unitRes.data) setUnits(unitRes.data);
      const positionsData = await fetchAllPositions();
      setAllPositions(positionsData);

      // 2. שליפת כל דרישות התקנים בלולאה (עוקף את מגבלת ה-1000)
      let allRequirements: any[] = [];
      let reqFrom = 0;
      const reqStep = 1000;
      let keepFetchingReqs = true;

      while (keepFetchingReqs) {
        const { data: reqChunk, error: reqError } = await supabase
          .from('position_requirements')
          .select('*, qualifications(*)')
          .range(reqFrom, reqFrom + reqStep - 1);

        if (reqError) {
          console.error('Error fetching requirements chunk:', reqError);
          break;
        }

        if (reqChunk && reqChunk.length > 0) {
          allRequirements = [...allRequirements, ...reqChunk];
          if (reqChunk.length < reqStep) {
            keepFetchingReqs = false;
          } else {
            reqFrom += reqStep;
          }
        } else {
          keepFetchingReqs = false;
        }
      }
      setPositionReqs(allRequirements);

      // 3. שליפת כל ההסמכות האישיות (person_qualifications) בלולאה למניעת חסימת 1000
      let allPersonQuals: any[] = [];
      let pqFrom = 0;
      let keepFetchingPq = true;

      while (keepFetchingPq) {
        const { data: pqChunk, error: pqError } = await supabase
          .from('person_qualifications')
          .select('*, qualifications(*)')
          .range(pqFrom, pqFrom + reqStep - 1);

        if (pqError) {
          console.error('Error fetching person quals chunk:', pqError);
          break;
        }

        if (pqChunk && pqChunk.length > 0) {
          allPersonQuals = [...allPersonQuals, ...pqChunk];
          if (pqChunk.length < reqStep) {
            keepFetchingPq = false;
          } else {
            pqFrom += reqStep;
          }
        } else {
          keepFetchingPq = false;
        }
      }

      // 4. שליפת כל השיוכים (assignments) בלולאה למניעת חסימת 1000
      let allAssignments: any[] = [];
      let assignFrom = 0;
      let keepFetchingAssign = true;

      while (keepFetchingAssign) {
        const { data: assignChunk, error: assignError } = await supabase
          .from('assignments')
          .select('*, persons(*)')
          .range(assignFrom, assignFrom + reqStep - 1);

        if (assignError) {
          console.error('Error fetching assignments chunk:', assignError);
          break;
        }

        if (assignChunk && assignChunk.length > 0) {
          allAssignments = [...allAssignments, ...assignChunk];
          if (assignChunk.length < reqStep) {
            keepFetchingAssign = false;
          } else {
            assignFrom += reqStep;
          }
        } else {
          keepFetchingAssign = false;
        }
      }

      // עיבוד הנתונים לאחר שליפה מלאה של כל הטבלאות
      const personsMap = new Map<string, Person>();
      if (personsData) {
        personsData.forEach(p => personsMap.set(String(p.id), p));
      }

      const qualsMap: Record<string, string[]> = {};
      allPersonQuals.forEach((pq: any) => {
        const pid = String(pq.person_id);
        if (!qualsMap[pid]) qualsMap[pid] = [];
        const qName = pq.qualifications?.name || pq.qualification_name;
        if (qName) qualsMap[pid].push(qName);
      });
      setPersonQualsMap(qualsMap);

      const assignMap: Record<string, Person[]> = {};
      const activeAssignments = allAssignments.filter(a => a.is_active === true);
      
      activeAssignments.forEach((a) => {
        let pObj = a.persons || a.person;
        if (Array.isArray(pObj)) pObj = pObj[0];
        if (!pObj && a.person_id) pObj = personsMap.get(String(a.person_id));

        if (a.position_id && pObj) {
          const posKey = String(a.position_id);
          if (!assignMap[posKey]) assignMap[posKey] = [];
          if (!assignMap[posKey].some(p => String(p.id) === String(pObj.id))) {
            assignMap[posKey].push(pObj as Person);
          }
        }
      });
      setActiveAssignmentsMap(assignMap as any);

    } catch (err) {
      console.error('Error loading view data:', err);
    }
  };

  loadData();
}, []);

  const getTacticalOrder = (pos: Position) => {
    if (pos.tactical_order !== null && pos.tactical_order !== undefined) {
      return Number(pos.tactical_order);
    }
    return pos.display_order ?? 999;
  };

  const fetchAllPersons = async () => {
    let allData: Person[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('persons').select('*').range(from, from + step - 1);
      if (error) { console.error('Error fetching persons:', error); break; }
      if (data && Array.isArray(data) && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) keepFetching = false;
        else from += step;
      } else {
        keepFetching = false;
      }
    }
    return allData;
  };

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

      if (error) { console.error('Error fetching positions:', error); break; }
      if (data && Array.isArray(data) && data.length > 0) {
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
    try {
      const [unitRes, assignRes, reqsRes, personQualsRes, personsData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('assignments').select('*, persons(*)'),
        supabase.from('position_requirements').select('*, qualifications(*)'),
        supabase.from('person_qualifications').select('*, qualifications(*)'),
        fetchAllPersons(),
      ]);

      const positionsData = await fetchAllPositions();
      if (positionsData && Array.isArray(positionsData)) {
        positionsData.sort((a, b) => getTacticalOrder(a) - getTacticalOrder(b));
        setPositions(positionsData);
      }
      if (reqsRes.data && Array.isArray(reqsRes.data)) setPositionReqs(reqsRes.data);

      const pMap: Record<string, Person> = {};
      if (personsData && Array.isArray(personsData)) {
        personsData.forEach(p => {
          if (p && p.id) pMap[String(p.id)] = p;
        });
      }
      setPersonsMap(pMap);

      const qMap: Record<string, string[]> = {};
      if (personQualsRes.data && Array.isArray(personQualsRes.data)) {
        personQualsRes.data.forEach((pq: any) => {
          if (!pq || !pq.person_id) return;
          const pid = String(pq.person_id);
          if (!qMap[pid]) qMap[pid] = [];
          const qName = pq.qualifications?.name || pq.qualification_name;
          if (qName) qMap[pid].push(qName);
        });
      }
      setPersonQualsMap(qMap);

      const assignMap: Record<string, Person[]> = {};
      if (assignRes.data && Array.isArray(assignRes.data)) {
        const active = assignRes.data.filter((a: any) => a && a.is_active === true);
        active.forEach((a: any) => {
          let pObj = a.persons || a.person;
          if (Array.isArray(pObj)) pObj = pObj[0];
          if (!pObj && a.position_id) pObj = pMap[String(a.person_id)];

          if (a.position_id && pObj) {
            const posKey = String(a.position_id);
            if (!assignMap[posKey]) assignMap[posKey] = [];
            if (!assignMap[posKey].some(p => p && String(p.id) === String(pObj.id))) {
              assignMap[posKey].push(pObj);
            }
          }
        });
        setActiveAssignmentsMap(assignMap);
      }

      if (unitRes.data && Array.isArray(unitRes.data)) {
        setUnits(unitRes.data);
      }
    } catch (err) {
      console.error('Error loading platoon structure view:', err);
    }
  }, [statusRefetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getFullName = (p: Person) => {
    if (!p) return '';
    return p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'ללא שם';
  };

  const checkQualification = (pos: Position, person: Person) => {
    if (!person) return false;
    const reqs = Array.isArray(positionReqs) ? positionReqs.filter(r => r && String(r.position_id) === String(pos.id)) : [];
    if (reqs.length === 0) return true;
    const personQuals = personQualsMap[String(person.id)] || [];
    return reqs.every(req => {
      const qName = req.qualifications?.name || req.qualification_name;
      return !qName || personQuals.includes(qName);
    });
  };

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

  const subUnits = useMemo(() => {
    if (!targetUnit || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(targetUnit.id));
  }, [units, targetUnit]);

  const targetPositions = useMemo(() => {
    if (!targetUnit || !Array.isArray(positions)) return [];
    const relevantUnitIds = [String(targetUnit.id), ...(Array.isArray(subUnits) ? subUnits.map(s => String(s.id)) : [])];
    const filtered = positions.filter(p => p && p.unit_id && relevantUnitIds.includes(String(p.unit_id)));
    return filtered.sort((a, b) => getTacticalOrder(a) - getTacticalOrder(b));
  }, [targetUnit, subUnits, positions]);

  const assaultSquad = Array.isArray(subUnits) ? (subUnits.find(s => s && s.name && (s.name.includes("א'") || s.name.includes("מסתערת"))) || subUnits[0]) : undefined;
  const trackingSquad = Array.isArray(subUnits) ? (subUnits.find(s => s && s.name && (s.name.includes("ב'") || s.name.includes("עוקבת"))) || subUnits[1]) : undefined;
  const coveringSquad = Array.isArray(subUnits) ? (subUnits.find(s => s && s.name && (s.name.includes("ג'") || s.name.includes("מחפה"))) || subUnits[2]) : undefined;

  const platoonStaffPositions = useMemo(() => {
    if (!targetUnit || !Array.isArray(positions)) return [];
    return positions.filter(p => p && String(p.unit_id) === String(targetUnit.id)).sort((a, b) => getTacticalOrder(a) - getTacticalOrder(b));
  }, [targetUnit, positions]);

  const commanderPositions = useMemo(() => {
    if (!Array.isArray(platoonStaffPositions)) return [];
    return platoonStaffPositions.filter(p => 
      p && p.title && (p.title.includes("מ\"מ") || p.title.includes("מפקד") || p.title.includes("רחפן") || p.title.includes("קשר"))
    );
  }, [platoonStaffPositions]);

  const sergeantPositions = useMemo(() => {
    if (!Array.isArray(platoonStaffPositions)) return [];
    const topIds = Array.isArray(commanderPositions) ? commanderPositions.map(c => String(c.id)) : [];
    return platoonStaffPositions.filter(p => p && !topIds.includes(String(p.id)));
  }, [platoonStaffPositions, commanderPositions]);

  const renderPositionCard = (pos: Position) => {
    const assignedList = activeAssignmentsMap[String(pos.id)] || [];
    const personsArr = Array.isArray(assignedList) ? assignedList : [assignedList];
    const primaryPerson = personsArr[0];
    const isQual = primaryPerson ? checkQualification(pos, primaryPerson) : false;

    return (
      <div key={pos.id} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-cyan-500 shadow-sm hover:shadow-md flex flex-col justify-between transition-all text-xs w-[130px] min-h-[120px]">
        <div>
          <span className="font-bold text-slate-700 block text-[11px] mb-1.5 leading-tight text-center border-b border-slate-100 pb-1">
            {pos.title}
          </span>
          
          {personsArr.length > 0 ? (
            <div className="space-y-1.5 text-center">
              <span className="font-extrabold text-slate-900 block text-[12px] leading-snug">
                {personsArr.map(p => getFullName(p)).join(', ')}
              </span>
              
              <div className="flex justify-center pt-0.5">
                {isQual ? (
                  <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 flex-shrink-0" /> כשיר
                  </span>
                ) : (
                  <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0" /> לא כשיר
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <span className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-600 border border-rose-200">
                <XCircle className="w-3 h-3 text-rose-500 flex-shrink-0" /> פער
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-2 pt-1.5 border-t border-slate-100">
          {canEdit && primaryPerson && (
            <button onClick={() => { setQualPerson(primaryPerson); setQualModalOpen(true); }} className="p-1 text-slate-500 hover:text-amber-600 bg-slate-50 hover:bg-amber-50 rounded transition-colors" title="הסמכות">
              <Award className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setAssignModalOpen(pos)} className="p-1 text-slate-500 hover:text-cyan-600 bg-slate-50 hover:bg-cyan-50 rounded transition-colors" title="שייך / שנה איוש">
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderCenteredMatrix = (squadPositions: Position[], redIndices: number[]) => {
    const totalSlots = 36;
    const gridSlots: (Position | null)[] = Array(totalSlots).fill(null);

    redIndices.forEach((redIdx, posIdx) => {
      if (squadPositions[posIdx] && redIdx < totalSlots) {
        gridSlots[redIdx] = squadPositions[posIdx];
      }
    });

    return (
      <div className="flex flex-col items-center w-full">
        <div className="grid gap-2 justify-center w-full" style={{ gridTemplateColumns: 'repeat(18, minmax(65px, 1fr))' }}>
          {gridSlots.map((pos, idx) => {
            const colIndex = idx % 18;
            const isBorderCol = colIndex === 8;

            return (
              <div key={`slot-center-${idx}`} className={`flex items-center justify-center min-h-[120px] px-0.5 ${isBorderCol ? 'border-l-2 border-dashed border-slate-300 pl-2' : ''}`}>
                {pos ? renderPositionCard(pos) : <div />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const render8SlotMatrix = (squadPositions: Position[], redIndices: number[]) => {
    const totalSlots = 16;
    const gridSlots: (Position | null)[] = Array(totalSlots).fill(null);

    redIndices.forEach((redIdx, posIdx) => {
      if (squadPositions[posIdx] && redIdx < totalSlots) {
        gridSlots[redIdx] = squadPositions[posIdx];
      }
    });

    return (
      <div className="grid grid-cols-8 gap-3 w-full">
        {gridSlots.map((pos, idx) => {
          const colIndex = idx % 8;
          const isBorderCol = colIndex === 3;

          return (
            <div key={`slot-8-${idx}`} className={`flex items-center justify-center min-h-[120px] px-1 ${isBorderCol ? 'border-l-2 border-dashed border-slate-300 pl-3' : ''}`}>
              {pos ? renderPositionCard(pos) : <div />}
            </div>
          );
        })}
      </div>
    );
  };

  const render2x2Matrix = (squadPositions: Position[], redIndices: number[]) => {
    const totalSlots = 4;
    const gridSlots: (Position | null)[] = Array(totalSlots).fill(null);

    redIndices.forEach((redIdx, posIdx) => {
      if (squadPositions[posIdx] && redIdx < totalSlots) {
        gridSlots[redIdx] = squadPositions[posIdx];
      }
    });

    return (
      <div className="grid grid-cols-2 gap-3 w-full">
        {gridSlots.map((pos, idx) => (
          <div key={`slot-2x2-${idx}`} className="flex items-center justify-center min-h-[120px]">
            {pos ? renderPositionCard(pos) : <div />}
          </div>
        ))}
      </div>
    );
  };

  const assaultRedIndices = [0, 2, 4, 6, 9, 11, 13, 15];
  const trackingRedIndices = [0, 2, 4, 6, 9, 11, 13, 15];
  const commanderRedIndices = [0, 3];
  const coveringRedIndices = [5, 7, 9, 11, 13, 24, 26, 28, 30];
  const sergeantRedIndices = [0, 3];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-900" dir="rtl">
      
      {/* כותרת ראשית */}
      <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">פריסה טקטית מחלקתית</h1>
          </div>
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

      {!level3Id ? (
        <div className="card flex items-center justify-center h-[400px] text-slate-500 text-sm bg-white border border-slate-200 rounded-2xl shadow-sm">
          אנא בחר מחלקה (היררכיה 3) בסרגל הסינונים ההיררכי מעלה כדי להציג את הפריסה הטקטית.
        </div>
      ) : (
        <div className="w-full overflow-hidden">
          {/* הוספת זום אאוט ב-25% (Scale 0.75) לפריסה */}
          <div className="transform scale-75 origin-top-right w-[133.33%] space-y-6 pb-12">
            
            {/* כותרת המחלקה הנבחרת */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <h2 className="text-xl font-black text-slate-900">{targetUnit?.name}</h2>
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full mt-1 inline-block font-semibold">
                  {targetUnit?.unit_type}
                </span>
              </div>
              <div className="text-left font-mono text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                סה"כ תקנים במסגרת: <span className="text-cyan-600 font-bold">{targetPositions.length}</span>
              </div>
            </div>

            {/* 1. חלק עליון: כיתה ב' (מימין) | מפקדת מחלקה (במרכז) | כיתה א' (משמאל) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              
              <div className="xl:col-span-5 bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <h4 className="text-xs font-black text-amber-700">{trackingSquad?.name || "כיתה ב' - עוקבת"}</h4>
                </div>
                {render8SlotMatrix(
                  positions.filter(p => trackingSquad && String(p.unit_id) === String(trackingSquad.id)),
                  trackingRedIndices
                )}
              </div>

              <div className="xl:col-span-2 bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm flex flex-col justify-between">
                <div className="border-b border-slate-100 pb-2 text-center">
                  <h4 className="text-xs font-black text-indigo-700">מפקדת מחלקה</h4>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  {render2x2Matrix(
                    commanderPositions,
                    commanderRedIndices
                  )}
                </div>
              </div>

              <div className="xl:col-span-5 bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <h4 className="text-xs font-black text-cyan-700">{assaultSquad?.name || "כיתה א' - מסתערת"}</h4>
                </div>
                {render8SlotMatrix(
                  positions.filter(p => assaultSquad && String(p.unit_id) === String(assaultSquad.id)),
                  assaultRedIndices
                )}
              </div>

            </div>

            {/* 2. חלק מרכזי: כיתה ג' - מטריצה ממורכזת התואמת ברוחב לשאר החלקים */}
            <div className="bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
              <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                <h4 className="text-xs font-black text-emerald-700">{coveringSquad?.name || "כיתה ג' - מחפה"}</h4>
              </div>
              
              <div className="w-full overflow-x-auto py-2">
                {renderCenteredMatrix(
                  positions.filter(p => coveringSquad && String(p.unit_id) === String(coveringSquad.id)),
                  coveringRedIndices
                )}
              </div>
            </div>

            {/* 3. חלק תחתון: הסגל במרכז (2x2) */}
            <div className="flex justify-center pt-2">
              <div className="w-full max-w-xs bg-white border border-slate-200 p-4 rounded-2xl space-y-3 shadow-sm">
                <div className="border-b border-slate-100 pb-2 text-center">
                  <h4 className="text-xs font-black text-amber-700">סגל</h4>
                </div>
                <div className="flex items-center justify-center">
                  {render2x2Matrix(
                    sergeantPositions,
                    sergeantRedIndices
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* מודאלים */}
      {assignModalOpen && (
        <AssignmentModal
          open={!!assignModalOpen}
          onClose={() => setAssignModalOpen(null)}
          position={assignModalOpen}
          unitId={targetUnit ? String(targetUnit.id) : undefined}
          onSaved={() => {
            setAssignModalOpen(null);
            setStatusRefetch(n => n + 1);
          }}
        />
      )}

      {qualModalOpen && qualPerson && (
        <QualificationsModal
          open={qualModalOpen}
          onClose={() => setQualModalOpen(false)}
          person={qualPerson}
          onChanged={fetchData}
        />
      )}

    </div>
  );
};

export default PlatoonStructureView;