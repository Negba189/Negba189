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

const HQ_SLOTS = [
  { id: 'bc', label: 'מפקד הגדוד (מג"ד)', category: 'command' },
  { id: 'dac', label: 'סגן מפקד הגדוד (סמג"ד א)', category: 'command' },
  { id: 'dacB', label: 'סגן מפקד הגדוד (סמג"ד ב)', category: 'command' },
  { id: 'coA', label: "מ\"פ א'", category: 'companies' },
  { id: 'coB', label: "מ\"פ ב'", category: 'companies' },
  { id: 'coC', label: "מ\"פ ג'", category: 'companies' },
  { id: 'coD', label: "מ\"פ ד'", category: 'companies' },
  { id: 'opsOfficer', label: 'ק. אג"ם', category: 'ops' },
  { id: 'opsAsst', label: 'קמב"צ', category: 'ops' },
  { id: 'intel', label: 'קמ"ן', category: 'ops' },
  { id: 'comms', label: 'קשר"ג', category: 'ops' },
  { id: 'hqAdmin', label: 'מפ"מ', category: 'hq' },
  { id: 'personnel', label: 'ק. משא"ן', category: 'hq' },
  { id: 'logistics', label: 'קל"ג', category: 'hq' },
  { id: 'medical', label: 'קרפ"ג', category: 'hq' },
];

const BATTALIONS = [
  { id: 'bat-1', name: 'גדוד 1891' },
  { id: 'bat-2', name: 'גדוד 1892' },
  { id: 'bat-3', name: 'גדוד 1893' },
  { id: 'bat-4', name: 'גדוד 1894' },
  { id: 'bat-5', name: 'גדוד 1895' },
];

export default function BattalionView1() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person>>({});
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});

  // בחירת הגדוד הפעיל כרגע (מתוך ה-5)
  const [selectedBatId, setSelectedBatId] = useState<string>('bat-1');

  // מילונים נפרדים לכל גדוד כדי שכל כפתור ישמור את המיפוי שלו ב-localStorage
  const [battalionMappings, setBattalionMappings] = useState<Record<string, Record<string, string>>>({});
  
  const [isEditingHqMapping, setIsEditingHqMapping] = useState(false);
  const [savedHqViews, setSavedHqViews] = useState<{ name: string; mapping: Record<string, string> }[]>([]);
  const [viewNameInput, setViewNameInput] = useState('');

  const [filterLevel1, setFilterLevel1] = useState<string>(''); 
  const [filterLevel2, setFilterLevel2] = useState<string>(''); 
  const [filterLevel3, setFilterLevel3] = useState<string>(''); 

  // טעינת ההגדרות והמיפויים מ-localStorage עבור כל 5 הגדודים
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
        console.error('Error loading battalion view data:', err);
      }
    };

    loadData();
  }, []);

  const currentHqMapping = battalionMappings[selectedBatId] || {};

  const updateHqMapping = (newMapping: Record<string, string>) => {
    const updated = {
      ...battalionMappings,
      [selectedBatId]: newMapping
    };
    setBattalionMappings(updated);
    localStorage.setItem(`org_tree_hq_mapping_${selectedBatId}`, JSON.stringify(newMapping));
  };

  const saveHqView = () => {
    if (!viewNameInput.trim()) return;
    const newViews = [...savedHqViews.filter(v => v.name !== viewNameInput), { name: viewNameInput, mapping: currentHqMapping }];
    setSavedHqViews(newViews);
    localStorage.setItem('org_tree_saved_hq_views_all', JSON.stringify(newViews));
    setViewNameInput('');
    setIsEditingHqMapping(false);
  };

  const deleteHqView = (name: string) => {
    const newViews = savedHqViews.filter(v => v.name !== name);
    setSavedHqViews(newViews);
    localStorage.setItem('org_tree_saved_hq_views_all', JSON.stringify(newViews));
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
        console.error('Error loading battalion view data:', err);
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

  const getHqSlotDetails = (slotId: string) => {
    const positionId = currentHqMapping[slotId];
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
        
        {/* שורת 5 הכפתורים בחלק העליון (איפה שביקשת) */}
        <div className="w-full flex items-center justify-center gap-2 pb-4 border-b border-slate-200 flex-wrap">
          {BATTALIONS.map((bat) => {
            const isActive = bat.id === selectedBatId;
            return (
              <button
                key={bat.id}
                onClick={() => setSelectedBatId(bat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md scale-105'
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
            <h3 className="text-lg font-bold text-amber-600">מטה {currentBatObj.name}</h3>
            <p className="text-xs text-slate-500 mt-1">שדרת הפיקוד הראשית וחלוקה לענפים מבצעיים עבור {currentBatObj.name}</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsEditingHqMapping(!isEditingHqMapping)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isEditingHqMapping ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{isEditingHqMapping ? 'סיום הגדרת תקנים' : 'שייך תקנים לתצוגה'}</span>
            </button>

            {savedHqViews.length > 0 && (
              <select
                onChange={(e) => {
                  const found = savedHqViews.find(v => v.name === e.target.value);
                  if (found) updateHqMapping(found.mapping);
                }}
                className="bg-slate-50 text-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-300 outline-none"
                defaultValue=""
              >
                <option value="" disabled>טען תצוגה שמורה...</option>
                {savedHqViews.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {isEditingHqMapping && (
          <div className="w-full bg-slate-50 border border-amber-300 p-4 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-800">הגדרת התקנים למשבצות המטה עבור {currentBatObj.name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="שם תצוגה לשמירה..."
                  value={viewNameInput}
                  onChange={(e) => setViewNameInput(e.target.value)}
                  className="bg-white text-xs text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 outline-none w-60"
                />
                <button
                  onClick={saveHqView}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>שמור תצוגה</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Filter className="w-3.5 h-3.5 text-amber-600" />
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
              {HQ_SLOTS.map((slot) => {
                const currentPosId = currentHqMapping[slot.id] || '';
                return (
                  <div key={slot.id} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">{slot.label}</span>
                    <select
                      value={currentPosId}
                      onChange={(e) => updateHqMapping({ ...currentHqMapping, [slot.id]: e.target.value })}
                      className="w-full bg-slate-50 text-xs text-slate-800 p-1.5 rounded border border-slate-300 outline-none"
                    >
                      <option value="">-- בחר תקן --</option>
                      {filteredPositionsForDropdown.map((pos) => {
  const assignedList = activeAssignmentsMap[String(pos.id)];
  // שליפת החייל הראשון מהמערך במידה וקיים
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

            {savedHqViews.length > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 flex-wrap">
                <span className="text-xs text-slate-600">תצורות שמורות:</span>
                {savedHqViews.map((v) => (
                  <div key={v.name} className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs text-slate-800">
                    <span>{v.name}</span>
                    <button onClick={() => deleteHqView(v.name)} className="text-red-500 hover:text-red-700 p-0.5">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center w-full max-w-sm space-y-2">
          {['bc', 'dac', 'dacB'].map((slotId, index) => {
            const slotDef = HQ_SLOTS.find(s => s.id === slotId)!;
            const { position, person, isQualified } = getHqSlotDetails(slotId);
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

        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="bg-amber-100 border border-amber-300 p-2 rounded-lg text-center">
              <span className="text-xs font-bold text-amber-900">מפקדה ותומכ"ל</span>
            </div>
            <div className="space-y-2">
              {['hqAdmin', 'personnel', 'logistics', 'medical'].map((slotId) => {
                const slotDef = HQ_SLOTS.find(s => s.id === slotId)!;
                const { position, person, isQualified } = getHqSlotDetails(slotId);
                return (
                  <div key={slotId} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">{slotDef.label}</span>
                    <div className="text-right">
                      {person ? (
                        <span className={`text-xs font-bold ${isQualified ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {getFullName(person)}
                        </span>
                      ) : (
                        <span className="text-xs text-rose-600 font-bold">פער</span>
                      )}
                      {position && <span className="block text-[9px] text-slate-400">({position.title})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="bg-amber-100 border border-amber-300 p-2 rounded-lg text-center">
              <span className="text-xs font-bold text-amber-900">אג"ם</span>
            </div>
            <div className="space-y-2">
              {['opsOfficer', 'opsAsst', 'intel', 'comms'].map((slotId) => {
                const slotDef = HQ_SLOTS.find(s => s.id === slotId)!;
                const { position, person, isQualified } = getHqSlotDetails(slotId);
                return (
                  <div key={slotId} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">{slotDef.label}</span>
                    <div className="text-right">
                      {person ? (
                        <span className={`text-xs font-bold ${isQualified ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {getFullName(person)}
                        </span>
                      ) : (
                        <span className="text-xs text-rose-600 font-bold">פער</span>
                      )}
                      {position && <span className="block text-[9px] text-slate-400">({position.title})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="bg-amber-100 border border-amber-300 p-2 rounded-lg text-center">
              <span className="text-xs font-bold text-amber-900">פלוגות</span>
            </div>
            <div className="space-y-2">
              {['coA', 'coB', 'coC', 'coD'].map((slotId) => {
                const slotDef = HQ_SLOTS.find(s => s.id === slotId)!;
                const { position, person, isQualified } = getHqSlotDetails(slotId);
                return (
                  <div key={slotId} className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-700 font-medium">{slotDef.label}</span>
                    <div className="text-right">
                      {person ? (
                        <span className={`text-xs font-bold ${isQualified ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {getFullName(person)}
                        </span>
                      ) : (
                        <span className="text-xs text-rose-600 font-bold">פער</span>
                      )}
                      {position && <span className="block text-[9px] text-slate-400">({position.title})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}