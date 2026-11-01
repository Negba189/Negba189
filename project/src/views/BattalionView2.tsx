import { useEffect, useState, useMemo } from 'react';
import {
  Settings2,
  Filter,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type Position,
  type Person,
  getFullName,
} from '@/types';

const COMPANIES_SLOTS = [
  { id: 'bcComp', label: 'מפקד הגדוד (מג"ד)', category: 'command' },
  { id: 'dacAComp', label: 'סגן מפקד הגדוד א\' (סמג"ד א\')', category: 'command' },
  { id: 'dacBComp', label: 'סגן מפקד הגדוד ב\' (סמג"ד ב\')', category: 'command' },

  { id: 'coA', label: "מ\"פ א'", category: 'companies' },
  { id: 'deputyA', label: "סמ\"פ א'", category: 'companies' },
  { id: 'platoonA1', label: "מ\"מ א' 1", category: 'companies' },
  { id: 'platoonA2', label: "מ\"מ א' 2", category: 'companies' },
  { id: 'platoonA3', label: "מ\"מ א' 3", category: 'companies' },

  { id: 'coB', label: "מ\"פ ב'", category: 'companies' },
  { id: 'deputyB', label: "סמ\"פ ב'", category: 'companies' },
  { id: 'platoonB1', label: "מ\"מ ב' 1", category: 'companies' },
  { id: 'platoonB2', label: "מ\"מ ב' 2", category: 'companies' },
  { id: 'platoonB3', label: "מ\"מ ב' 3", category: 'companies' },

  { id: 'coC', label: "מ\"פ ג'", category: 'companies' },
  { id: 'deputyC', label: "סמ\"פ ג'", category: 'companies' },
  { id: 'platoonC1', label: "מ\"מ ג' 1", category: 'companies' },
  { id: 'platoonC2', label: "מ\"מ ג' 2", category: 'companies' },
  { id: 'platoonC3', label: "מ\"מ ג' 3", category: 'companies' },

  { id: 'coD', label: "מ\"פ ד'", category: 'companies' },
  { id: 'deputyD', label: "סמ\"פ ד'", category: 'companies' },
  { id: 'platoonD1', label: "מ\"מ ד' 1", category: 'companies' },
  { id: 'platoonD2', label: "מ\"מ ד' 2", category: 'companies' },
  { id: 'platoonD3', label: "מ\"מ ד' 3", category: 'companies' },
];

const BATTALIONS = [
  { id: 'bat-1', name: 'גדוד 1891' },
  { id: 'bat-2', name: 'גדוד 1892' },
  { id: 'bat-3', name: 'גדוד 1893' },
  { id: 'bat-4', name: 'גדוד 1894' },
  { id: 'bat-5', name: 'גדוד 1895' },
];

export default function BattalionView2() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person>>({});
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});

  // בחירת הגדוד הפעיל כרגע (מתוך ה-5)
  const [selectedBatId, setSelectedBatId] = useState<string>('bat-1');

  // מילונים נפרדים לכל גדוד ב-localStorage
  const [battalionMappings, setBattalionMappings] = useState<Record<string, Record<string, string>>>({});
  
  const [isEditingCompaniesMapping, setIsEditingCompaniesMapping] = useState(false);
  const [savedCompaniesViews, setSavedCompaniesViews] = useState<{ name: string; mapping: Record<string, string> }[]>([]);
  const [companiesViewNameInput, setCompaniesViewNameInput] = useState('');

  const [filterLevel1, setFilterLevel1] = useState<string>(''); 
  const [filterLevel2, setFilterLevel2] = useState<string>(''); 
  const [filterLevel3, setFilterLevel3] = useState<string>(''); 

 useEffect(() => {
    const loadData = async () => {
      try {
        const [unitRes, assignRes, personQualsRes, personsData] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('assignments').select('*, persons(*)'),
          supabase.from('person_qualifications').select('*, qualifications(*)'),
          fetchAllPersons(),
        ]);

        if (unitRes.data) setUnits(unitRes.data);
        const positionsData = await fetchAllPositions();
        setAllPositions(positionsData);

        // שליפת כל דרישות התקנים בלולאה (עוקף לחלוטין את מגבלת ה-1000 של Supabase)
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
            console.error('Error fetching requirements chunk in BattalionView2:', reqError);
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

        const personsMap = new Map<string, Person>();
        if (personsData) {
          personsData.forEach(p => personsMap.set(String(p.id), p));
        }

        const qualsMap: Record<string, string[]> = {};
        if (personQualsRes.data) {
          personQualsRes.data.forEach((pq: any) => {
            const pid = String(pq.person_id);
            if (!qualsMap[pid]) qualsMap[pid] = [];
            const qName = pq.qualifications?.name || pq.qualification_name;
            if (qName) qualsMap[pid].push(qName);
          });
        }
        setPersonQualsMap(qualsMap);

        const assignMap: Record<string, Person[]> = {};
        if (assignRes.data) {
          const activeAssignments = (assignRes.data as any[]).filter(a => a.is_active === true);
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
        }
      } catch (err) {
        console.error('Error loading companies view data:', err);
      }
    };

    loadData();
  }, []);

  const currentCompaniesMapping = battalionMappings[selectedBatId] || {};

  const updateCompaniesMapping = (newMapping: Record<string, string>) => {
    const updated = {
      ...battalionMappings,
      [selectedBatId]: newMapping
    };
    setBattalionMappings(updated);
    localStorage.setItem(`org_tree_companies_mapping_${selectedBatId}`, JSON.stringify(newMapping));
  };

  const saveCompaniesView = () => {
    if (!companiesViewNameInput.trim()) return;
    const newViews = [...savedCompaniesViews.filter(v => v.name !== companiesViewNameInput), { name: companiesViewNameInput, mapping: currentCompaniesMapping }];
    setSavedCompaniesViews(newViews);
    localStorage.setItem('org_tree_saved_companies_views_all', JSON.stringify(newViews));
    setCompaniesViewNameInput('');
    setIsEditingCompaniesMapping(false);
  };

  const deleteCompaniesView = (name: string) => {
    const newViews = savedCompaniesViews.filter(v => v.name !== name);
    setSavedCompaniesViews(newViews);
    localStorage.setItem('org_tree_saved_companies_views_all', JSON.stringify(newViews));
  };

  const fetchAllPersons = async () => {
    let allData: Person[] = [];
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [unitRes, assignRes, reqsRes, personQualsRes, personsData] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('assignments').select('*, persons(*)'),
          supabase.from('position_requirements').select('*, qualifications(*)'),
          supabase.from('person_qualifications').select('*, qualifications(*)'),
          fetchAllPersons(),
        ]);

        if (unitRes.data) setUnits(unitRes.data);
        const positionsData = await fetchAllPositions();
        setAllPositions(positionsData);
        if (reqsRes.data) setPositionReqs(reqsRes.data);

        const personsMap = new Map<string, Person>();
        if (personsData) {
          personsData.forEach(p => personsMap.set(String(p.id), p));
        }

        const qualsMap: Record<string, string[]> = {};
        if (personQualsRes.data) {
          personQualsRes.data.forEach((pq: any) => {
            const pid = String(pq.person_id);
            if (!qualsMap[pid]) qualsMap[pid] = [];
            const qName = pq.qualifications?.name || pq.qualification_name;
            if (qName) qualsMap[pid].push(qName);
          });
        }
        setPersonQualsMap(qualsMap);

        const assignMap: Record<string, Person[]> = {};
        if (assignRes.data) {
          const activeAssignments = (assignRes.data as any[]).filter(a => a.is_active === true);
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
        }
      } catch (err) {
        console.error('Error loading companies view data:', err);
      }
    };

    loadData();
  }, []);

  const currentBatObj = BATTALIONS.find(b => b.id === selectedBatId) || BATTALIONS[0];

  const level1Units = useMemo(() => {
    return units.filter(u => String(u.parent_unit_id) === '189' || String(u.id) === '189' || (!u.parent_unit_id));
  }, [units]);

  const level2Units = useMemo(() => {
    if (!filterLevel1) return [];
    return units.filter(u => String(u.parent_unit_id) === String(filterLevel1));
  }, [units, filterLevel1]);

  const level3Units = useMemo(() => {
    if (!filterLevel2) return [];
    return units.filter(u => String(u.parent_unit_id) === String(filterLevel2));
  }, [units, filterLevel2]);

  const filteredPositionsForDropdown = useMemo(() => {
    let targetUnitId = '';
    if (filterLevel3) targetUnitId = filterLevel3;
    else if (filterLevel2) targetUnitId = filterLevel2;
    else if (filterLevel1) targetUnitId = filterLevel1;

    if (!targetUnitId) return allPositions;

    const unitIdsToInclude = new Set<string>([targetUnitId]);
    const findSubtree = (parentId: string) => {
      units.forEach(u => {
        if (String(u.parent_unit_id) === String(parentId)) {
          unitIdsToInclude.add(String(u.id));
          findSubtree(String(u.id));
        }
      });
    };
    findSubtree(targetUnitId);

    const matched = allPositions.filter(p => p.unit_id !== null && p.unit_id !== undefined && unitIdsToInclude.has(String(p.unit_id)));
    return matched.length > 0 ? matched : allPositions;
  }, [allPositions, filterLevel1, filterLevel2, filterLevel3, units]);

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

  const getCompaniesSlotDetails = (slotId: string) => {
    const positionId = currentCompaniesMapping[slotId];
    if (!positionId) return { position: null, person: null, isQualified: true };
    const position = allPositions.find(p => String(p.id) === String(positionId)) || null;
    const assignedList = position ? activeAssignmentsMap[String(position.id)] : null;
    const personsArr = assignedList ? (Array.isArray(assignedList) ? assignedList : [assignedList]) : [];
    const person = personsArr.length > 0 ? personsArr[0] : null;
    const isQualified = checkQualification(position, person);
    return { position, person, isQualified };
  };

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-6 min-h-[650px] bg-white border-slate-200 flex flex-col items-center">
        
        {/* שורת 5 הכפתורים בחלק העליון לפי גדוד */}
        <div className="w-full flex items-center justify-center gap-2 pb-4 border-b border-slate-200 flex-wrap">
          {BATTALIONS.map((bat) => {
            const isActive = bat.id === selectedBatId;
            return (
              <button
                key={bat.id}
                onClick={() => setSelectedBatId(bat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md scale-105'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {bat.name}
              </button>
            );
          })}
        </div>

        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-emerald-600">פלוגות מבצעיות - {currentBatObj.name}</h3>
            <p className="text-xs text-slate-500 mt-1">מבנה הפלוגות, הסמ"פים והמחלקות עבור {currentBatObj.name}</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsEditingCompaniesMapping(!isEditingCompaniesMapping)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isEditingCompaniesMapping ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{isEditingCompaniesMapping ? 'סיום הגדרת תקנים' : 'שייך תקנים לתצוגה'}</span>
            </button>

            {savedCompaniesViews.length > 0 && (
              <select
                onChange={(e) => {
                  const found = savedCompaniesViews.find(v => v.name === e.target.value);
                  if (found) updateCompaniesMapping(found.mapping);
                }}
                className="bg-slate-50 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-300 outline-none"
                defaultValue=""
              >
                <option value="" disabled>טען תצוגה שמורה...</option>
                {savedCompaniesViews.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isEditingCompaniesMapping && (
          <div className="w-full bg-slate-50 border border-emerald-300 p-4 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">הגדרת התקנים למשבצות הפלוגות המבצעיות עבור {currentBatObj.name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="שם תצוגה לשמירה..."
                  value={companiesViewNameInput}
                  onChange={(e) => setCompaniesViewNameInput(e.target.value)}
                  className="bg-white text-xs text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 outline-none w-60"
                />
                <button
                  onClick={saveCompaniesView}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>שמור תצוגה</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-emerald-600" />
                <span>סינון היררכי לבחירת תקנים (רמה 1 ➔ רמה 2 ➔ רמה 3):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={filterLevel1}
                  onChange={(e) => { setFilterLevel1(e.target.value); setFilterLevel2(''); setFilterLevel3(''); }}
                  className="bg-slate-50 text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none"
                >
                  <option value="">-- רמה 1: בחר יחידה ראשית (גדוד) --</option>
                  {level1Units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                  ))}
                </select>

                <select
                  value={filterLevel2}
                  onChange={(e) => { setFilterLevel2(e.target.value); setFilterLevel3(''); }}
                  disabled={!filterLevel1}
                  className="bg-slate-50 text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
                >
                  <option value="">-- רמה 2: בחר יחידה כפופה --</option>
                  {level2Units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                  ))}
                </select>

                <select
                  value={filterLevel3}
                  onChange={(e) => setFilterLevel3(e.target.value)}
                  disabled={!filterLevel2 || level3Units.length === 0}
                  className="bg-slate-50 text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
                >
                  <option value="">-- רמה 3: בחר תת-יחידה --</option>
                  {level3Units.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
              {COMPANIES_SLOTS.map((slot) => {
                const currentPosId = currentCompaniesMapping[slot.id] || '';
                return (
                  <div key={slot.id} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">{slot.label}</span>
                    <select
                      value={currentPosId}
                      onChange={(e) => updateCompaniesMapping({ ...currentCompaniesMapping, [slot.id]: e.target.value })}
                      className="w-full bg-slate-50 text-xs text-slate-800 p-1.5 rounded border border-slate-300 outline-none"
                    >
                      <option value="">-- בחר תקן --</option>
                      {filteredPositionsForDropdown.map((pos) => {
                        const assignedList = activeAssignmentsMap[String(pos.id)];
                        const assignedPerson = Array.isArray(assignedList) ? assignedList[0] : assignedList;
                        const personLabel = assignedPerson ? ` (${getFullName(assignedPerson)})` : ' (לא מאויש)';
                        return (
                          <option key={pos.id} value={pos.id}>{pos.title}{personLabel}</option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>

            {savedCompaniesViews.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 flex-wrap">
                <span className="text-xs text-slate-600">תצורות שמורות:</span>
                {savedCompaniesViews.map((v) => (
                  <div key={v.name} className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800">
                    <span>{v.name}</span>
                    <button onClick={() => deleteCompaniesView(v.name)} className="text-red-500 hover:text-red-700 p-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center w-full max-w-sm space-y-2">
          {['bcComp', 'dacAComp', 'dacBComp'].map((slotId, index) => {
            const slotDef = COMPANIES_SLOTS.find(s => s.id === slotId)!;
            const { position, person, isQualified } = getCompaniesSlotDetails(slotId);
            return (
              <div key={slotId} className="w-full flex flex-col items-center">
                <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-xl text-center shadow-sm w-full">
                  <span className="text-xs text-amber-800 font-bold block">{slotDef.label}</span>
                  <span className="text-sm font-bold text-slate-900 mt-1 block">
                    {person ? (
                      <div className="space-y-0.5">
                        <span>{getFullName(person)}</span>
                        {!isQualified && <span className="block text-[11px] text-amber-600 font-medium">⚠️ ללא הסמכה</span>}
                      </div>
                    ) : (
                      <span className="text-rose-600">⚠️ פער איוש</span>
                    )}
                  </span>
                  {position && <span className="text-[10px] text-slate-500 block mt-0.5">({position.title})</span>}
                </div>
                {index < 2 && <div className="w-0.5 h-6 bg-slate-300"></div>}
              </div>
            );
          })}
          <div className="w-0.5 h-8 bg-slate-300"></div>
        </div>

        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {[
            { name: "פלוגה א'", slots: ['coA', 'deputyA', 'platoonA1', 'platoonA2', 'platoonA3'] },
            { name: "פלוגה ב'", slots: ['coB', 'deputyB', 'platoonB1', 'platoonB2', 'platoonB3'] },
            { name: "פלוגה ג'", slots: ['coC', 'deputyC', 'platoonC1', 'platoonC2', 'platoonC3'] },
            { name: "פלוגה ד'", slots: ['coD', 'deputyD', 'platoonD1', 'platoonD2', 'platoonD3'] },
          ].map((company, cIdx) => (
            <div key={cIdx} className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-sm">
              <div className="bg-emerald-100 border border-emerald-300 p-2.5 rounded-lg text-center">
                <span className="text-xs font-bold text-emerald-900">{company.name}</span>
              </div>
              <div className="space-y-2.5">
                {company.slots.map((slotId) => {
                  const slotDef = COMPANIES_SLOTS.find(s => s.id === slotId)!;
                  const { position, person, isQualified } = getCompaniesSlotDetails(slotId);
                  return (
                    <div key={slotId} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700">{slotDef.label}</span>
                        {position && <span className="text-[9px] text-slate-400">({position.title})</span>}
                      </div>
                      <div className="text-xs">
                        {person ? (
                          <div className="space-y-0.5">
                            <span className={`font-semibold block ${isQualified ? 'text-slate-900' : 'text-amber-600'}`}>
                              {getFullName(person)}
                            </span>
                            {!isQualified && <span className="text-[10px] text-amber-600 block font-medium">⚠️ ללא הסמכה</span>}
                          </div>
                        ) : (
                          <span className="text-rose-600 font-bold block">🚨 פער - לא מאויש</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}