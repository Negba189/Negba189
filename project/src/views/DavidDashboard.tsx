import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ChevronRight,
  Building2,
  Settings,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Bookmark,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type Position,
  type Assignment,
  type Qualification,
  type PositionRequirement,
  type PersonQualification,
} from '@/types';
import AssignmentModal from '@/components/AssignmentModal';
import { useToast } from '@/components/Toast';
import { useUnitScope } from '@/context/UnitScopeContext';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

interface DavidMetrics {
  totalPositions: number;
  assignedCount: number;
  readyCount: number;
  unqualifiedCount: number;
  shortageCount: number;
  overstaffedCount: number;
  actingCount: number;
  manningRate: number;    // % איוש (כעת מוגדר כ- אחוז הכשירים מתוך התקינה)
  readinessRate: number; // % כשירות (כעת מוגדר כ- אחוז הכשירים מתוך המאוישים)
}

interface DavidPositionDetail {
  position: Position;
  status: string;
  assignment: Assignment | null;
  personQuals: Qualification[];
}

type SubCategory = 'נשק בבית' | 'חיבור לנץ' | 'רכב נצ"מ';

export default function DavidDashboard() {
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeSubCategory, setActiveSubCategory] = useState<SubCategory>('נשק בבית');

  const [greenThreshold, setGreenThreshold] = useState<number>(90);
  const [orangeThreshold, setOrangeThreshold] = useState<number>(75);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const [level1Id, setLevel1Id] = useState<string>('');
  const [level2Id, setLevel2Id] = useState<string>('');
  const [level3Id, setLevel3Id] = useState<string>('');

  const [assignmentPosition, setAssignmentPosition] = useState<Position | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusRefetch, setStatusRefetch] = useState(0);

  const [rawRequirements, setRawRequirements] = useState<PositionRequirement[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);
  const { descendantIds: scopeDescendantIds } = useUnitScope();


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
        .select(`
          id,
          position_id,
          person_id,
          is_active,
          persons (*),
          positions (*)
        `)
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

  const fetchAllRequirements = async () => {
    let allData: PositionRequirement[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('position_requirements').select('*').range(from, from + step - 1);
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
    const [unitRes, qualRes, positionsData, reqData, assignData, personQualData] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('qualifications').select('*').order('name'),
      fetchAllPositions(),
      fetchAllRequirements(),
      fetchAllAssignments(),
      fetchAllPersonQuals(),
    ]);

    if (unitRes.error) {
      toast('שגיאה בטעינת נתוני ייעוד חטיבות דוד', 'error');
      setLoading(false);
      return;
    }

    setUnits((unitRes.data || []) as Unit[]);
    setAllPositions((positionsData || []) as Position[]);
    setQualifications((qualRes.data || []) as Qualification[]);
    setRawRequirements(reqData || []);
    setRawAssignments(assignData || []);
    setRawPersonQuals(personQualData || []);

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, statusRefetch]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  const level1Units = useMemo(() => {
    if (!units || !Array.isArray(units)) return [];
    return units.filter((u) => u && u.parent_unit_id !== null && String(u.parent_unit_id) === '189');
  }, [units]);

  const level2Units = useMemo(() => {
    if (!level1Id || !units || !Array.isArray(units)) return [];
    return units.filter((u) => u && u.parent_unit_id && String(u.parent_unit_id) === String(level1Id));
  }, [units, level1Id]);

  const level3Units = useMemo(() => {
    if (!level2Id || !units || !Array.isArray(units)) return [];
    return units.filter((u) => u && u.parent_unit_id && String(u.parent_unit_id) === String(level2Id));
  }, [units, level2Id]);

  const currentSelectedUnit = useMemo(() => {
    if (!Array.isArray(units)) return null;
    if (level3Id) return units.find((u) => String(u.id) === String(level3Id)) || null;
    if (level2Id) return units.find((u) => String(u.id) === String(level2Id)) || null;
    if (level1Id) return units.find((u) => String(u.id) === String(level1Id)) || null;
    return null;
  }, [units, level1Id, level2Id, level3Id]);

  // כלל התקנים הפעילים ביחידה (מקצה לקצה, בדיוק כמו ב-UnitPositionsSummaryView)
  const davidPositions = useMemo(() => {
    return allPositions.filter((p) => {
      if (scopeDescendantIds && p.unit_id) {
        if (!scopeDescendantIds.has(p.unit_id)) return false;
      }
      return p.is_active && p.unit_id !== null && p.unit_id !== undefined;
    });
  }, [allPositions, scopeDescendantIds]);

  const davidStatusMap = useMemo(() => {
    const assignmentsByPosition = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const arr = assignmentsByPosition.get(a.position_id) || [];
      arr.push(a);
      assignmentsByPosition.set(a.position_id, arr);
    });

    const personQualsByPerson = new Map<string, Set<string>>();
    rawPersonQuals.forEach((pq) => {
      const set = personQualsByPerson.get(pq.person_id) || new Set<string>();
      set.add(pq.qualification_id);
      personQualsByPerson.set(pq.person_id, set);
    });

    const map: Record<string, DavidPositionDetail> = {};

    davidPositions.forEach((pos) => {
      const activeAssignments = assignmentsByPosition.get(pos.id) || [];
      const personQualObjs: Qualification[] = [];

      if (activeAssignments.length === 1) {
        const personId = activeAssignments[0].person_id;
        const pqIds = personQualsByPerson.get(personId);
        if (pqIds) {
          pqIds.forEach((qId) => {
            const q = qualifications.find((qq) => qq.id === qId);
            if (q) personQualObjs.push(q);
          });
        }
      }

      map[pos.id] = {
        position: pos,
        status: activeAssignments.length > 0 ? 'ASSIGNED' : 'SHORTAGE',
        assignment: activeAssignments.length === 1 ? activeAssignments[0] : null,
        personQuals: personQualObjs,
      };
    });

    return map;
  }, [davidPositions, rawAssignments, rawPersonQuals, qualifications]);

  // פונקציית עזר לבדיקה האם להסמכה של החייל יש התאמה לתת-הקטגוריה הנוכחית
  const checkSubCategoryMatch = (qualName: string, subCat: SubCategory) => {
    const name = (qualName || '').toLowerCase().trim();
    const target = subCat.toLowerCase().trim();
    if (name.includes(target) || target.includes(name)) return true;
    
    // התאמות מיוחדות לנצ"מ / נץ
    if (subCat === 'רכב נצ"מ' && (name.includes('נצמ') || name.includes('נצ"מ'))) return true;
    if (subCat === 'חיבור לנץ' && name.includes('נץ')) return true;
    if (subCat === 'נשק בבית' && name.includes('נשק')) return true;
    
    return false;
  };

  const computeUnitMetrics = useCallback(
    (unitId: string): DavidMetrics => {
      const descSet = descendantMaps[unitId] || new Set();
      const unitSet = new Set<string>([String(unitId)]);
      descSet.forEach((id) => unitSet.add(String(id)));

      const relevantPositions = davidPositions.filter(
        (p) => p.unit_id && unitSet.has(String(p.unit_id)),
      );

      let totalPositions = relevantPositions.length; // תקינה מקצה לקצה
      let assignedCount = 0;
      let readyCount = 0;
      let unqualifiedCount = 0;
      let shortageCount = 0;
      let overstaffedCount = 0;
      let actingCount = 0;

      relevantPositions.forEach((p) => {
        const detail = davidStatusMap[p.id];
        const assignment = detail?.assignment;
        
        if (assignment) {
          assignedCount++;
          // בדיקה האם לחייל המשובץ יש את הסטטוס המבוקש תחת תת-הקטגוריה
          const hasStatusQual = detail.personQuals.some((q) => {
            const qName = (q.name || '').toLowerCase();
            return qName.includes(activeSubCategory.toLowerCase());
          });

          if (hasStatusQual) {
            readyCount++; // כשיר (יש לו את הסטטוס)
          } else {
            unqualifiedCount++; // לא כשיר (משובץ אבל אין לו את הסטטוס)
          }
        } else {
          shortageCount++;
        }
      });

      // % איוש = אחוז הכשירים מתוך כלל התקינה
      const manningRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;
      
      // % כשירות = אחוז הכשירים מתוך סה"כ האנשים המאוישים בפועל
      const readinessRate = assignedCount > 0 ? (readyCount / assignedCount) * 100 : 0;

      return {
        totalPositions,
        assignedCount,
        readyCount,
        unqualifiedCount,
        shortageCount,
        overstaffedCount,
        actingCount,
        manningRate,
        readinessRate,
      };
    },
    [davidPositions, davidStatusMap, descendantMaps, activeSubCategory],
  );

  const childUnits = useMemo(() => {
    if (!currentSelectedUnit) return level1Units;
    return units.filter((u) => u.parent_unit_id && String(u.parent_unit_id) === String(currentSelectedUnit.id));
  }, [units, currentSelectedUnit, level1Units]);

  const subFrameworksTableData = useMemo(() => {
    const rows = childUnits.map((unit) => {
      const stats = computeUnitMetrics(String(unit.id));
      return {
        id: unit.id,
        name: unit.name,
        type: unit.unit_type,
        isSelfMete: false,
        ...stats,
      };
    });

    if (currentSelectedUnit) {
      const directPositions = davidPositions.filter(
        (p) => p.unit_id && String(p.unit_id) === String(currentSelectedUnit.id),
      );

      if (directPositions.length > 0) {
        let total = directPositions.length, assigned = 0, ready = 0, unqualified = 0, shortage = 0;
        directPositions.forEach((p) => {
          const detail = davidStatusMap[p.id];
          if (detail?.assignment) {
            assigned++;
            const hasQual = detail.personQuals.some((q) => checkSubCategoryMatch(q.name, activeSubCategory));
            if (hasQual) ready++;
            else unqualified++;
          } else {
            shortage++;
          }
        });
        const manningRate = total > 0 ? (ready / total) * 100 : 0;
        const readinessRate = assigned > 0 ? (ready / assigned) * 100 : 0;

        rows.unshift({
          id: currentSelectedUnit.id + '_HQ',
          name: `מפקדת ${currentSelectedUnit.name}`,
          type: 'HEADQUARTERS',
          isSelfMete: true,
          totalPositions: total,
          assignedCount: assigned,
          readyCount: ready,
          unqualifiedCount: unqualified,
          shortageCount: shortage,
          overstaffedCount: 0,
          actingCount: 0,
          manningRate,
          readinessRate,
        });
      }
    }

    return rows;
  }, [childUnits, currentSelectedUnit, computeUnitMetrics, davidPositions, davidStatusMap, activeSubCategory]);

  const totalSummaryRow = useMemo(() => {
    let totalPositions = 0, assignedCount = 0, readyCount = 0, unqualifiedCount = 0, shortageCount = 0;

    subFrameworksTableData.forEach((r) => {
      totalPositions += r.totalPositions;
      assignedCount += r.assignedCount;
      readyCount += r.readyCount;
      unqualifiedCount += r.unqualifiedCount;
      shortageCount += r.shortageCount;
    });

    const manningRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;
    const readinessRate = assignedCount > 0 ? (readyCount / assignedCount) * 100 : 0;

    return {
      totalPositions,
      assignedCount,
      readyCount,
      unqualifiedCount,
      shortageCount,
      manningRate,
      readinessRate,
    };
  }, [subFrameworksTableData]);

  const criticalDavidGaps = useMemo(() => {
    const unitIdsToInclude = new Set<string>();
    if (currentSelectedUnit) {
      unitIdsToInclude.add(String(currentSelectedUnit.id));
      const descSet = descendantMaps[currentSelectedUnit.id];
      if (descSet) descSet.forEach((id) => unitIdsToInclude.add(String(id)));
    } else {
      units.forEach((u) => unitIdsToInclude.add(String(u.id)));
    }

    const scopedPositions = davidPositions.filter(
      (p) => p.unit_id && unitIdsToInclude.has(String(p.unit_id))
    );

    const gapMap = new Map<string, { positionTitle: string; totalReq: number; readyCount: number; gapCount: number }>();

    scopedPositions.forEach((p) => {
      const key = p.title.trim();
      const detail = davidStatusMap[p.id];
      const hasQual = detail?.assignment && detail.personQuals.some((q) => checkSubCategoryMatch(q.name, activeSubCategory));
      const isShortage = !detail?.assignment;

      let existing = gapMap.get(key);
      if (!existing) {
        existing = {
          positionTitle: p.title,
          totalReq: 0,
          readyCount: 0,
          gapCount: 0,
        };
      }

      existing.totalReq += 1;
      if (hasQual) existing.readyCount += 1;
      if (isShortage || !hasQual) existing.gapCount += 1;

      gapMap.set(key, existing);
    });

    return Array.from(gapMap.values())
      .filter((g) => g.gapCount > 0)
      .sort((a, b) => b.gapCount - a.gapCount)
      .slice(0, 10);
  }, [currentSelectedUnit, descendantMaps, davidPositions, davidStatusMap, units, activeSubCategory]);

  const getReadinessBadgeColor = (rate: number) => {
    if (rate >= greenThreshold) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (rate >= orangeThreshold) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  const handleDrillDown = (frameworkId: string, isSelfMete: boolean) => {
    if (isSelfMete) return;
    if (!level1Id) {
      setLevel1Id(frameworkId);
    } else if (level1Id && !level2Id) {
      setLevel2Id(frameworkId);
    } else if (level2Id && !level3Id) {
      setLevel3Id(frameworkId);
    }
  };

  const handleBreadcrumbClick = (level: number) => {
    if (level === 1) {
      setLevel1Id('');
      setLevel2Id('');
      setLevel3Id('');
    } else if (level === 2) {
      setLevel2Id('');
      setLevel3Id('');
    }
  };

  // כותרות דינמיות לעמודות 3 ו-4 בהתאם לתת-הקטגוריה הנבחרת
  const dynamicColumnTitles = useMemo(() => {
    switch (activeSubCategory) {
      case 'נשק בבית':
        return { ready: 'חתום על נשק', notReady: 'לא חתום' };
      case 'חיבור לנץ':
        return { ready: 'מחובר למערכת הנץ', notReady: 'לא מחובר' };
      case 'רכב נצ"מ':
        return { ready: 'בעל נצ"מ', notReady: 'ללא נצ"מ' };
      default:
        return { ready: 'כשיר', notReady: 'לא כשיר' };
    }
  }, [activeSubCategory]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-slate-500">טוען נתוני ייעוד חטיבות דוד...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* כותרת ראשית */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-300 text-xs font-bold mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>תמונת מצב ייעוד חטיבות דוד | קטגוריה כללי</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">סטטוס תקינה ואיוש לפי ייעודי חטיבות דוד</h1>
          <p className="text-xs text-slate-300 mt-1">
            {currentSelectedUnit ? `נתונים עבור מסגרת: ${currentSelectedUnit.name}` : 'תמונת מצב כלל-מערכתית'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-bold rounded-xl border border-white/15 transition-all cursor-pointer text-blue-100"
          >
            <Settings className="w-4 h-4" />
            <span>הגדרת ספי כשירות</span>
          </button>
        </div>
      </div>

      {/* פאנל תתי קטגוריות */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Bookmark className="w-4 h-4 text-blue-600" />
          <span>בחר תת-קטגוריה לייעוד חטיבות דוד:</span>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {(['נשק בבית', 'חיבור לנץ', 'רכב נצ"מ'] as SubCategory[]).map((subCat) => {
            const isActive = activeSubCategory === subCat;
            return (
              <button
                key={subCat}
                onClick={() => setActiveSubCategory(subCat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{subCat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* סרגל סינון היררכי מסלול (Breadcrumb) */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 overflow-x-auto">
          <span className="text-slate-400">מיקומים:</span>
          <button
            onClick={() => { setLevel1Id(''); setLevel2Id(''); setLevel3Id(''); }}
            className={`hover:underline cursor-pointer ${!level1Id ? 'text-blue-600 font-extrabold' : 'text-slate-600'}`}
          >
            כלל המערכת
          </button>

          {level1Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <button
                onClick={() => handleBreadcrumbClick(1)}
                className={`hover:underline cursor-pointer ${level1Id && !level2Id ? 'text-blue-600 font-extrabold' : 'text-slate-600'}`}
              >
                {units.find((u) => String(u.id) === String(level1Id))?.name || 'רמה 1'}
              </button>
            </>
          )}

          {level2Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <button
                onClick={() => handleBreadcrumbClick(2)}
                className={`hover:underline cursor-pointer ${level2Id && !level3Id ? 'text-blue-600 font-extrabold' : 'text-slate-600'}`}
              >
                {units.find((u) => String(u.id) === String(level2Id))?.name || 'רמה 2'}
              </button>
            </>
          )}

          {level3Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <span className="text-blue-600 font-extrabold">
                {units.find((u) => String(u.id) === String(level3Id))?.name || 'רמה 3'}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={level1Id}
            onChange={(e) => { setLevel1Id(e.target.value); setLevel2Id(''); setLevel3Id(''); }}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">– בחר גדוד / רמה 1 –</option>
            {level1Units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={level2Id}
            onChange={(e) => { setLevel2Id(e.target.value); setLevel3Id(''); }}
            disabled={!level1Id}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– בחר פלוגה / רמה 2 –</option>
            {level2Units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>

          <select
            value={level3Id}
            onChange={(e) => setLevel3Id(e.target.value)}
            disabled={!level2Id}
            className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– בחר מחלקה / רמה 3 –</option>
            {level3Units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* א. טבלת מסגרות מרכזית */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              סטטוס תקינה עבור <span className="text-blue-600">[{activeSubCategory}]</span> במסגרות כפופות – {currentSelectedUnit ? currentSelectedUnit.name : 'כלל החטיבה'}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            לחץ על שורה בטבלה כדי לבצע Drill Down פנימה
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
<tr>
    <th className="p-3.5 pr-5">מסגרת</th>
    <th className="p-3.5 text-center">תקינה</th>
    <th className="p-3.5 text-center">מאויש</th>
    <th className="p-3.5 text-center">{dynamicColumnTitles.ready}</th>      {/* עמודה 3 */}
    <th className="p-3.5 text-center">{dynamicColumnTitles.notReady}</th>   {/* עמודה 4 */}
    <th className="p-3.5 text-center">אחוז למול תקן</th>                    {/* עמודה 5 */}
    <th className="p-3.5 text-center">אחוז למול איוש</th>                   {/* עמודה 6 */}
    <th className="p-3.5 pl-5 text-center">פעולה</th>
  </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {subFrameworksTableData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400">
                    אין מסגרות כפופות להצגה ברמה זו
                  </td>
                </tr>
              ) : (
                subFrameworksTableData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleDrillDown(String(row.id), row.isSelfMete)}
                    className={`hover:bg-slate-50/80 transition-colors ${row.isSelfMete ? 'bg-blue-50/20' : 'cursor-pointer'}`}
                  >
                    <td className="p-3.5 pr-5 font-bold text-slate-900 flex items-center gap-2">
                      <span>{row.name}</span>
                      {row.isSelfMete && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                          מטה היחידה
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center text-slate-800 font-bold">{row.totalPositions}</td>
                    <td className="p-3.5 text-center text-blue-600 font-bold">{row.assignedCount}</td>
                    <td className="p-3.5 text-center text-emerald-600 font-bold">{row.readyCount}</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">{row.unqualifiedCount}</td>
                    <td className="p-3.5 text-center text-slate-700">{row.manningRate.toFixed(0) + '%'}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${getReadinessBadgeColor(row.readinessRate)}`}>
                        {row.readinessRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3.5 pl-5 text-center">
                      {!row.isSelfMete && (
                        <span className="text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center gap-1">
                          צולל <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="p-3.5 pr-5">סה"כ מסגרת</td>
                <td className="p-3.5 text-center">{totalSummaryRow.totalPositions}</td>
                <td className="p-3.5 text-center text-blue-700">{totalSummaryRow.assignedCount}</td>
                <td className="p-3.5 text-center text-emerald-700">{totalSummaryRow.readyCount}</td>
                <td className="p-3.5 text-center text-amber-700">{totalSummaryRow.unqualifiedCount}</td>
                <td className="p-3.5 text-center">{totalSummaryRow.manningRate.toFixed(0) + '%'}</td>
                <td className="p-3.5 text-center">
                  <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${getReadinessBadgeColor(totalSummaryRow.readinessRate)}`}>
                    {totalSummaryRow.readinessRate.toFixed(0)}%
                  </span>
                </td>
                <td className="p-3.5 pl-5 text-center"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ב. גרף השוואת מסגרות */}
      <div className="card p-6 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">השוואת כשירות ותקינה לפי מסגרות [{activeSubCategory}]</h3>
          </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> {dynamicColumnTitles.ready}</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"></span> {dynamicColumnTitles.notReady}</div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {subFrameworksTableData.map((row) => {
  if (row.assignedCount === 0) return null; // אם אין מאוישים כלל

  // חישוב האחוזים מתוך סה"כ המאוישים בלבד
  const readyPct = (row.readyCount / row.assignedCount) * 100;
  const unqualPct = (row.unqualifiedCount / row.assignedCount) * 100;

  return (
    <div key={row.id} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
        <span>{row.name}</span>
        <span className="text-slate-400 font-normal">
          {row.readyCount} מתוך {row.assignedCount} מאוישים ({row.readinessRate.toFixed(0)}% עמידה באיוש)
        </span>
      </div>

      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
        {/* חלק ירוק - בעלי הסטטוס */}
        <div
          style={{ width: `${readyPct}%` }}
          className="bg-emerald-500 transition-all duration-500"
          title={`${dynamicColumnTitles.ready}: ${row.readyCount} (${readyPct.toFixed(1)}%)`}
        />
        {/* חלק צהוב - חסרי הסטטוס */}
        <div
          style={{ width: `${unqualPct}%` }}
          className="bg-amber-400 transition-all duration-500"
          title={`${dynamicColumnTitles.notReady}: ${row.unqualifiedCount} (${unqualPct.toFixed(1)}%)`}
        />
      </div>
    </div>
  );
})}
        </div>
      </div>

      

      {/* מודל הגדרת ספים */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span>הגדרת ספי כשירות במערכת</span>
              </h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  סף כשירות ירוק (🟢 מעל או שווה ל-%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={greenThreshold}
                  onChange={(e) => setGreenThreshold(Number(e.target.value))}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  סף כשירות כתום (🟠 מעל או שווה ל-% ומתחת לירוק)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={orangeThreshold}
                  onChange={(e) => setOrangeThreshold(Number(e.target.value))}
                  className="w-full bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2.5 rounded-xl font-bold transition-colors cursor-pointer"
              >
                שמור הגדרות ספים
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
