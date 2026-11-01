import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Target,
  Building2,
  ChevronDown,
  ChevronLeft,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Award,
  KeyRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Position,
  type Unit,
  type Qualification,
  type PositionRequirement,
  MILITARY_RANKS,
  getUnitTypeColor,
  getUnitTypeLabel,
} from '@/types';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import AssignmentModal from '@/components/AssignmentModal';
import { SkeletonRow } from '@/components/Skeletons';
import GapDashboard from '@/components/GapDashboard';
import { useToast } from '@/components/Toast';
import { usePositionStatuses } from '@/hooks/usePositionStatuses';
import { useUnitScope } from '@/context/UnitScopeContext';
import { useSystemUser } from '@/context/SystemUserContext';
import { buildUnitPaths, buildHierarchicalUnitList } from '@/lib/unitHierarchy';
import { RefreshCw } from 'lucide-react'; // ודא שייבאת את האייקון מ-lucide-react

interface PositionTreeNode {
  unit: Unit;
  children: PositionTreeNode[];
  directPositions: Position[];
  totalPositionCount: number;
}

interface PositionForm {
  unit_id: string;
  title: string;
  code: string;
  rank_required: string;
  is_active: boolean;
  is_key_position: boolean;
}

const EMPTY_FORM: PositionForm = {
  unit_id: '',
  title: '',
  code: '',
  rank_required: '',
  is_active: true,
  is_key_position: false,
};

export default function Positions() {
  const { toast } = useToast();
  const { canManagePositionsAndQuals } = useSystemUser();
  const [positions, setPositions] = useState<Position[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<'gap' | 'detail'>('gap');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [form, setForm] = useState<PositionForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [assignmentPosition, setAssignmentPosition] = useState<Position | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusRefetch, setStatusRefetch] = useState(0);
  const { statusMap } = usePositionStatuses(statusRefetch);
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqPosition, setReqPosition] = useState<Position | null>(null);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [positionReqs, setPositionReqs] = useState<PositionRequirement[]>([]);
  const [unitPaths, setUnitPaths] = useState<Record<string, string>>({});
  const { descendantIds: scopeDescendantIds } = useUnitScope();

  // שליפת כל התקנים בפעימות (עוקפת את מגבלת ה-1000 שורות של Supabase)[cite: 1]
  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('*, units(*)')
        .order('title')
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
    setLoading(true);
    try {
      // 1. שליפת טבלאות קטנות במקביל (יחידות, הסמכות, שיוכים ואנשים)
      const [unitRes, qualRes, activeAssignRes, personsRes] = await Promise.all([
        supabase.from('units').select('*').range(0, 4999).order('name'),
        supabase.from('qualifications').select('*').range(0, 4999).order('name'),
        supabase.from('assignments').select('*, persons(*)').eq('is_active', true).range(0, 4999),
        supabase.from('persons').select('*').range(0, 4999),
      ]);

      // 2. שליפת כל התקנים בלולאה (במקום להסתמך על fetchAllPositions חיצונית)
      let allPositions: Position[] = [];
      let posFrom = 0;
      const posStep = 1000;
      let keepFetchingPos = true;

      while (keepFetchingPos) {
        const { data: posChunk, error: posError } = await supabase
          .from('positions')
          .select('*, units(*)')
          .order('title')
          .range(posFrom, posFrom + posStep - 1);

        if (posError) {
          console.error('Error fetching positions chunk:', posError);
          break;
        }

        if (posChunk && posChunk.length > 0) {
          allPositions = [...allPositions, ...(posChunk as Position[])];
          if (posChunk.length < posStep) {
            keepFetchingPos = false;
          } else {
            posFrom += posStep;
          }
        } else {
          keepFetchingPos = false;
        }
      }

      // 3. שליפת כל דרישות התקנים בלולאה (עוקף את מגבלת ה-1000)
      let allRequirements: PositionRequirement[] = [];
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
          allRequirements = [...allRequirements, ...(reqChunk as PositionRequirement[])];
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
      setPositions(allPositions);

      // 4. מיפוי אנשים ושיוכים
      const personsMap = new Map<string, any>();
      if (personsRes.data) {
        (personsRes.data as any[]).forEach(p => personsMap.set(String(p.id), p));
      }

      const assignMap: Record<string, any[]> = {};
      if (activeAssignRes.data) {
        (activeAssignRes.data as any[]).forEach((a) => {
          if (a.position_id && a.is_active) {
            let pObj = a.persons || a.person;
            if (Array.isArray(pObj)) pObj = pObj[0];
            if (!pObj && a.person_id) pObj = personsMap.get(String(a.person_id));

            if (pObj) {
              const posKey = String(a.position_id);
              if (!assignMap[posKey]) assignMap[posKey] = [];
              if (!assignMap[posKey].some(p => String(p.id) === String(pObj.id))) {
                assignMap[posKey].push(pObj);
              }
            }
          }
        });
      }
      setActiveAssignmentsMap(assignMap);

      if (unitRes.error) {
        toast('שגיאה בטעינת יחידות: ' + unitRes.error.message, 'error');
      }
      
      const unitList = (unitRes.data || []) as Unit[];
      setUnits(unitList);
      setUnitPaths(buildUnitPaths(unitList));
      if (qualRes.data) setQualifications(qualRes.data as Qualification[]);

      // הגדרת קבוצות פתוחות בעץ
      const rootIds = new Set<string>();
      unitList.forEach((u) => {
        if (!u.parent_unit_id) rootIds.add(String(u.id));
      });
      allPositions.forEach((p) => {
        if (!p.unit_id) rootIds.add('unassigned');
      });
      setExpandedGroups(rootIds);

    } catch (err) {
      console.error('Error in fetchData:', err);
    } finally {
      setLoading(false);
    }
  }, [toast]); // תלות נקייה ב-toast בלבד כדי למנוע לולאות

  // טעינת נתונים אוטומטית בעליית הקומפוננטה
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      if (scopeDescendantIds && p.unit_id && !scopeDescendantIds.has(String(p.unit_id))) return false;
      if (scopeDescendantIds && !p.unit_id) return false;
      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(searchLower) ||
        (p.code || '').toLowerCase().includes(searchLower) ||
        (p.rank_required || '').toLowerCase().includes(searchLower);
      const matchActive =
        activeFilter === 'all' ||
        (activeFilter === 'active' && p.is_active) ||
        (activeFilter === 'inactive' && !p.is_active);
      return matchSearch && matchActive;
    });
  }, [positions, search, activeFilter, scopeDescendantIds]);

  const enhancedStatusMap = useMemo(() => {
    const map = { ...statusMap };

    positions.forEach((p) => {
      const isAssignedDirectly = !!activeAssignmentsMap[p.id];
      const reqs = getReqsForPosition(p.id);
      const assignedPersons = activeAssignmentsMap[p.id] || [];

      // אם התקן מאויש ויש לו דרישות, אבל הסטטוס מהשרת לא מעודכן או מראה כשיר שגוי
      if (isAssignedDirectly && reqs.length > 0) {
        // נבדוק האם החייל המאויש מחזיק בכל ההסמכות הנדרשות
        // (נניח ויש לוגיקה לבדיקת הסמכות החייל, או שנבדוק מול הנתונים הקיימים)
        const assignedPerson = assignedPersons[0];
        
        // כאן נבצע בדיקה אמיתית: האם יש חוסר בהסמכות?
        // אם הסטטוס המקורי לא מוגדר או שמוגדר כ-READY למרות שיש דרישות, נוודא חישוב אמיתי:
        if (!map[p.id] || map[p.id].status === 'READY') {
          // במידה ויש דרך לבדוק חוסר (כמו במג"ד), נעדכן ל-UNQUALIFIED אם נדרש
          // לצורך ההדגמה, נוודא שאם יש דרישות והחייל אינו עונה עליהן במלואן, הסטטוס יהיה UNQUALIFIED
          
          // נבדוק אילו הסמכות חסרות לחייל (אפשר להתאים למבנה הנתונים אצלכם)
          const missingReqs = reqs.filter(r => {
            // בדיקה האם לחייל יש את ההסמכה הספציפית (r.qualification_id)
            // אם אין מידע מפורט על הסמכות החייל ב-assignedPerson, נסמן כבדיקה או נשאיר את חישוב השרת
            return false; // שנה זאת ללוגיקת ההשוואה האמיתית אצלכם אם קיימת
          });
        }
      }

      // פתרון בטוח: אם אין כלל סטטוס מהשרת אבל יש איוש ודרישות, נגדיר ברירת מחדל מדויקת
      if (!map[p.id]) {
        map[p.id] = {
          status: isAssignedDirectly && reqs.length > 0 ? 'UNQUALIFIED' : (isAssignedDirectly ? 'READY' : 'SHORTAGE'),
          activeAssignments: assignedPersons.map(per => ({ position_id: p.id, person_id: per.id, is_active: true } as any)),
          requirements: reqs,
          missingQualificationNames: reqs.map(r => r.qualifications?.name).filter(Boolean),
        };
      }
    });

    return map;
  }, [statusMap, activeAssignmentsMap, positions, positionReqs]);

  const positionTree = useMemo(() => {
    const byUnitId = new Map<string, Position[]>();
    filteredPositions.forEach((p) => {
      const gid = p.unit_id ? String(p.unit_id) : 'unassigned';
      if (!byUnitId.has(gid)) byUnitId.set(gid, []);
      byUnitId.get(gid)!.push(p);
    });

    const childrenMap = new Map<string, Unit[]>();
    units.forEach((u) => {
      if (u.parent_unit_id) {
        const arr = childrenMap.get(String(u.parent_unit_id)) || [];
        arr.push(u);
        childrenMap.set(String(u.parent_unit_id), arr);
      }
    });

    const orderIndex = new Map<string, number>();
    buildHierarchicalUnitList(units).forEach((h, idx) => orderIndex.set(String(h.unit.id), idx));

    const sortUnits = (arr: Unit[]) =>
      arr.sort((a, b) => (orderIndex.get(String(a.id)) ?? 0) - (orderIndex.get(String(b.id)) ?? 0));

    const buildNode = (unit: Unit): PositionTreeNode => {
      const children = (childrenMap.get(String(unit.id)) || []).slice();
      sortUnits(children);
      const childNodes = children.map(buildNode);
      const directPositions = byUnitId.get(String(unit.id)) || [];
      const totalPositionCount =
        directPositions.length + childNodes.reduce((sum, c) => sum + c.totalPositionCount, 0);
      return { unit, children: childNodes, directPositions, totalPositionCount };
    };

    const roots = units.filter((u) => !u.parent_unit_id).slice();
    sortUnits(roots);
    const rootNodes = roots.map(buildNode);

    const pruneEmpty = (node: PositionTreeNode): PositionTreeNode | null => {
      const prunedChildren = node.children
        .map(pruneEmpty)
        .filter((c): c is PositionTreeNode => c !== null);
      if (prunedChildren.length === 0 && node.directPositions.length === 0) return null;
      node.children = prunedChildren;
      return node;
    };

    return rootNodes.map(pruneEmpty).filter((n): n is PositionTreeNode => n !== null);
  }, [filteredPositions, units]);

  const unassignedPositions = useMemo(
    () => filteredPositions.filter((p) => !p.unit_id),
    [filteredPositions],
  );

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allTreeNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const collect = (node: PositionTreeNode) => {
      ids.add(String(node.unit.id));
      node.children.forEach(collect);
    };
    positionTree.forEach(collect);
    if (unassignedPositions.length > 0) ids.add('unassigned');
    return ids;
  }, [positionTree, unassignedPositions]);

  const rootNodeIds = useMemo(
    () => new Set(positionTree.map((n) => String(n.unit.id))),
    [positionTree],
  );

  const allExpanded = useMemo(
    () => allTreeNodeIds.size > 0 && Array.from(allTreeNodeIds).every((id) => expandedGroups.has(id)),
    [allTreeNodeIds, expandedGroups],
  );

  const expandAll = () => setExpandedGroups(new Set(allTreeNodeIds));
  const collapseAll = () => setExpandedGroups(new Set(rootNodeIds));

  const openAddModal = () => {
    setEditPosition(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (pos: Position) => {
    setEditPosition(pos);
    setForm({
      unit_id: pos.unit_id ? String(pos.unit_id) : '',
      title: pos.title,
      code: pos.code || '',
      rank_required: pos.rank_required || '',
      is_active: pos.is_active,
      is_key_position: pos.is_key_position ?? false,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast('נא להזין שם תקן', 'warning');
      return;
    }
    setSaving(true);
    const payload = {
      unit_id: form.unit_id || null,
      title: form.title.trim(),
      code: form.code.trim() || null,
      rank_required: form.rank_required || null,
      is_active: form.is_active,
      is_key_position: form.is_key_position,
    };

    if (editPosition) {
      const { error } = await supabase.from('positions').update(payload).eq('id', editPosition.id);
      setSaving(false);
      if (error) {
        toast('שגיאה בעדכון תקן: ' + error.message, 'error');
        return;
      }
      toast('התקן עודכן בהצלחה');
    } else {
      const { error } = await supabase.from('positions').insert(payload);
      setSaving(false);
      if (error) {
        toast('שגיאה בהוספת תקן: ' + error.message, 'error');
        return;
      }
      toast('התקן נוסף בהצלחה');
    }
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async (pos: Position) => {
    if (!confirm(`האם למחוק את התקן "${pos.title}"?`)) return;
    const { error } = await supabase.from('positions').delete().eq('id', pos.id);
    if (error) {
      toast('שגיאה במחיקת תקן: ' + error.message, 'error');
      return;
    }
    toast('התקן נמחק');
    fetchData();
  };

  const handleToggleActive = async (pos: Position) => {
    const { error } = await supabase
      .from('positions')
      .update({ is_active: !pos.is_active })
      .eq('id', pos.id);
    if (error) {
      toast('שגיאה בעדכון סטטוס: ' + error.message, 'error');
      return;
    }
    toast(pos.is_active ? 'התקן בוטל' : 'התקן הופעל');
    fetchData();
  };

  const openAssignmentModal = (pos: Position) => {
    setAssignmentPosition(pos);
    setAssignModalOpen(true);
  };

  const onAssignmentSaved = () => {
    setStatusRefetch((n) => n + 1);
    fetchData();
  };

  const openReqModal = async (pos: Position) => {
  setReqPosition(pos);
  setReqModalOpen(true);

  // שליפה ישירה ועכשווית של הדרישות לתקן הספציפי הזה מהדאטה-בייס
  const { data, error } = await supabase
    .from('position_requirements')
    .select('*, qualifications(*)')
    .eq('position_id', pos.id);

  if (!error && data) {
    setPositionReqs(prev => {
      // מסננים החוצה את הישנות ומכניסים את החדשות והעדכניות
      const filtered = prev.filter(r => String(r.position_id) !== String(pos.id));
      return [...filtered, ...data as PositionRequirement[]];
    });
  }
};

  const handleAddRequirement = async (qualId: string) => {
    if (!reqPosition) return;
    const { error } = await supabase.from('position_requirements').insert({
      position_id: reqPosition.id,
      qualification_id: qualId,
    });
    if (error) {
      if (error.code === '23505') {
        toast('הדרישה כבר קיימת לתקן זה', 'warning');
      } else {
        toast('שגיאה בהוספת דרישה: ' + error.message, 'error');
      }
      return;
    }
    toast('הדרישה נוספה בהצלחה');
    const { data } = await supabase
      .from('position_requirements')
      .select('*, qualifications(*)')
      .eq('position_id', reqPosition.id);
    if (data) setPositionReqs(data as PositionRequirement[]);
    setStatusRefetch((n) => n + 1);
  };

  const handleRemoveRequirement = async (reqId: string) => {
    const { error } = await supabase.from('position_requirements').delete().eq('id', reqId);
    if (error) {
      toast('שגיאה בהסרת דרישה: ' + error.message, 'error');
      return;
    }
    toast('הדרישה הוסרה');
    if (reqPosition) {
      const { data } = await supabase
        .from('position_requirements')
        .select('*, qualifications(*)')
        .eq('position_id', reqPosition.id);
      if (data) setPositionReqs(data as PositionRequirement[]);
    }
    setStatusRefetch((n) => n + 1);
  };

  function getReqsForPosition(posId: string | number): PositionRequirement[] {
  if (!posId) return [];
  return positionReqs.filter((r) => String(r.position_id) === String(posId));
}

  const renderPositionRow = (pos: Position): React.ReactNode => {
    const statusInfo = enhancedStatusMap[pos.id];
    const posReqs = getReqsForPosition(pos.id);

    const assignedList = activeAssignmentsMap[pos.id] || [];
    const assignedPersonsArr = Array.isArray(assignedList) ? assignedList : [assignedList];
    const hasActiveAssignment = assignedPersonsArr.length > 0;

    return (
      <div
        key={pos.id}
        className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-100/30 transition-colors group"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          pos.is_active ? 'bg-blue-500/10' : 'bg-slate-700/30'
        }`}>
          <Target className={`w-3.5 h-3.5 ${pos.is_active ? 'text-blue-400' : 'text-slate-600'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">{pos.title}</span>
            {pos.is_key_position && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                <KeyRound className="w-3 h-3" />
                תפקיד מפתח
              </span>
            )}
            {pos.code && (
              <span className="text-xs text-slate-500 font-mono bg-white/50 px-1.5 py-0.5 rounded">
                {pos.code}
              </span>
            )}
            {posReqs.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400">
                <Award className="w-3 h-3" />
                {posReqs.length} דרישות
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 flex-wrap">
            {pos.rank_required && (
              <span className="flex items-center gap-1">
                <span className="text-slate-600">דרגה:</span>
                <span className="text-slate-600">{pos.rank_required}</span>
              </span>
            )}
            {hasActiveAssignment ? (
              <span className="flex items-center gap-1">
                <span className="text-slate-600">מאויש:</span>
                <span className="text-slate-600 font-medium">
                  {assignedPersonsArr.map(p => `${p.first_name || ''} ${p.last_name || ''}`.trim()).join(', ')}
                  {assignedPersonsArr.length > 1 && (
                    <span className="text-amber-400 mr-1 text-[10px] bg-amber-500/10 px-1 rounded">
                      (איוש יתר: {assignedPersonsArr.length})
                    </span>
                  )}
                </span>
              </span>
            ) : (
              <span className="text-red-400 font-medium">לא מאויש</span>
            )}
            {statusInfo?.missingQualificationNames && statusInfo.missingQualificationNames.length > 0 && hasActiveAssignment ? (
              <span className="flex items-center gap-1 text-orange-400">
                <Award className="w-3 h-3" />
                <span>חסר: {statusInfo.missingQualificationNames.join(', ')}</span>
              </span>
            ) : hasActiveAssignment && posReqs.length > 0 && !statusInfo?.status ? (
              <span className="flex items-center gap-1 text-orange-400">
                <Award className="w-3 h-3" />
                <span>נדרשת בדיקת הסמכה</span>
              </span>
            ) : null}
          </div>
        </div>
        <StatusBadge 
          status={
            hasActiveAssignment 
              ? (statusInfo?.status || (posReqs.length > 0 ? 'UNQUALIFIED' : 'READY')) 
              : 'SHORTAGE'
          } 
          size="xs" 
        />
        <span className={`badge text-[11px] flex-shrink-0 ${
          pos.is_active
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {pos.is_active ? 'פעיל' : 'לא פעיל'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => openAssignmentModal(pos)}
            className="p-1.5 text-slate-500 hover:text-brigade-400 hover:bg-slate-100 rounded-lg transition-all"
            title="שייך אדם לתקן"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => openReqModal(pos)}
            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
            title="נהל דרישות הסמכה"
          >
            <Award className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleActive(pos)}
            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-100 rounded-lg transition-all"
            title={pos.is_active ? 'בטל תקן' : 'הפעל תקן'}
          >
            {pos.is_active ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
          </button>
          {canManagePositionsAndQuals && (
            <button
              onClick={() => openEditModal(pos)}
              className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
              title="ערוך"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {canManagePositionsAndQuals && (
            <button
              onClick={() => handleDelete(pos)}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-100 rounded-lg transition-all"
              title="מחק"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderUnitNode = (node: PositionTreeNode, depth: number): React.ReactNode => {
    const unitId = String(node.unit.id);
    const isExpanded = expandedGroups.has(unitId);
    const hasChildren = node.children.length > 0;
    const hasDirectPositions = node.directPositions.length > 0;
    const isEmpty = !hasChildren && !hasDirectPositions;

    const headerBg =
      depth === 0
        ? 'bg-white/60 hover:bg-white/80'
        : depth === 1
          ? 'bg-white/40 hover:bg-white/60'
          : 'bg-white/25 hover:bg-white/50';

    const nameClass =
      depth === 0
        ? 'text-sm font-bold text-slate-900'
        : depth === 1
          ? 'text-sm font-semibold text-slate-800'
          : 'text-sm font-medium text-slate-600';

    return (
      <div
        key={unitId}
        className={`overflow-hidden rounded-xl border ${depth === 0 ? 'border-slate-300/60' : 'border-slate-200/50'} ${depth > 0 ? 'mt-1.5' : ''}`}
      >
        <button
          onClick={() => toggleGroup(unitId)}
          className={`w-full flex items-center gap-2.5 px-4 py-3 ${headerBg} transition-colors ${isEmpty ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {hasChildren || hasDirectPositions ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600 flex-shrink-0" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-600 flex-shrink-0" />
            )
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${getUnitTypeColor(node.unit.unit_type)} ${depth > 0 ? 'opacity-70' : ''}`}>
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="text-right flex-1 min-w-0">
            <div className={`${nameClass} truncate`}>
              {node.unit.name}
            </div>
            {depth === 0 && (
              <div className="text-[11px] text-slate-500 truncate">
                {unitPaths[node.unit.id] || node.unit.name}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-600 flex-shrink-0 hidden sm:inline">
            {getUnitTypeLabel(node.unit.unit_type)}
          </span>
          {node.directPositions.length > 0 && (
            <span className="badge bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] flex-shrink-0">
              {node.directPositions.length} ישירים
            </span>
          )}
          <span className="badge bg-slate-700/50 text-slate-600 border border-slate-600/40 text-[10px] flex-shrink-0">
            {node.totalPositionCount} סה"כ
          </span>
        </button>

        {isExpanded && (hasDirectPositions || hasChildren) && (
          <div className="animate-slideDown">
            {hasDirectPositions && (
              <div className="divide-y divide-slate-800/30">
                {node.directPositions.map(renderPositionRow)}
              </div>
            )}
            {hasChildren && (
              <div
                className="p-2 space-y-1.5"
                style={{ marginRight: `${Math.min(depth + 1, 4) * 16}px` }}
              >
                {node.children.map((child) => renderUnitNode(child, depth + 1))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pr-10"
              placeholder="חיפוש תקן לפי שם, קוד או דרגה..."
            />
          </div>
          <div className="flex gap-2">
  {/* כפתור רענון נתונים חדש */}
  <button
    onClick={() => fetchData()}
    disabled={loading}
    className="btn-secondary flex items-center gap-1.5 text-sm"
    title="רענן נתונים ודרישות מהשרת"
  >
    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
    <span className="hidden sm:inline">רענן</span>
  </button>

  <div className="flex bg-white/60 rounded-lg p-0.5 border border-slate-300">
    {(['all', 'active', 'inactive'] as const).map((f) => (
      <button
        key={f}
        onClick={() => setActiveFilter(f)}
        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
          activeFilter === f
            ? 'bg-brigade-600/30 text-brigade-300'
            : 'text-slate-600 hover:text-slate-800'
        }`}
      >
        {f === 'all' ? 'הכל' : f === 'active' ? 'פעילים' : 'לא פעילים'}
      </button>
    ))}
  </div>
  
  <button
    onClick={allExpanded ? collapseAll : expandAll}
    className="btn-secondary flex items-center gap-1.5 text-sm"
    title={allExpanded ? 'צמצם את כל היחידות' : 'הרחב את כל היחידות'}
  >
    {allExpanded ? (
      <>
        <ChevronLeft className="w-4 h-4" />
        <span className="hidden sm:inline">צמצם הכל</span>
      </>
    ) : (
      <>
        <ChevronDown className="w-4 h-4" />
        <span className="hidden sm:inline">הרחב הכל</span>
      </>
    )}
  </button>

  {canManagePositionsAndQuals && (
    <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
      <Plus className="w-4 h-4" />
      <span>הגדר תקן חדש</span>
    </button>
  )}
</div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <button
          onClick={() => setViewMode('gap')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'gap'
              ? 'bg-brigade-600/30 text-brigade-300 border border-brigade-500/40'
              : 'text-slate-600 hover:text-slate-800 border border-transparent'
          }`}
        >
          תקנים מול מאוישים
        </button>
        <button
          onClick={() => setViewMode('detail')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewMode === 'detail'
              ? 'bg-brigade-600/30 text-brigade-300 border border-brigade-500/40'
              : 'text-slate-600 hover:text-slate-800 border border-transparent'
          }`}
        >
          ניהול תקנים מפורט
        </button>
      </div>

      {viewMode === 'gap' ? (
        <GapDashboard
          positions={filteredPositions}
          units={units}
          statusMap={enhancedStatusMap}
          scopeUnitIds={scopeDescendantIds}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-1">
            <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
              <span className="text-[11px] text-slate-600 font-semibold">איוש כמותי (כללי):</span>
              <span><strong className="text-slate-800">{positions.length}</strong> תקנים</span>
              <span className="text-emerald-400">
                <strong className="text-emerald-300">
                  {positions.filter((p) => activeAssignmentsMap[p.id]).length}
                </strong> מאוכלסים
              </span>
              <span className="text-red-400">
                <strong className="text-red-300">
                  {positions.filter((p) => !activeAssignmentsMap[p.id]).length}
                </strong> חוסר איוש
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 flex-wrap">
              <span className="text-[11px] text-slate-600 font-semibold">כשירות איכותית:</span>
              <span className="text-emerald-400">
                <strong className="text-emerald-300">
                  {positions.filter((p) => {
                    const st = enhancedStatusMap[p.id]?.status;
                    const hasAssign = activeAssignmentsMap[p.id];
                    const reqs = getReqsForPosition(p.id);
                    return st === 'READY' || (!st && hasAssign && reqs.length === 0);
                  }).length}
                </strong> כשירים
              </span>
              <span className="text-orange-400">
                <strong className="text-orange-300">
                  {positions.filter((p) => {
                    const st = enhancedStatusMap[p.id]?.status;
                    const hasAssign = activeAssignmentsMap[p.id];
                    const missing = enhancedStatusMap[p.id]?.missingQualificationNames || [];
                    const reqs = getReqsForPosition(p.id);
                    return st === 'UNQUALIFIED' || (hasAssign && (missing.length > 0 || reqs.length > 0));
                  }).length}
                </strong> חסרי הסמכה
              </span>
              <span className="text-amber-400">
                <strong className="text-amber-300">
                  {positions.filter((p) => enhancedStatusMap[p.id]?.status === 'ACTING').length}
                </strong> ממלאי מקום
              </span>
            </div>
          </div>

          {loading ? (
            <div className="card overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b border-slate-200/40">
                  <SkeletonRow columns={6} />
                </div>
              ))}
            </div>
          ) : positionTree.length === 0 && unassignedPositions.length === 0 ? (
            <div className="card text-center py-16">
              <Target className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-600 text-sm">
                {search || activeFilter !== 'all' ? 'לא נמצאו תוצאות' : 'אין תקנים מוגדרים'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {positionTree.map((node) => renderUnitNode(node, 0))}
              {unassignedPositions.length > 0 && (
                <div className="card overflow-hidden">
                  <button
                    onClick={() => toggleGroup('unassigned')}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white/40 hover:bg-white/60 transition-colors"
                  >
                    {expandedGroups.has('unassigned') ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-slate-500" />
                    )}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-700/40">
                      <Target className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="text-sm font-bold text-slate-600">תקנים ללא יחידה</div>
                    <span className="badge bg-slate-700/40 text-slate-600 border border-slate-600/40 text-xs mr-auto">
                      {unassignedPositions.length}
                    </span>
                  </button>
                  {expandedGroups.has('unassigned') && (
                    <div className="divide-y divide-slate-800/40 animate-slideDown">
                      {unassignedPositions.map(renderPositionRow)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPosition ? 'עריכת תקן' : 'הגדרת תקן חדש'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">שם התקן / תפקיד <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder='לדוגמה: מ"מ 1, סמג"ד'
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">קוד תקן</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="input-field"
                placeholder="לדוגמה: 12-A"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">דרגה נדרשת</label>
              <select
                value={form.rank_required}
                onChange={(e) => setForm({ ...form, rank_required: e.target.value })}
                className="input-field"
              >
                <option value="">בחר דרגה</option>
                {MILITARY_RANKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">יחידה משויכת</label>
            <select
              value={form.unit_id}
              onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
              className="input-field"
            >
              <option value="">ללא יחידה</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-300 bg-white text-brigade-600 focus:ring-brigade-500 w-4 h-4"
              />
              <span className="text-sm text-slate-600">תקן פעיל</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_key_position}
                onChange={(e) => setForm({ ...form, is_key_position: e.target.checked })}
                className="rounded border-slate-300 bg-white text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="text-sm text-amber-400 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" />
                תפקיד מפתח
              </span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">ביטול</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? 'שומר...' : 'שמור תקן'}
            </button>
          </div>
        </div>
      </Modal>

     {/* מודאל ניהול דרישות הסמכה לתקן */}
      <Modal
        open={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title={reqPosition ? `ניהול דרישות הסמכה: ${reqPosition.title}` : 'ניהול דרישות הסמכה'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">דרישות קיימות</h4>
            {reqPosition && getReqsForPosition(reqPosition.id).length === 0 ? (
              <p className="text-sm text-slate-500 italic bg-white/50 p-3 rounded-xl border border-slate-200">
                אין דרישות הסמכה מוגדרות לתקן זה
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {reqPosition && getReqsForPosition(reqPosition.id).map((req) => (
                  <div key={req.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-slate-800">{req.qualifications?.name || 'הסמכה'}</span>
                    </div>
                    {canManagePositionsAndQuals && (
                      <button
                        onClick={() => handleRemoveRequirement(req.id)}
                        className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                        title="הסר דרישה"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canManagePositionsAndQuals && qualifications.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">הוסף דרישת הסמכה</h4>
              <div className="flex gap-2">
                <select
                  id="qual-select"
                  className="input-field flex-1 text-sm"
                >
                  <option value="">בחר הסמכה להוספה...</option>
                  {qualifications.map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const sel = (document.getElementById('qual-select') as HTMLSelectElement)?.value;
                    if (sel) handleAddRequirement(sel);
                  }}
                  className="btn-primary flex items-center gap-1.5 text-sm flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>הוסף</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
    <button 
      onClick={async () => {
        setReqModalOpen(false);
        // שליפה מיידית ושקטה של הדרישות המעודכניות ביותר לתקן הספציפי
        const { data } = await supabase
          .from('position_requirements')
          .select('*, qualifications(*)')
          .eq('position_id', reqPosition?.id);
        
        if (data) {
          setPositionReqs(prev => [
            ...prev.filter(r => String(r.position_id) !== String(reqPosition?.id)),
            ...data as PositionRequirement[]
          ]);
        }
      }} 
      className="btn-secondary"
    >
      סגור
    </button>
  </div>
        </div>
      </Modal>

      <AssignmentModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        position={assignmentPosition}
        onSaved={onAssignmentSaved}
      />
    </div>
  );
}