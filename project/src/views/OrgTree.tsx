import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  Building2,
  Shield,
  Building,
  Map as MapIcon,
  ClipboardList,
  Truck,
  Layers,
  Users,
  User,
  CircleUser,
  UserPlus,
  Network,
  Edit,
  PlusCircle,
  Edit2,
  X,
  Award,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type UnitType,
  type Position,
  type Person,
  UNIT_TYPE_ORDER,
  getFullName,
} from '@/types';
import AssignmentModal from '@/components/AssignmentModal';
import { useSystemUser } from '@/context/SystemUserContext';
import { useUnitScope } from '@/context/UnitScopeContext';
import QualificationsModal from '@/components/QualificationsModal';

const ICON_BY_TYPE: Record<UnitType, typeof Building2> = {
  BRIGADE: Building2,
  BATTALION: Shield,
  HEADQUARTERS: Building,
  FORWARD_HQ: MapIcon,
  OPS_STAFF: ClipboardList,
  LOGISTICS: Truck,
  FRAMEWORK: Layers,
  COMPANY: Users,
  PLATOON: User,
  SQUAD: CircleUser,
};

interface UnitNode extends Unit {
  children: UnitNode[];
}

export default function OrgTree() {
  const { canEdit } = useSystemUser();
  const { selectedScopeUnitId } = useUnitScope();

  const [units, setUnits] = useState<Unit[]>([]);
  const [tree, setTree] = useState<UnitNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [unitPositions, setUnitPositions] = useState<Position[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, Person[]>>({});
  const [unitPersonsMap, setUnitPersonsMap] = useState<Record<string, Person[]>>({});
  
  const [assignModalOpen, setAssignModalOpen] = useState<Position | null>(null);
  const [statusRefetch, setStatusRefetch] = useState(0);

  const [positionReqs, setPositionReqs] = useState<any[]>([]);
  const [personQualsMap, setPersonQualsMap] = useState<Record<string, string[]>>({});
  const [personQualsIdsMap, setPersonQualsIdsMap] = useState<Record<string, string[]>>({});

  const [editUnitModalOpen, setEditUnitModalOpen] = useState(false);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitType, setEditUnitType] = useState<string>('COMPANY');

  const [addSubUnitModalOpen, setAddSubUnitModalOpen] = useState(false);
  const [newSubUnitName, setNewSubUnitName] = useState('');
  const [newSubUnitType, setNewSubUnitType] = useState<string>('COMPANY');

  const [addBrigadeModalOpen, setAddBrigadeModalOpen] = useState(false);
  const [newBrigadeName, setNewBrigadeName] = useState('');

  const [qualModalOpen, setQualModalOpen] = useState(false);
  const [qualPerson, setQualPerson] = useState<Person | null>(null);

  const openQualModal = (person: Person) => {
    setQualPerson(person);
    setQualModalOpen(true);
  };

  useEffect(() => {
    if (selectedUnit) {
      setEditUnitName(selectedUnit.name);
      setEditUnitType(selectedUnit.unit_type || 'COMPANY');
    }
  }, [selectedUnit]);

  const handleUpdateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    try {
      const { error } = await supabase
        .from('units')
        .update({ name: editUnitName, unit_type: editUnitType })
        .eq('id', selectedUnit.id);

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
    if (!selectedUnit) return;

    try {
      const { error } = await supabase
        .from('units')
        .insert([
          {
            name: newSubUnitName,
            unit_type: newSubUnitType,
            parent_unit_id: selectedUnit.id,
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

  const handleAddBrigade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('units')
        .insert([
          {
            name: newBrigadeName,
            unit_type: 'BRIGADE',
            parent_unit_id: null,
          },
        ]);

      if (error) throw error;

      setAddBrigadeModalOpen(false);
      setNewBrigadeName('');
      setStatusRefetch(n => n + 1);
    } catch (err) {
      console.error('Error adding brigade:', err);
      alert('שגיאה בהקמת חטיבה חדשה');
    }
  };

  const buildTree = useCallback((flatUnits: Unit[]): UnitNode[] => {
    const map = new Map<string, UnitNode>();
    flatUnits.forEach((u) => map.set(String(u.id), { ...u, children: [] }));
    const roots: UnitNode[] = [];
    flatUnits.forEach((u) => {
      const node = map.get(String(u.id))!;
      if (u.parent_unit_id && map.has(String(u.parent_unit_id))) {
        map.get(String(u.parent_unit_id))!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (nodes: UnitNode[]) => {
      nodes.sort((a, b) => {
        const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
        const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, 'he');
      });
      nodes.forEach((n) => sortNodes(n.children));
    };

    sortNodes(roots);
    return roots;
  }, []);

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

  // שליפה מדורגת מלאה להסמכות אישיות (עוקף את מגבלת ה-1000 שורות)
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

  const fetchAllAssignments = async () => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, persons(*)')
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

  const fetchUnits = useCallback(async () => {
    try {
      const [unitRes, personQualsData, personsData, assignmentsData] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        fetchAllPersonQuals(),
        fetchAllPersons(), 
        fetchAllAssignments(),
      ]);

      if (unitRes.error) return;

      let allRequirements: any[] = [];
      let reqFrom = 0;
      const reqStep = 1000;
      let keepFetchingReqs = true;

      while (keepFetchingReqs) {
        const { data: reqChunk, error: reqError } = await supabase
          .from('position_requirements')
          .select('*, qualifications(*)')
          .range(reqFrom, reqFrom + reqStep - 1);

        if (reqError) break;

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

      const positionsData = await fetchAllPositions();
      if (positionsData) setAllPositions(positionsData as Position[]);

      const personsMap = new Map<string, Person>();
      const unitAssignedPersons: Record<string, Person[]> = {};

      if (personsData) {
        (personsData as Person[]).forEach(p => {
          personsMap.set(String(p.id), p);
          if (p.unit_id) {
            const uKey = String(p.unit_id);
            if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
            if (!unitAssignedPersons[uKey].some(existing => String(existing.id) === String(p.id))) {
              unitAssignedPersons[uKey].push(p);
            }
          }
        });
      }

      const qualsMap: Record<string, string[]> = {};
      const qualsIdsMap: Record<string, string[]> = {};
      if (personQualsData) {
        (personQualsData as any[]).forEach(pq => {
          const pid = String(pq.person_id);
          if (!qualsMap[pid]) qualsMap[pid] = [];
          if (!qualsIdsMap[pid]) qualsIdsMap[pid] = [];
          
          if (pq.qualification_id) {
            qualsIdsMap[pid].push(String(pq.qualification_id).trim());
          }
          const qName = pq.qualifications?.name || pq.qualification_name;
          if (qName) qualsMap[pid].push(String(qName).trim());
        });
      }
      setPersonQualsMap(qualsMap);
      setPersonQualsIdsMap(qualsIdsMap);

      const assignMap: Record<string, Person[]> = {};

      if (assignmentsData) {
        const activeAssignments = (assignmentsData as any[]).filter(
          a => a.is_active === true || a.is_active === null || a.is_active === undefined
        );
        
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

          const targetUnitId = a.unit_id || (a.positions?.unit_id);
          if (targetUnitId && pObj) {
            const uKey = String(targetUnitId);
            if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
            if (!unitAssignedPersons[uKey].some(p => String(p.id) === String(pObj.id))) {
              unitAssignedPersons[uKey].push(pObj as Person);
            }
          }
        });
        setActiveAssignmentsMap(assignMap);
        setUnitPersonsMap(unitAssignedPersons);
      }

      if (unitRes.data) {
        setUnits(unitRes.data as Unit[]);
        const built = buildTree(unitRes.data as Unit[]);
        setTree(built);
      }
    } catch (err) {
      console.error('Error in fetchUnits catch block:', err);
    }
  }, [buildTree, statusRefetch]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits, statusRefetch]);

  const selectUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    const exactPositions = allPositions.filter((p) => p.unit_id !== null && p.unit_id !== undefined && String(p.unit_id) === String(unit.id));
    
    exactPositions.sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.id).localeCompare(String(b.id), 'he', { numeric: true });
    });

    const uniquePositionsMap = new Map();
    exactPositions.forEach(pos => uniquePositionsMap.set(String(pos.id), pos));
    setUnitPositions(Array.from(uniquePositionsMap.values()));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredTree = useMemo(() => {
    if (!selectedScopeUnitId) return tree;
    const findNodeInTree = (nodes: UnitNode[]): UnitNode[] => {
      for (const node of nodes) {
        if (String(node.id) === String(selectedScopeUnitId)) return [node];
        if (node.children.length > 0) {
          const res = findNodeInTree(node.children);
          if (res.length > 0) return res;
        }
      }
      return [];
    };
    return findNodeInTree(tree);
  }, [tree, selectedScopeUnitId]);

  const checkQualification = useCallback((position: Position | null, person: Person | null) => {
    if (!position || !person) return true;
    const reqs = positionReqs.filter(r => String(r.position_id) === String(position.id));
    if (reqs.length === 0) return true;

    const personQuals = personQualsMap[String(person.id)] || [];
    const personQualIds = personQualsIdsMap[String(person.id)] || [];
    const personQualsNormalized = personQuals.map(s => String(s).trim().toLowerCase());

    return reqs.every(req => {
      if (req.qualification_id && personQualIds.map(String).includes(String(req.qualification_id))) {
        return true;
      }
      const qName = String(req.qualifications?.name || '').trim().toLowerCase();
      if (!qName) return true;
      return personQualsNormalized.some(pq => pq === qName || pq.includes(qName));
    });
  }, [positionReqs, personQualsMap, personQualsIdsMap]);

  const getUnitBreadcrumb = useCallback((unit: Unit) => {
    const path: string[] = [unit.name];
    let curr = unit;
    while (curr.parent_unit_id) {
      const parent = units.find(u => String(u.id) === String(curr.parent_unit_id));
      if (!parent) break;
      path.unshift(parent.name);
      curr = parent;
    }
    return path.join(' > ');
  }, [units]);

  const selectedUnitStats = useMemo(() => {
    if (!selectedUnit) {
      return {
        totalSubtreePositions: 0,
        totalSubtreePersons: 0,
        filledPositionsCount: 0,
        overStaffedPersonsCount: 0,
        missingPositionsCount: 0,
        unassignedPersonsCount: 0,
        qualified: 0,
        notQualified: 0,
        acting: 0,
      };
    }

    const unitIdsToInclude = new Set<string>([String(selectedUnit.id)]);
    const findSubtree = (currId: string) => {
      units.forEach(u => {
        if (u.parent_unit_id && String(u.parent_unit_id) === String(currId)) {
          unitIdsToInclude.add(String(u.id));
          findSubtree(String(u.id));
        }
      });
    };
    findSubtree(String(selectedUnit.id));

    const subtreePositions = allPositions.filter(
      p => p.unit_id !== null && p.unit_id !== undefined && unitIdsToInclude.has(String(p.unit_id))
    );

    const personsInSubtreeSet = new Set<string>();
    unitIdsToInclude.forEach(uId => {
      const pList = unitPersonsMap[uId] || [];
      pList.forEach(p => personsInSubtreeSet.add(String(p.id)));
    });

    let filledPositionsCount = 0;
    let overStaffedPersonsCount = 0;
    let missingPositionsCount = 0;
    let qualified = 0;
    let notQualified = 0;
    let acting = 0;
    const assignedPersonIdsInSubtree = new Set<string>();

    subtreePositions.forEach(p => {
      const assignedList = activeAssignmentsMap[String(p.id)];
      const personsArr = assignedList ? (Array.isArray(assignedList) ? assignedList : [assignedList]) : [];

      if (personsArr.length > 0) {
        filledPositionsCount++;
        if (personsArr.length > 1) {
          overStaffedPersonsCount += (personsArr.length - 1);
        }
        personsArr.forEach(person => {
          assignedPersonIdsInSubtree.add(String(person.id));
          if (checkQualification(p, person)) qualified++;
          else notQualified++;
          if ((person as any).is_acting || (p as any).is_acting) acting++;
        });
      } else {
        missingPositionsCount++;
      }
    });

    const totalAssignedOrExtra = filledPositionsCount + overStaffedPersonsCount;
    const unassignedPersonsCount = Math.max(0, personsInSubtreeSet.size - totalAssignedOrExtra);

    return {
      totalSubtreePositions: subtreePositions.length,
      totalSubtreePersons: personsInSubtreeSet.size,
      filledPositionsCount,
      overStaffedPersonsCount,
      missingPositionsCount,
      unassignedPersonsCount,
      qualified,
      notQualified,
      acting,
    };
  }, [selectedUnit, units, allPositions, activeAssignmentsMap, unitPersonsMap, checkQualification]);

  const { freeUnassignedPersons, assignedElsewherePersons } = useMemo(() => {
    if (!selectedUnit) return { freeUnassignedPersons: [], assignedElsewherePersons: [] };
    const directPersons = unitPersonsMap[String(selectedUnit.id)] || [];
    const targetUnitIdStr = String(selectedUnit.id);

    const currentUnitPositionIds = new Set(
      allPositions
        .filter(p => p.unit_id !== null && p.unit_id !== undefined && String(p.unit_id) === targetUnitIdStr)
        .map(p => String(p.id))
    );

    const personActiveAssignmentInfo = new Map<string, { positionTitle: string; unitName: string }>();
    Object.entries(activeAssignmentsMap).forEach(([posId, val]) => {
      const personsArr = Array.isArray(val) ? val : [val];
      const targetPosition = allPositions.find(p => String(p.id) === String(posId));
      const targetUnit = targetPosition && targetPosition.unit_id ? units.find(u => String(u.id) === String(targetPosition.unit_id)) : null;

      personsArr.forEach((p) => {
        if (p) {
          personActiveAssignmentInfo.set(String(p.id), {
            positionTitle: targetPosition?.title || 'תקן כללי',
            unitName: targetUnit?.name || 'יחידה אחרת',
          });
        }
      });
    });

    const free: Person[] = [];
    const elsewhere: Array<Person & { assignedInfo?: { positionTitle: string; unitName: string } }> = [];

    directPersons.forEach((p) => {
      const pId = String(p.id);
      let assignedPosId: string | null = null;
      for (const [posId, val] of Object.entries(activeAssignmentsMap)) {
        const arr = Array.isArray(val) ? val : [val];
        if (arr.some(item => item && String(item.id) === pId)) {
          assignedPosId = String(posId);
          break;
        }
      }

      if (assignedPosId) {
        if (currentUnitPositionIds.has(assignedPosId)) return;
        else elsewhere.push({ ...p, assignedInfo: personActiveAssignmentInfo.get(pId) });
      } else {
        free.push(p);
      }
    });

    return { freeUnassignedPersons: free, assignedElsewherePersons: elsewhere };
  }, [selectedUnit, unitPersonsMap, activeAssignmentsMap, allPositions, units]);
  
  const renderNode = (node: UnitNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedUnit?.id === node.id;
    const Icon = ICON_BY_TYPE[node.unit_type] || Building2;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1.5 py-2 pr-2 pl-3 rounded-lg cursor-pointer ${
            isSelected ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-slate-100 text-slate-700'
          }`}
          style={{ paddingRight: `${depth * 20 + 8}px` }}
          onClick={() => {
            selectUnit(node);
            if (hasChildren) toggleExpand(node.id);
          }}
        >
          {hasChildren ? (
            <span className="p-0.5 text-slate-500">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </span>
          ) : (
            <span className="w-5" />
          )}
          <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="text-sm flex-1 truncate">{node.name}</span>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center justify-between gap-3 bg-white border-slate-200">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">עץ ארגוני ומערך יחידות</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAddBrigadeModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>הקם חטיבה חדשה</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[650px]">
        <div className="lg:w-1/2 xl:w-2/5 flex flex-col">
          <div className="card flex flex-col h-[650px] overflow-hidden bg-white border-slate-200">
            <div className="px-4 py-3 border-b border-slate-200 text-sm font-bold text-slate-800 flex items-center gap-2">
              <Network className="w-4 h-4 text-blue-600" />
              <span>היררכיית יחידות</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTree.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">אין יחידות להצגה במסגרת הנבחרת...</div>
              ) : (
                filteredTree.map((node) => renderNode(node))
              )}
            </div>
          </div>
        </div>

        <div className="lg:w-1/2 xl:w-3/5">
          {!selectedUnit ? (
            <div className="card flex items-center justify-center h-[650px] text-slate-500 text-sm bg-white border-slate-200">
              בחרו יחידה מהעץ כדי לצפות בפרטים
            </div>
          ) : (
            <div className="card p-5 space-y-4 bg-white border-slate-200">
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900">{selectedUnit.name}</h3>
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium">
                        {selectedUnit.unit_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{getUnitBreadcrumb(selectedUnit)}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditUnitModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs rounded-lg border border-slate-300 transition-colors cursor-pointer font-medium"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>ערוך</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddSubUnitModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>הוסף תת-יחידה</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  <div className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-around">
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
                      <span className="text-xs font-medium text-blue-800 block">
                        סה"כ תקנים במסגרת כולל תתי יחידות
                      </span>
                      <span className="text-2xl font-black text-blue-900 mt-1 block">
                        {selectedUnitStats.totalSubtreePositions}
                      </span>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center mt-2">
                      <span className="text-xs font-medium text-slate-600 block">
                        סה"כ אנשים משויכים במצטבר
                      </span>
                      <span className="text-2xl font-black text-slate-900 mt-1 block">
                        {selectedUnitStats.totalSubtreePersons}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-3">
                    <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">
                        תקנים ביחידה זו - מצטבר כולל תתי יחידות
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-emerald-600 block">{selectedUnitStats.filledPositionsCount}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">תקנים מאוישים</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-purple-600 block">{selectedUnitStats.overStaffedPersonsCount}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">תקינה עודפת</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-rose-600 block">{selectedUnitStats.missingPositionsCount}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">תקנים בחוסר</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-cyan-600 block">{selectedUnitStats.unassignedPersonsCount}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">משויכים - לא מאוישים</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-1.5">
                      <span className="text-xs font-bold text-slate-700 block">
                        כשירות שיבוצים - מצטבר כולל תתי יחידות
                      </span>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-emerald-600 block">{selectedUnitStats.qualified}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">כשירים</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-amber-600 block">{selectedUnitStats.notQualified}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">לא כשירים/חסרי הסמכה</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-base font-bold text-purple-600 block">{selectedUnitStats.acting}</span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">ממלאי מקום</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <h4 className="text-sm font-bold text-slate-800 mb-2">תקנים ביחידה ({unitPositions.length})</h4>
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {unitPositions.map((pos) => {
                    const assignedList = activeAssignmentsMap[String(pos.id)];
                    const personsArr = Array.isArray(assignedList) ? assignedList : (assignedList ? [assignedList] : []);
                    const primaryPerson = personsArr[0];
                    const isQual = checkQualification(pos, primaryPerson);
                    
                    return (
                      <div key={pos.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-sm text-slate-800 block font-medium">{pos.title}</span>
                          {personsArr.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="text-[11px] text-blue-700 font-medium">
                                {personsArr.map(p => getFullName(p)).join(', ')}
                              </span>
                              {personsArr.length > 1 && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded font-medium">
                                  איוש יתר ({personsArr.length})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${personsArr.length > 0 ? (isQual ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200') : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {personsArr.length > 0 ? (isQual ? 'מאויש' : 'לא כשיר') : 'פער'}
                          </span>

                          {canEdit && personsArr.length > 0 && (
                            <button 
                              onClick={() => openQualModal(primaryPerson)} 
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors" 
                              title={`הסמכות עבור ${getFullName(primaryPerson)}`}
                            >
                              <Award className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button 
                            onClick={() => { setAssignModalOpen(pos); }} 
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors" 
                            title="שייך חייל"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(freeUnassignedPersons.length > 0 || assignedElsewherePersons.length > 0) && (
                  <div className="space-y-4 pt-4 mt-4 border-t border-slate-200">
                    {freeUnassignedPersons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>אנשים משויכים ללא תקן - פנויים לשיבוץ ({freeUnassignedPersons.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[250px] overflow-y-auto">
                          {freeUnassignedPersons.map((person) => (
                            <div key={person.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-xs font-semibold text-slate-800 block">{getFullName(person)}</span>
                                <span className="text-[10px] text-slate-500 font-mono">מ.א: {person.personal_id} {person.rank ? `| ${person.rank}` : ''}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {canEdit && (
                                  <button onClick={() => openQualModal(person)} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-all" title="ניהול הסמכות">
                                    <Award className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">פנוי</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {assignedElsewherePersons.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>שייכים ליחידה אך מאוישים במסגרת אחרת ({assignedElsewherePersons.length})</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                          {assignedElsewherePersons.map((person: any) => (
                            <div key={person.id} className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-lg border border-slate-200">
                              <div>
                                <span className="text-xs font-semibold text-slate-800 block">{getFullName(person)}</span>
                                <span className="text-[10px] text-slate-500 font-mono block">מ.א: {person.personal_id} {person.rank ? `| ${person.rank}` : ''}</span>
                                {person.assignedInfo && (
                                  <span className="text-[10px] text-blue-600 mt-0.5 block font-medium">
                                    משובץ ב: {person.assignedInfo.unitName} ({person.assignedInfo.positionTitle})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 h-fit">
                                {canEdit && (
                                  <button onClick={() => openQualModal(person)} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-all" title="ניהול הסמכות">
                                    <Award className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-300 px-2 py-0.5 rounded font-medium">במקום אחר</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editUnitModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
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
                  <option value="BRIGADE">חטיבה - Brigade</option>
                  <option value="BATTALION">גדוד - Battalion</option>
                  <option value="COMPANY">פלוגה - Company</option>
                  <option value="FRAMEWORK">מסגרת - Framework</option>
                  <option value="PLATOON">מחלקה - Platoon</option>
                  <option value="SQUAD">כיתה - SQUAD</option>
                  <option value="HEADQUARTERS">מטה - Headquarters</option>
                  <option value="OTHER">אחר - Other</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium">שמור שינויים</button>
                <button type="button" onClick={() => setEditUnitModalOpen(false)} className="btn-secondary flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addSubUnitModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-blue-600" />
                <span>הוספת תת-יחידה תחת {selectedUnit.name}</span>
              </h3>
              <button onClick={() => setAddSubUnitModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubUnit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">שם תת-היחידה</label>
                <input
                  type="text"
                  value={newSubUnitName}
                  onChange={(e) => setNewSubUnitName(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                  placeholder="לדוגמה: מחלקה 1"
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
                  <option value="COMPANY">פלוגה - Company</option>
                  <option value="FRAMEWORK">מסגרת - Framework</option>
                  <option value="PLATOON">מחלקה - Platoon</option>
                  <option value="SQUAD">כיתה - SQUAD</option>
                  <option value="HEADQUARTERS">מטה - Headquarters</option>
                  <option value="OTHER">אחר - Other</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 text-xs bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-medium">הוסף תת-יחידה</button>
                <button type="button" onClick={() => setAddSubUnitModalOpen(false)} className="btn-secondary flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addBrigadeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>הקמת חטיבה ראשית חדשה</span>
              </h3>
              <button onClick={() => setAddBrigadeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBrigade} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-600 mb-1">שם החטיבה</label>
                <input
                  type="text"
                  value={newBrigadeName}
                  onChange={(e) => setNewBrigadeName(e.target.value)}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-lg border border-slate-300 outline-none"
                  placeholder="לדוגמה: חטיבה 7"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium">הקם חטיבה</button>
                <button type="button" onClick={() => setAddBrigadeModalOpen(false)} className="btn-secondary flex-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium">ביטול</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalOpen && (
        <AssignmentModal
          open={!!assignModalOpen}
          onClose={() => setAssignModalOpen(null)}
          position={assignModalOpen}
          unitId={selectedUnit ? String(selectedUnit.id) : undefined}
          onSaved={() => {
            setAssignModalOpen(null);
            setStatusRefetch(n => n + 1);
          }}
        />
      )}

      {qualModalOpen && (
        <QualificationsModal
          open={qualModalOpen}
          onClose={() => setQualModalOpen(false)}
          person={qualPerson}
          onChanged={fetchUnits}
        />
      )}
    </div>
  );
}
