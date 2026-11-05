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

// הגדרת התקנים הקבועים מאחורי הקלעים לכל גדוד (Hardcoded) לפי מזהי ה-ID מטבלת positions
const FIXED_BATTALION_MAPPINGS: Record<string, Record<string, string>> = {
  'bat-1': {
    bc: '2',          // מג"ד
    dac: '3',         // סמג"ד א'
    dacB: '4',        // סמג"ד ב'
    coA: '211',       // מ"פ א'
    coB: '213',       // מ"פ ב'
    coC: '310',       // מ"פ ג'
    coD: '407',       // מ"פ ד'
    opsOfficer: '527',// ק. אג"ם
    opsAsst: '528',   // קמב"צ
    intel: '546',     // קמ"ן
    comms: '554',     // קשר"ג
    hqAdmin: '576',   // מפ"מ
    personnel: '504', // ק. משא"ן
    logistics: '625', // קל"ג
    medical: '629',   // קרפ"ג
  },
  'bat-2': {
    bc: '847',        // מג"ד
    dac: '846',       // סמג"ד א'
    dacB: '845',      // סמג"ד ב'
    coA: '865',       // מ"פ א'
    coB: '854',       // מ"פ ב'
    coC: '850',       // מ"פ ג'
    coD: '848',       // מ"פ ד'
    opsOfficer: '861',// ק. אג"ם
    opsAsst: '863',   // קמב"צ
    intel: '899',     // קמ"ן
    comms: '935',     // קשר"ג
    hqAdmin: '853',   // מפ"מ
    personnel: '907', // ק. משא"ן
    logistics: '919', // קל"ג
    medical: '925',   // קרפ"ג
  },
  'bat-3': {
    bc: '1405',       // מג"ד
    dac: '1404',      // סמג"ד א'
    dacB: '1403',     // סמג"ד ב'
    coA: '1423',      // מ"פ א'
    coB: '1412',      // מ"פ ב'
    coC: '1408',      // מ"פ ג'
    coD: '1406',      // מ"פ ד'
    opsOfficer: '1419',// ק. אג"ם
    opsAsst: '1421',  // קמב"צ
    intel: '1457',    // קמ"ן
    comms: '1493',    // קשר"ג
    hqAdmin: '1411',  // מפ"מ
    personnel: '1465',// ק. משא"ן
    logistics: '1477',// קל"ג
    medical: '1483',  // קרפ"ג
  },
  'bat-4': {
    bc: '1963',       // מג"ד
    dac: '1962',      // סמג"ד א'
    dacB: '1961',     // סמג"ד ב'
    coA: '1981',      // מ"פ א'
    coB: '1970',      // מ"פ ב'
    coC: '1966',      // מ"פ ג'
    coD: '1964',      // מ"פ ד'
    opsOfficer: '1977',// ק. אג"ם
    opsAsst: '1979',  // קמב"צ
    intel: '2015',    // קמ"ן
    comms: '2051',    // קשר"ג
    hqAdmin: '1969',  // מפ"מ
    personnel: '2023',// ק. משא"ן
    logistics: '2035',// קל"ג
    medical: '2041',  // קרפ"ג
  },
  'bat-5': {
    bc: '2521',       // מג"ד
    dac: '2520',      // סמג"ד א'
    dacB: '2519',     // סמג"ד ב'
    coA: '2539',      // מ"פ א'
    coB: '2528',      // מ"פ ב'
    coC: '2524',      // מ"פ ג'
    coD: '2522',      // מ"פ ד'
    opsOfficer: '2535',// ק. אג"ם
    opsAsst: '2537',  // קמב"צ
    intel: '2573',    // קמ"ן
    comms: '2609',    // קשר"ג
    hqAdmin: '2527',  // מפ"מ
    personnel: '2581',// ק. משא"ן
    logistics: '2593',// קל"ג
    medical: '2599',  // קרפ"ג
  },
};

export default function BattalionView1() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person>>({});
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});

  // בחירת הגדוד הפעיל כרגע (מתוך ה-5)
  const [selectedBatId, setSelectedBatId] = useState<string>('bat-1');

  const [isEditingHqMapping, setIsEditingHqMapping] = useState(false);
  const [savedHqViews, setSavedHqViews] = useState<{ name: string; mapping: Record<string, string> }[]>([]);
  const [viewNameInput, setViewNameInput] = useState('');

  const [filterLevel1, setFilterLevel1] = useState<string>(''); 
  const [filterLevel2, setFilterLevel2] = useState<string>(''); 
  const [filterLevel3, setFilterLevel3] = useState<string>(''); 

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

  const fetchAllPersonQuals = async () => {
    let allData: any[] = [];
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
        const [unitRes, assignRes, personsData, personQualsData] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('assignments').select('*, persons(*)'),
          fetchAllPersons(),
          fetchAllPersonQuals(), // שימוש בפונקציה המדורגת המלאה כאן
        ]);

        if (unitRes.data) setUnits(unitRes.data);
        const positionsData = await fetchAllPositions();
        setAllPositions(positionsData);

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

        // בניית מפת ההסמכות מתוך כל הנתונים המלאים שהתקבלו בפעימות
        const qualsMap: Record<string, string[]> = {};
        if (personQualsData) {
          personQualsData.forEach((pq: any) => {
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

  // שליפת התקנים הקבועים מאחורי הקלעים לפי הגדוד הנבחר
  const currentHqMapping = FIXED_BATTALION_MAPPINGS[selectedBatId] || {};

  const saveHqView = () => {
    if (!viewNameInput.trim()) return;
    const newViews = [...savedHqViews.filter(v => v.name !== viewNameInput), { name: viewNameInput, mapping: currentHqMapping }];
    setSavedHqViews(newViews);
    setViewNameInput('');
    setIsEditingHqMapping(false);
  };

  const deleteHqView = (name: string) => {
    const newViews = savedHqViews.filter(v => v.name !== name);
    setSavedHqViews(newViews);
  };

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
    const personQualsNormalized = personQuals.map(s => String(s).toLowerCase().trim());

    // דיאגנוסטיקה: הדפסה לקונסול כדי לראות למה יש פער
    console.log(`Checking Position: ${position.title} (ID: ${position.id}) for Person: ${person.first_name} ${person.last_name} (ID: ${person.id})`);
    console.log('Required Reqs:', reqs);
    console.log('Person Quals Found:', personQualsNormalized);

    return reqs.every(req => {
      const qName = (req.qualifications?.name || req.qualification_name || '').toLowerCase().trim();
      if (!qName) return true;
      
      const hasIt = personQualsNormalized.some(pq => pq === qName || pq.includes(qName));
      console.log(`Requirement "${qName}": Matched = ${hasIt}`);
      return hasIt;
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
        
        {/* שורת 5 הכפתורים בחלק העליון */}
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
            <p className="text-xs text-slate-500 mt-1">שדרת הפיקוד הראשית וחלוקה לענפים מבצעיים עבור {currentBatObj.name} (מעודכן אוטומטית לפי תקני הגדוד)</p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsEditingHqMapping(!isEditingHqMapping)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isEditingHqMapping ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{isEditingHqMapping ? 'סיום הצגת תקנים קבועים' : 'הצג תקנים מוגדרים'}</span>
            </button>
          </div>
        </div>

        {isEditingHqMapping && (
          <div className="w-full bg-slate-50 border border-amber-300 p-4 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-amber-800">תקני מטה קבועים עבור {currentBatObj.name} (מוגדרים בקוד)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
              {HQ_SLOTS.map((slot) => {
                const currentPosId = currentHqMapping[slot.id] || '';
                const posObj = allPositions.find(p => String(p.id) === String(currentPosId));
                return (
                  <div key={slot.id} className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <span className="text-xs font-bold text-slate-700 block">{slot.label}</span>
                    <div className="w-full bg-slate-100 text-xs text-slate-800 p-1.5 rounded border border-slate-300 font-medium">
                      {posObj ? `${posObj.title} (ID: ${posObj.id})` : 'לא הוגדר תקן'}
                    </div>
                  </div>
                );
              })}
            </div>
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
