import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users,
  UserPlus,
  GitBranch,
  Filter,
  Edit2,
  PlusCircle,
  X,
  Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type Position,
  type Person,
  getFullName,
} from '@/types';
import AssignmentModal from '@/components/AssignmentModal';
import { useUnitScope } from '@/context/UnitScopeContext';

export default function CompanyStructureView() {
  console.log("=== CompanyStructureView IS RENDERING ===");

  const { selectedScopeUnitId } = useUnitScope();

  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person[]>>({});
  const [unitPersonsMap, setUnitPersonsMap] = useState<Record<string, Person[]>>({});
  
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});

  const [assignModalOpen, setAssignModalOpen] = useState<Position | null>(null);
  const [statusRefetch, setStatusRefetch] = useState(0);

  // מצבים לניהול מודאל עריכת יחידה
  const [editUnitModalOpen, setEditUnitModalOpen] = useState(false);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitType, setEditUnitType] = useState('');

  // מצבים לניהול מודאל הוספת תת-יחידה
  const [addSubUnitModalOpen, setAddSubUnitModalOpen] = useState(false);
  const [newSubUnitName, setNewSubUnitName] = useState('');
  const [newSubUnitType, setNewSubUnitType] = useState('COMPANY');

  // 4 רמות סינון היררכיות בראש העמוד
  const [filterLevel1, setFilterLevel1] = useState<string>('');
  const [filterLevel2, setFilterLevel2] = useState<string>('');
  const [filterLevel3, setFilterLevel3] = useState<string>('');
  const [filterLevel4, setFilterLevel4] = useState<string>('');

  // עדכון אוטומטי של רמות הסינון ברגע שהסינון הראשי (Scope) משתנה
  useEffect(() => {
    if (!selectedScopeUnitId || units.length === 0) {
      setFilterLevel1('');
      setFilterLevel2('');
      setFilterLevel3('');
      setFilterLevel4('');
      return;
    }

    // בניית שרשרת האבות מהיחידה הנבחרת ועד לשורש
    const chain: string[] = [];
    let currId: string | null = String(selectedScopeUnitId);

    while (currId) {
      const u = units.find(item => String(item.id) === currId);
      if (!u) break;
      chain.unshift(String(u.id));
      currId = u.parent_unit_id ? String(u.parent_unit_id) : null;
    }

    // אם השרשרת מתחילה מ-189, נסנן החוצה את 189 ונשתמש ברמות שתחתיו
    const filteredChain = chain.filter(id => id !== '189');

    setFilterLevel1(filteredChain[0] || '');
    setFilterLevel2(filteredChain[1] || '');
    setFilterLevel3(filteredChain[2] || '');
    setFilterLevel4(filteredChain[3] || '');
  }, [selectedScopeUnitId, units]);

  // פונקציה לשליפת כל התקנים בפעימות
  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true })
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
    try {
      // 1. שליפת היחידות ורשימת האנשים המלאה במקביל
      const [unitRes, personsRes] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('persons').select('*'),
      ]);

      const positionsData = await fetchAllPositions();
      if (positionsData) setAllPositions(positionsData as Position[]);

      if (personsRes.data) {
        const personsMap = new Map<string, Person>();
        (personsRes.data as Person[]).forEach(p => personsMap.set(String(p.id), p));
      }

      // 2. שליפת כל דרישות התקנים בלולאה (עוקף את מגבלת ה-1000)
      let allRequirements: any[] = [];
      let reqFrom = 0;
      const step = 1000;
      let keepFetchingReqs = true;

      while (keepFetchingReqs) {
        const { data: reqChunk, error: reqError } = await supabase
          .from('position_requirements')
          .select('*, qualifications(*)')
          .range(reqFrom, reqFrom + step - 1);

        if (reqError) {
          console.error('Error fetching requirements chunk:', reqError);
          break;
        }

        if (reqChunk && reqChunk.length > 0) {
          allRequirements = [...allRequirements, ...reqChunk];
          if (reqChunk.length < step) {
            keepFetchingReqs = false;
          } else {
            reqFrom += step;
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
          .range(pqFrom, pqFrom + step - 1);

        if (pqError) {
          console.error('Error fetching person quals chunk:', pqError);
          break;
        }

        if (pqChunk && pqChunk.length > 0) {
          allPersonQuals = [...allPersonQuals, ...pqChunk];
          if (pqChunk.length < step) {
            keepFetchingPq = false;
          } else {
            pqFrom += step;
          }
        } else {
          keepFetchingPq = false;
        }
      }

      const qualsMap: Record<string, string[]> = {};
      allPersonQuals.forEach((pq: any) => {
        const pid = String(pq.person_id);
        if (!qualsMap[pid]) qualsMap[pid] = [];
        const qName = pq.qualifications?.name || pq.qualification_name;
        if (qName) qualsMap[pid].push(qName);
      });
      setPersonQualsMap(qualsMap);

      // 4. שליפת כל השיוכים (assignments) בלולאה למניעת חסימת 1000
      let allAssignments: any[] = [];
      let assignFrom = 0;
      let keepFetchingAssign = true;

      while (keepFetchingAssign) {
        const { data: assignChunk, error: assignError } = await supabase
          .from('assignments')
          .select('*, persons(*)')
          .range(assignFrom, assignFrom + step - 1);

        if (assignError) {
          console.error('Error fetching assignments chunk:', assignError);
          break;
        }

        if (assignChunk && assignChunk.length > 0) {
          allAssignments = [...allAssignments, ...assignChunk];
          if (assignChunk.length < step) {
            keepFetchingAssign = false;
          } else {
            assignFrom += step;
          }
        } else {
          keepFetchingAssign = false;
        }
      }

      const personsMap = new Map<string, Person>();
      if (personsRes.data) {
        (personsRes.data as Person[]).forEach(p => personsMap.set(String(p.id), p));
      }

      const assignMap: Record<string, Person[]> = {};
      const unitAssignedPersons: Record<string, Person[]> = {};

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

        if (a.unit_id && pObj) {
          const uKey = String(a.unit_id);
          if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
          if (!unitAssignedPersons[uKey].some(p => String(p.id) === String(pObj.id))) {
            unitAssignedPersons[uKey].push(pObj as Person);
          }
        }
      });
      
      setActiveAssignmentsMap(assignMap);
      setUnitPersonsMap(unitAssignedPersons);

      if (unitRes.data) {
        const allUnits = unitRes.data as Unit[];
        allUnits.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        setUnits(allUnits);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, [statusRefetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // פונקציית בדיקת כשירות לתקן
  const checkQualification = (position: Position | null, person: Person | null) => {
    if (!position || !person) return true;
    const reqs = positionReqs.filter(r => String(r.position_id) === String(position.id));
    if (reqs.length === 0) return true;

    const personQuals = personQualsMap[String(person.id)] || [];
    const personQualsStr = [
      ...personQuals,
      (person as any).rank || '',
      (person as any).profession || '',
    ].map(s => String(s).toLowerCase());

    return reqs.every(req => {
      const qName = (req.qualifications?.name || '').toLowerCase();
      if (!qName) return true;
      return personQualsStr.some(pq => pq.includes(qName));
    });
  };

  // רמות סינון היררכיות
  const level1Units = useMemo(() => {
    return units.filter(u => 
      u.parent_unit_id !== null && 
      u.parent_unit_id !== undefined && 
      String(u.parent_unit_id) === '189'
    );
  }, [units]);

  const level2Units = useMemo(() => {
    if (!filterLevel1) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel1));
  }, [units, filterLevel1]);

  const level3Units = useMemo(() => {
    if (!filterLevel2) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel2));
  }, [units, filterLevel2]);

  const level4Units = useMemo(() => {
    if (!filterLevel3) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel3));
  }, [units, filterLevel3]);

  const selectedCompany = useMemo(() => {
    const targetId = filterLevel4 || filterLevel3 || filterLevel2 || filterLevel1;
    if (!targetId) return null;
    return units.find(u => String(u.id) === String(targetId)) || null;
  }, [units, filterLevel1, filterLevel2, filterLevel3, filterLevel4]);

  useEffect(() => {
    if (selectedCompany) {
      setEditUnitName(selectedCompany.name);
      setEditUnitType(selectedCompany.unit_type || 'COMPANY');
    }
  }, [selectedCompany]);

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('units')
        .update({ name: editUnitName, unit_type: editUnitType })
        .eq('id', selectedCompany.id);

      if (error) throw error;

      setEditUnitModalOpen(false);
      setStatusRefetch(n => n + 1);
    } catch (err) {
      console.error('Error updating unit:', err);
      alert('שגיאה בעדכון היחידה');
    }
  };

  const handleAddSubUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('units')
        .insert([
          {
            name: newSubUnitName,
            unit_type: newSubUnitType,
            parent_unit_id: selectedCompany.id,
          },
        ]);

      if (error) throw error;

      setAddSubUnitModalOpen(false);
      setNewSubUnitName('');
      setNewSubUnitType('COMPANY');
      setStatusRefetch(n => n + 1);
    } catch (err) {
      console.error('Error adding sub unit:', err);
      alert('שגיאה בהוספת תת-יחידה');
    }
  };

  const directPositionsOfCompany = useMemo(() => {
    if (!selectedCompany) return [];
    const positions = allPositions.filter(p => p.unit_id !== null && p.unit_id !== undefined && String(p.unit_id) === String(selectedCompany.id));
    
    positions.sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;

      const aFilled = !!activeAssignmentsMap[String(a.id)];
      const bFilled = !!activeAssignmentsMap[String(b.id)];
      if (aFilled !== bFilled) return aFilled ? -1 : 1;

      return String(a.id).localeCompare(String(b.id), 'he', { numeric: true });
    });
    return positions;
  }, [allPositions, selectedCompany, activeAssignmentsMap]);

  const subUnitsOfCompany = useMemo(() => {
    if (!selectedCompany) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(selectedCompany.id));
  }, [units, selectedCompany]);

  const getSubtreeStats = useCallback((unitId: string) => {
    const unitIdsToInclude = new Set<string>([String(unitId)]);
    
    const findSubtree = (currId: string) => {
      units.forEach(u => {
        if (u.parent_unit_id && String(u.parent_unit_id) === String(currId)) {
          unitIdsToInclude.add(String(u.id));
          findSubtree(String(u.id));
        }
      });
    };
    findSubtree(unitId);

    const subtreePositions = allPositions.filter(
      p => p.unit_id !== null && p.unit_id !== undefined && unitIdsToInclude.has(String(p.unit_id))
    );
    const totalCount = subtreePositions.length;
    
    let filledCount = 0;
    let hasDeficit = false;
    let hasOverAssignment = false;

    subtreePositions.forEach(p => {
      const assignedList = activeAssignmentsMap[String(p.id)];
      const personsArr = assignedList ? (Array.isArray(assignedList) ? assignedList : [assignedList]) : [];
      
      filledCount += personsArr.length;

      if (personsArr.length === 0) {
        hasDeficit = true;
      } else if (personsArr.length > 1) {
        hasOverAssignment = true;
      }
    });

    return { totalCount, filledCount, hasDeficit, hasOverAssignment };
  }, [units, allPositions, activeAssignmentsMap]);

  const getSortedSubPositions = (subUnitId: string) => {
    const positions = allPositions.filter(
      p => p.unit_id !== null && p.unit_id !== undefined && String(p.unit_id) === String(subUnitId)
    );

    return positions.sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;

      const aFilled = !!activeAssignmentsMap[String(a.id)];
      const bFilled = !!activeAssignmentsMap[String(b.id)];
      if (aFilled !== bFilled) return aFilled ? -1 : 1;

      return String(a.id).localeCompare(String(b.id), 'he', { numeric: true });
    });
  };

  const getExtraPersons = (subUnitId: string) => {
    const assignedDirectly = unitPersonsMap[String(subUnitId)] || [];
    const subPositions = allPositions.filter(p => String(p.unit_id) === String(subUnitId));
    const positionPersonIds = new Set(subPositions.map(p => activeAssignmentsMap[String(p.id)]?.id).filter(Boolean));

    return assignedDirectly.filter(p => !positionPersonIds.has(p.id));
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3 bg-white/80 border-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-900">מבנה פלוגתי דינמי</h2>
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>סינון היררכי (4 רמות):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              value={filterLevel1}
              onChange={(e) => { setFilterLevel1(e.target.value); setFilterLevel2(''); setFilterLevel3(''); setFilterLevel4(''); }}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none"
            >
              <option value="">-- רמה 1 (יחידת אב) --</option>
              {level1Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel2}
              onChange={(e) => { setFilterLevel2(e.target.value); setFilterLevel3(''); setFilterLevel4(''); }}
              disabled={!filterLevel1 || level2Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 2 (פלוגה) --</option>
              {level2Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel3}
              onChange={(e) => { setFilterLevel3(e.target.value); setFilterLevel4(''); }}
              disabled={!filterLevel2 || level3Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 3 (מחלקה) --</option>
              {level3Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel4}
              onChange={(e) => setFilterLevel4(e.target.value)}
              disabled={!filterLevel3 || level4Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 4 (כיתה/תת-מסגרת) --</option>
              {level4Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCompany ? (
        <div className="card p-6 space-y-6 bg-white border-slate-200 min-h-[650px]">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{selectedCompany.name}</h3>
              <span className="text-xs text-cyan-600">סוג מסגרת: {selectedCompany.unit_type || 'לא הגדרת'}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditUnitModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-cyan-600" />
                <span>ערוך יחידה</span>
              </button>
              <button
                type="button"
                onClick={() => setAddSubUnitModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>הוסף תת-יחידה</span>
              </button>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-600" />
              <span>תקנים ישירים ב-{selectedCompany.name}</span>
            </h4>
            {directPositionsOfCompany.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">אין תקנים ישירים המוגדרים תחת מסגרת זו.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {directPositionsOfCompany.map((pos) => {
                  const personsArr = activeAssignmentsMap[String(pos.id)] || [];
                  const isQualified = personsArr.every(p => checkQualification(pos, p));

                  return (
                    <div key={pos.id} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{pos.title}</span>
                        <span className={`text-[11px] block mt-0.5 font-medium ${
                          personsArr.length === 0 
                            ? 'text-rose-600' 
                            : isQualified 
                              ? 'text-emerald-600' 
                              : 'text-amber-600 font-semibold'
                        }`}>
                          {personsArr.length > 0 
                            ? `${personsArr.map(p => getFullName(p)).join(', ')} ${!isQualified ? '⚠️ (לא כשיר)' : ''}` 
                            : '⚠️ פער איוש'}
                        </span>
                        {personsArr.length > 1 && (
                          <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-1 rounded mt-0.5 inline-block font-medium">
                            איוש יתר ({personsArr.length})
                          </span>
                        )}
                      </div>
                      <button onClick={() => setAssignModalOpen(pos)} className="p-1 text-slate-500 hover:text-cyan-600">
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-800">מסגרות כפופות ל-{selectedCompany.name}:</h4>
            {subUnitsOfCompany.length === 0 ? (
              <div className="card p-6 text-center text-slate-500 text-sm bg-slate-50 border-slate-200">
                אין מסגרות כפופות ישירות למסגרת זו.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {subUnitsOfCompany.map((subUnit) => {
                  const sortedSubPositions = getSortedSubPositions(subUnit.id);
                  const extraPersons = getExtraPersons(subUnit.id);
                  const stats = getSubtreeStats(subUnit.id);

                  const isSquad = subUnit.unit_type?.toUpperCase() === 'SQUAD' || subUnit.name.includes('כיתה');
                  
                  const splitIndex = sortedSubPositions.findIndex(pos => pos.title.includes('מפקד חוליה') && sortedSubPositions.indexOf(pos) > 0);
                  const halulaA = splitIndex !== -1 
                    ? sortedSubPositions.slice(0, splitIndex)
                    : sortedSubPositions.filter((_, idx) => idx < Math.ceil(sortedSubPositions.length / 2));
                  const halulaB = splitIndex !== -1 
                    ? sortedSubPositions.slice(splitIndex)
                    : sortedSubPositions.filter((_, idx) => idx >= Math.ceil(sortedSubPositions.length / 2));

                  return (
                    <div key={subUnit.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 flex flex-col justify-between shadow-xs">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-xs font-bold text-slate-800">{subUnit.name}</span>
                          <span className="text-[10px] bg-white text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-medium">
                            {subUnit.unit_type}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {sortedSubPositions.length === 0 && extraPersons.length === 0 ? (
                            <div className="text-[11px] text-slate-500">אין תקנים או כוח אדם במסגרת זו.</div>
                          ) : (
                            <>
                              {isSquad ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1.5 bg-white p-2 rounded-lg border border-slate-200">
                                    <div className="text-[10px] font-bold text-cyan-700 text-center border-b border-slate-200 pb-1">חוליה א'</div>
                                    {halulaA.map((pos) => {
                                      const personsArr = activeAssignmentsMap[String(pos.id)] || [];
                                      const isQual = personsArr.every(p => checkQualification(pos, p));
                                      return (
                                        <div key={pos.id} className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
                                          <span className="text-[11px] text-slate-800 truncate" title={pos.title}>{pos.title}</span>
                                          <div className="flex items-center justify-between mt-1">
                                            <span className={`text-[10px] font-medium ${personsArr.length > 0 ? (isQual ? 'text-emerald-600' : 'text-amber-600') : 'text-rose-600'}`}>
                                              {personsArr.length > 0 ? (isQual ? personsArr.map(p => getFullName(p)).join(', ') : `${personsArr.map(p => getFullName(p)).join(', ')} ⚠️`) : 'פער'}
                                            </span>
                                            <button onClick={() => setAssignModalOpen(pos)} className="p-1 text-slate-500 hover:text-emerald-600">
                                              <UserPlus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="space-y-1.5 bg-white p-2 rounded-lg border border-slate-200">
                                    <div className="text-[10px] font-bold text-amber-700 text-center border-b border-slate-200 pb-1">חוליה ב'</div>
                                    {halulaB.map((pos) => {
                                      const personsArr = activeAssignmentsMap[String(pos.id)] || [];
                                      const isQual = personsArr.every(p => checkQualification(pos, p));
                                      return (
                                        <div key={pos.id} className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
                                          <span className="text-[11px] text-slate-800 truncate" title={pos.title}>{pos.title}</span>
                                          <div className="flex items-center justify-between mt-1">
                                            <span className={`text-[10px] font-medium ${personsArr.length > 0 ? (isQual ? 'text-emerald-600' : 'text-amber-600') : 'text-rose-600'}`}>
                                              {personsArr.length > 0 ? (isQual ? personsArr.map(p => getFullName(p)).join(', ') : `${personsArr.map(p => getFullName(p)).join(', ')} ⚠️`) : 'פער'}
                                            </span>
                                            <button onClick={() => setAssignModalOpen(pos)} className="p-1 text-slate-500 hover:text-emerald-600">
                                              <UserPlus className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                sortedSubPositions.map((pos) => {
                                  const personsArr = activeAssignmentsMap[String(pos.id)] || [];
                                  const isQual = personsArr.every(p => checkQualification(pos, p));
                                  return (
                                    <div key={pos.id} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between shadow-xs">
                                      <span className="text-xs text-slate-800 truncate max-w-[130px]" title={pos.title}>{pos.title}</span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`text-[11px] font-medium ${personsArr.length > 0 ? (isQual ? 'text-emerald-600' : 'text-amber-600 font-semibold') : 'text-rose-600'}`} title={personsArr.map(p => getFullName(p)).join(', ')}>
                                          {personsArr.length > 0 ? (isQual ? personsArr.map(p => getFullName(p)).join(', ') : `${personsArr.map(p => getFullName(p)).join(', ')} ⚠️ לא כשיר`) : 'פער'}
                                        </span>
                                        <button onClick={() => setAssignModalOpen(pos)} className="p-1 text-slate-500 hover:text-emerald-600">
                                          <UserPlus className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}

                              {extraPersons.map((person) => (
                                <div key={person.id} className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                                  <span className="text-xs text-amber-800 truncate max-w-[140px]" title={getFullName(person)}>{getFullName(person)}</span>
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">מחוץ לתקן</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 mt-3 border-t border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">מצבה מול תקן:</span>
                        <span className={`font-bold px-2 py-0.5 rounded border ${
                          stats.hasDeficit && stats.hasOverAssignment
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : stats.filledCount > stats.totalCount || stats.hasOverAssignment
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : stats.hasDeficit
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {stats.filledCount} / {stats.totalCount} מאוישים
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-500 text-sm bg-white border-slate-200">
          אנא בחר יחידת אב בסרגל הסינונים ההיררכי למעלה כדי להציג את נתוני המבנה.
        </div>
      )}

      {editUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-600" />
                <span>עריכת פרטי יחידה</span>
              </h3>
              <button onClick={() => setEditUnitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateUnit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">שם היחידה</label>
                <input
                  type="text"
                  value={editUnitName}
                  onChange={(e) => setEditUnitName(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">סוג מסגרת (Unit Type)</label>
                <select
                  value={editUnitType}
                  onChange={(e) => setEditUnitType(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                >
                  <option value="BATTALION">גדוד (Battalion)</option>
                  <option value="COMPANY">פלוגה (Company)</option>
                  <option value="PLATOON">מחלקה (Platoon)</option>
                  <option value="HQ">מטה (HQ)</option>
                  <option value="OTHER">אחר (Other)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUnitModalOpen(false)}
                  className="px-4 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-500 transition-colors"
                >
                  שמור שינויים
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addSubUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-cyan-600" />
                <span>הוספת תת-יחידה תחת {selectedCompany?.name}</span>
              </h3>
              <button onClick={() => setAddSubUnitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubUnit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">שם תת-היחידה החדשה</label>
                <input
                  type="text"
                  placeholder="למשל: מחלקה 3 / פלוגת מסייעת"
                  value={newSubUnitName}
                  onChange={(e) => setNewSubUnitName(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-1">סוג מסגרת</label>
                <select
                  value={newSubUnitType}
                  onChange={(e) => setNewSubUnitType(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                >
                  <option value="COMPANY">פלוגה (Company)</option>
                  <option value="PLATOON">מחלקה (Platoon)</option>
                  <option value="HQ">מטה (HQ)</option>
                  <option value="OTHER">אחר (Other)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddSubUnitModalOpen(false)}
                  className="px-4 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  ביטול, תודה
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-cyan-600 text-white font-medium rounded-lg hover:bg-cyan-500 transition-colors"
                >
                  צור יחידה
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AssignmentModal open={!!assignModalOpen} onClose={() => setAssignModalOpen(null)} position={assignModalOpen} onSaved={() => setStatusRefetch(n => n + 1)} />
    </div>
  );
}