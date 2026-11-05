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

const FIXED_COMPANIES_MAPPINGS: Record<string, Record<string, string>> = {
  'bat-1': {
    bcComp: '2', dacAComp: '3', dacBComp: '4',
    coA: '211', deputyA: '212', platoonA1: '5', platoonA2: '155', platoonA3: '184',
    coB: '213', deputyB: '214', platoonB1: '217', platoonB2: '254', platoonB3: '283',
    coC: '310', deputyC: '311', platoonC1: '314', platoonC2: '351', platoonC3: '380',
    coD: '407', deputyD: '408', platoonD1: '411', platoonD2: '448', platoonD3: '477',
  },
  'bat-2': {
    bcComp: '847', dacAComp: '846', dacBComp: '845',
    coA: '865', deputyA: '864', platoonA1: '965', platoonA2: '879', platoonA3: '3077',
    coB: '854', deputyB: '855', platoonB1: '957', platoonB2: '870', platoonB3: '891',
    coC: '850', deputyC: '851', platoonC1: '930', platoonC2: '945', platoonC3: '961',
    coD: '848', deputyD: '849', platoonD1: '867', platoonD2: '883', platoonD3: '895',
  },
  'bat-3': {
    bcComp: '1405', dacAComp: '1404', dacBComp: '1403',
    coA: '1423', deputyA: '1422', platoonA1: '1523', platoonA2: '1437', platoonA3: '1459',
    coB: '1412', deputyB: '1413', platoonB1: '1515', platoonB2: '1428', platoonB3: '1449',
    coC: '1408', deputyC: '1409', platoonC1: '1488', platoonC2: '1503', platoonC3: '1519',
    coD: '1406', deputyD: '1407', platoonD1: '1425', platoonD2: '1441', platoonD3: '1453',
  },
  'bat-4': {
    bcComp: '1963', dacAComp: '1962', dacBComp: '1961',
    coA: '1981', deputyA: '1980', platoonA1: '2081', platoonA2: '1995', platoonA3: '2017',
    coB: '1970', deputyB: '1971', platoonB1: '2073', platoonB2: '1986', platoonB3: '2007',
    coC: '1966', deputyC: '1967', platoonC1: '2046', platoonC2: '2061', platoonC3: '2077',
    coD: '1964', deputyD: '1965', platoonD1: '1983', platoonD2: '1999', platoonD3: '2011',
  },
  'bat-5': {
    bcComp: '2521', dacAComp: '2520', dacBComp: '2519',
    coA: '2539', deputyA: '2538', platoonA1: '2639', platoonA2: '2553', platoonA3: '2575',
    coB: '2528', deputyB: '2529', platoonB1: '2631', platoonB2: '2544', platoonB3: '2565',
    coC: '2524', deputyC: '2525', platoonC1: '2604', platoonC2: '2619', platoonC3: '2635',
    coD: '2522', deputyD: '2523', platoonD1: '2541', platoonD2: '2557', platoonD3: '2569',
  },
};

export default function BattalionView2() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person>>({});
  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});

  const [selectedBatId, setSelectedBatId] = useState<string>('bat-1');
  
  const [isEditingCompaniesMapping, setIsEditingCompaniesMapping] = useState(false);
  const [savedCompaniesViews, setSavedCompaniesViews] = useState<{ name: string; mapping: Record<string, string> }[]>([]);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const [unitRes, assignRes, personsData, personQualsData] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('assignments').select('*, persons(*)'),
          fetchAllPersons(),
          fetchAllPersonQuals(),
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
        console.error('Error loading companies view data:', err);
      }
    };

    loadData();
  }, []);

  const currentCompaniesMapping = FIXED_COMPANIES_MAPPINGS[selectedBatId] || {};
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

    return reqs.every(req => {
      const qName = (req.qualifications?.name || req.qualification_name || '').toLowerCase().trim();
      if (!qName) return true;
      return personQualsNormalized.some(pq => pq === qName || pq.includes(qName));
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
            <p className="text-xs text-slate-500 mt-1">מבנה הפלוגות, הסמ"פים והמחלקות עבור {currentBatObj.name} (מעודכן אוטומטית לפי תקני הגדוד)</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsEditingCompaniesMapping(!isEditingCompaniesMapping)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isEditingCompaniesMapping ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>{isEditingCompaniesMapping ? 'סיום הצגת תקנים קבועים' : 'הצג תקנים מוגדרים'}</span>
            </button>
          </div>
        </div>

        {isEditingCompaniesMapping && (
          <div className="w-full bg-slate-50 border border-emerald-300 p-4 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">תקני הפלוגות הקבועים עבור {currentBatObj.name} (מוגדרים בקוד)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto p-1">
              {COMPANIES_SLOTS.map((slot) => {
                const currentPosId = currentCompaniesMapping[slot.id] || '';
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
