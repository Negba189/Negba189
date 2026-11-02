import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  HeartPulse,
  ChevronRight,
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
  Loader2,
  UserPlus,
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Filter,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Unit,
  type UnitType,
  type Position,
  type Person,
  type Assignment,
  type Qualification,
  type PositionRequirement,
  type PersonQualification,
  type PositionStatus,
  getUnitTypeLabel,
  getUnitTypeColor,
  getFullName,
  isMedicalPosition,
  isMedicalQualification,
  calculatePositionStatus,
  getMissingQualificationIds,
} from '@/types';
import StatusBadge from '@/components/StatusBadge';
import AssignmentModal from '@/components/AssignmentModal';
import { useToast } from '@/components/Toast';
import { useUnitScope } from '@/context/UnitScopeContext';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

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

interface MedicalMetrics {
  totalPositions: number;
  assignedCount: number;
  readyCount: number;
  unqualifiedCount: number;
  shortageCount: number;
  overstaffedCount: number;
  actingCount: number;
  manningRate: number;
  readinessRate: number;
}

interface MedicalPositionDetail {
  position: Position;
  status: PositionStatus;
  assignment: Assignment | null;
  missingQualNames: string[];
  requiredQuals: Qualification[];
  personQuals: Qualification[];
}

export default function MedicalDashboard() {
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);

  // ספי כשירות דינמיים
  const [greenThreshold, setGreenThreshold] = useState<number>(90);
  const [orangeThreshold, setOrangeThreshold] = useState<number>(75);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // סינון היררכי (3 רמות)
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

  // שליפת כל התקנים בפעימות (עוקפת את מגבלת ה-1000 שורות)
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

  const fetchAllAssignments = async () => {
    let allData: Assignment[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, persons(*), positions(*)')
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
      toast('שגיאה בטעינת נתונים רפואיים', 'error');
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

  // מפות היררכיה ותתי-יחידות
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
    return level1Units[0] || null;
  }, [units, level1Id, level2Id, level3Id, level1Units]);

  // מפת דרישות לפי תקן כדי לדעת אילו הסמכות מוגדרות לכל תקן
  const reqsByPositionMap = useMemo(() => {
    const map = new Map<string, PositionRequirement[]>();
    rawRequirements.forEach((r) => {
      const arr = map.get(r.position_id) || [];
      arr.push(r);
      map.set(r.position_id, arr);
    });
    return map;
  }, [rawRequirements]);


  // שילוב שתי הגישות: תפקיד רפואי לפי שם OR תקן שיש לו דרישת הסמכה רפואית
  const medicalPositions = useMemo(() => {
    return allPositions.filter((p) => {
      // בדיקה האם המסגרת נמצאת בסקופ הנוכחי (אם יש סקופ פעיל)
      if (scopeDescendantIds && p.unit_id) {
        if (!scopeDescendantIds.has(p.unit_id)) return false;
      }

      // 1. בדיקה לפי שם התקן (תפקידי רפואה מוגדרים כולל נגזרות)
      const title = (p.title || '').toLowerCase();
      const isMedByName = 
        title.includes('רפוא') ||
        title.includes('חובש') ||
        title.includes('רופא') ||
        title.includes('פראמדיק') ||
        title.includes('קרפ') ||     // תופס את קרפ"ח, קרפ"ג, קר"פ וכו'
        title.includes('קב"ן') ||
        title.includes('קא"ר') ||
        title.includes('חוג"ד') ||
        title.includes('ק. רפואה') ||
        title.includes('סמב"ץ רפואה');

      if (isMedByName) return true;

      // 2. בדיקה האם מוגדרת לתקן דרישת הסמכה משויכת לקטגוריה רפואית (משתמש במפה הקיימת במערכת)
      const posReqs = reqsByPositionMap.get(p.id) || [];
      const hasMedicalQualificationReq = posReqs.some((req) => {
        const qual = req.qualifications;
        if (!qual) return false;
        const category = (qual.category || '').toLowerCase();
        const qualName = (qual.name || '').toLowerCase();
        
        // זיהוי האם ההסמכה שייכת לקטגוריה רפואית או מכילה מונחי רפואה
        return (
          category.includes('רפוא') ||
          category.includes('medical') ||
          qualName.includes('חובש') ||
          qualName.includes('רופא') ||
          qualName.includes('קורס רפואה')
        );
      });

      return hasMedicalQualificationReq;
    });
  }, [allPositions, scopeDescendantIds, reqsByPositionMap]);

  // מפת סטטוס לכל תקן רפואי
  const medicalStatusMap = useMemo(() => {
    const assignmentsByPosition = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const arr = assignmentsByPosition.get(a.position_id) || [];
      arr.push(a);
      assignmentsByPosition.set(a.position_id, arr);
    });

    const reqsByPosition = new Map<string, PositionRequirement[]>();
    rawRequirements.forEach((r) => {
      const arr = reqsByPosition.get(r.position_id) || [];
      arr.push(r);
      reqsByPosition.set(r.position_id, arr);
    });

    const personQualsByPerson = new Map<string, Set<string>>();
    rawPersonQuals.forEach((pq) => {
      const set = personQualsByPerson.get(pq.person_id) || new Set<string>();
      set.add(pq.qualification_id);
      personQualsByPerson.set(pq.person_id, set);
    });

    const qualNameMap = new Map<string, string>();
    qualifications.forEach((q) => qualNameMap.set(q.id, q.name));

    const map: Record<string, MedicalPositionDetail> = {};

    medicalPositions.forEach((pos) => {
      const activeAssignments = assignmentsByPosition.get(pos.id) || [];
      const posReqs = reqsByPosition.get(pos.id) || [];
      const requiredQualIds = new Set(posReqs.map((r) => r.qualification_id));

      let personQualIds = new Set<string>();
      if (activeAssignments.length === 1) {
        const personId = activeAssignments[0].person_id;
        personQualIds = personQualsByPerson.get(personId) || new Set<string>();
      }

      const status = calculatePositionStatus(activeAssignments, requiredQualIds, personQualIds);
      const missingIds = getMissingQualificationIds(requiredQualIds, personQualIds);
      const missingQualNames = missingIds
        .map((id) => qualNameMap.get(id))
        .filter((name): name is string => !!name);

      const requiredQuals = posReqs
        .map((r) => r.qualifications)
        .filter((q): q is Qualification => !!q);

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
        status,
        assignment: activeAssignments.length === 1 ? activeAssignments[0] : null,
        missingQualNames,
        requiredQuals,
        personQuals: personQualObjs,
      };
    });

    return map;
  }, [medicalPositions, rawAssignments, rawRequirements, rawPersonQuals, qualifications]);

  // חישוב מדדים למסגרת נתונה
  const computeUnitMetrics = useCallback(
    (unitId: string): MedicalMetrics => {
      const descSet = descendantMaps[unitId] || new Set();
      const unitSet = new Set<string>([String(unitId)]);
      descSet.forEach((id) => unitSet.add(String(id)));

      const relevantPositions = medicalPositions.filter(
        (p) => p.unit_id && unitSet.has(String(p.unit_id)),
      );

      let totalPositions = 0;
      let assignedCount = 0;
      let readyCount = 0;
      let unqualifiedCount = 0;
      let shortageCount = 0;
      let overstaffedCount = 0;
      let actingCount = 0;

      relevantPositions.forEach((p) => {
        totalPositions++;
        const detail = medicalStatusMap[p.id];
        const status = detail?.status;
        switch (status) {
          case 'READY':
            assignedCount++;
            readyCount++;
            break;
          case 'UNQUALIFIED':
            assignedCount++;
            unqualifiedCount++;
            break;
          case 'ACTING':
            assignedCount++;
            actingCount++;
            break;
          case 'OVERSTAFFED':
            assignedCount++;
            overstaffedCount++;
            break;
          case 'SHORTAGE':
            shortageCount++;
            break;
        }
      });

      const manningRate = totalPositions > 0 ? (assignedCount / totalPositions) * 100 : 0;
      const readinessRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;

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
    [medicalPositions, medicalStatusMap, descendantMaps],
  );

  // חישוב המדדים הכוללים ברמת הסקופ הנוכחי
  const overallMetrics = useMemo(() => {
    const allUnitIds = scopeDescendantIds || new Set(units.map((u) => u.id));
    const targetPositions = medicalPositions.filter(
      (p) => p.unit_id && allUnitIds.has(p.unit_id)
    );

    let manned = 0, qualified = 0, unqualified = 0, shortage = 0, acting = 0, overstaffed = 0;

    targetPositions.forEach((p) => {
      const detail = medicalStatusMap[p.id];
      const st = detail?.status;
      switch (st) {
        case 'READY':
          manned++;
          qualified++;
          break;
        case 'UNQUALIFIED':
          manned++;
          unqualified++;
          break;
        case 'ACTING':
          manned++;
          acting++;
          break;
        case 'OVERSTAFFED':
          manned++;
          overstaffed++;
          break;
        case 'SHORTAGE':
          shortage++;
          break;
      }
    });

    return {
      totalMedicalPositions: targetPositions.length,
      manned,
      manningGap: shortage,
      qualified,
      unqualified,
      acting,
      overstaffed,
    };
  }, [medicalPositions, medicalStatusMap, scopeDescendantIds, units]);

  const readinessPct = overallMetrics.totalMedicalPositions > 0
    ? Math.round((overallMetrics.qualified / overallMetrics.totalMedicalPositions) * 100)
    : 0;

  const manningPct = overallMetrics.totalMedicalPositions > 0
    ? Math.round((overallMetrics.manned / overallMetrics.totalMedicalPositions) * 100)
    : 0;

  // א. יחידות כפופות ישירות + מטה המסגרת הנוכחית
  const subFrameworksTableData = useMemo(() => {
    if (!level1Id) {
      return level1Units.map((unit) => {
        const stats = computeUnitMetrics(unit.id);
        return {
          id: unit.id,
          name: unit.name,
          type: unit.unit_type,
          isSelfMete: false,
          ...stats,
        };
      });
    }

    if (!currentSelectedUnit) return [];

    const childUnits = units.filter(
      (u) => u.parent_unit_id && String(u.parent_unit_id) === String(currentSelectedUnit.id),
    );

    const rows = childUnits.map((unit) => {
      const stats = computeUnitMetrics(unit.id);
      return {
        id: unit.id,
        name: unit.name,
        type: unit.unit_type,
        isSelfMete: false,
        ...stats,
      };
    });

    const directPositions = medicalPositions.filter(
      (p) => p.unit_id && String(p.unit_id) === String(currentSelectedUnit.id),
    );

    if (directPositions.length > 0) {
      let total = 0, assigned = 0, ready = 0, unqualified = 0, shortage = 0, acting = 0;
      directPositions.forEach((p) => {
        total++;
        const st = medicalStatusMap[p.id]?.status;
        if (st === 'READY') { assigned++; ready++; }
        else if (st === 'UNQUALIFIED' || st === 'OVERSTAFFED') { assigned++; unqualified++; }
        else if (st === 'ACTING') { assigned++; acting++; }
        else if (st === 'SHORTAGE') { shortage++; }
      });
      const manningRate = total > 0 ? (assigned / total) * 100 : 0;
      const readinessRate = total > 0 ? (ready / total) * 100 : 0;

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
        actingCount: acting,
        manningRate,
        readinessRate,
      });
    }

    return rows;
  }, [level1Id, level1Units, currentSelectedUnit, units, medicalPositions, medicalStatusMap, computeUnitMetrics]);

  // שורת סיכום כוללת
  const totalSummaryRow = useMemo(() => {
    let totalPositions = 0, assignedCount = 0, readyCount = 0, unqualifiedCount = 0, shortageCount = 0, actingCount = 0;

    subFrameworksTableData.forEach((r) => {
      totalPositions += r.totalPositions;
      assignedCount += r.assignedCount;
      readyCount += r.readyCount;
      unqualifiedCount += r.unqualifiedCount;
      shortageCount += r.shortageCount;
      actingCount += r.actingCount;
    });

    const manningRate = totalPositions > 0 ? (assignedCount / totalPositions) * 100 : 0;
    const readinessRate = totalPositions > 0 ? (readyCount / totalPositions) * 100 : 0;

    return {
      totalPositions,
      assignedCount,
      readyCount,
      unqualifiedCount,
      shortageCount,
      actingCount,
      manningRate,
      readinessRate,
    };
  }, [subFrameworksTableData]);

  // ד. פערים קריטיים בתפקידים רפואיים (מתוקן לפי תקנים מאוישים, משובצים, ותקינה עודפת)
  const criticalMedicalGaps = useMemo(() => {
    const scopedPositions = (!level1Id) 
      ? medicalPositions 
      : medicalPositions.filter((p) => {
          if (!currentSelectedUnit) return true;
          const unitIdsToInclude = new Set<string>([String(currentSelectedUnit.id)]);
          const descSet = descendantMaps[currentSelectedUnit.id];
          if (descSet) descSet.forEach((id) => unitIdsToInclude.add(String(id)));
          return p.unit_id && unitIdsToInclude.has(String(p.unit_id));
        });

    const gapMap = new Map<string, { 
      positionTitle: string; 
      totalReq: number;             // תקינה מוגדרת
      assignedPersonsCount: number; // משובצים בפועל (סך האנשים)
      mannedPositionsCount: number; // תקנים מאוישים בפועל (0/1)
      overstaffedCount: number;     // תקינה עודפת
      readyCount: number;           // כשירים בפועל
      unqualifiedCount: number;     // מאוישים לא כשירים
      positionGapCount: number;     // פער איוש תקן (0/1)
    }>();

    const assignmentsByPositionMap = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const arr = assignmentsByPositionMap.get(a.position_id) || [];
      arr.push(a);
      assignmentsByPositionMap.set(a.position_id, arr);
    });

    scopedPositions.forEach((p) => {
      const key = p.title.trim();
      const posAssignments = assignmentsByPositionMap.get(p.id) || [];
      const personsCount = posAssignments.length;
      const isManned = personsCount > 0 ? 1 : 0;
      const overstaff = personsCount > 1 ? personsCount - 1 : 0;

      const st = medicalStatusMap[p.id]?.status;
      const isReady = st === 'READY';
      const isUnqualified = st === 'UNQUALIFIED' || st === 'ACTING';
      const isShortage = st === 'SHORTAGE' || personsCount === 0;

      let existing = gapMap.get(key);
      if (!existing) {
        existing = {
          positionTitle: p.title,
          totalReq: 0,
          assignedPersonsCount: 0,
          mannedPositionsCount: 0,
          overstaffedCount: 0,
          readyCount: 0,
          unqualifiedCount: 0,
          positionGapCount: 0,
        };
      }

      existing.totalReq += 1;
      existing.assignedPersonsCount += personsCount;
      existing.mannedPositionsCount += isManned;
      existing.overstaffedCount += overstaff;
      if (isReady) existing.readyCount += 1;
      if (isUnqualified) existing.unqualifiedCount += 1;
      if (isShortage) existing.positionGapCount += 1;

      gapMap.set(key, existing);
    });

    return Array.from(gapMap.values())
      .filter((g) => g.positionGapCount > 0 || g.unqualifiedCount > 0 || g.overstaffedCount > 0)
      .sort((a, b) => b.positionGapCount - a.positionGapCount)
      .slice(0, 10);
  }, [level1Id, currentSelectedUnit, descendantMaps, medicalPositions, medicalStatusMap, rawAssignments]);

  // ספי צבע מותנים
  const getReadinessBadgeColor = (rate: number) => {
    if (rate >= greenThreshold) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (rate >= orangeThreshold) return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-rose-100 text-rose-800 border-rose-300';
  };

  const handleDrillDown = (frameworkId: string, isSelfMete: boolean) => {
    if (isSelfMete) return;
    if (!level1Id || String(currentSelectedUnit?.id) === String(level1Id)) {
      setLevel1Id(String(currentSelectedUnit?.id || level1Units[0]?.id));
      setLevel2Id(frameworkId);
    } else if (String(currentSelectedUnit?.id) === String(level2Id)) {
      setLevel3Id(frameworkId);
    }
  };

  const handleBreadcrumbClick = (level: number) => {
    if (level === 1) {
      setLevel2Id('');
      setLevel3Id('');
    } else if (level === 2) {
      setLevel3Id('');
    }
  };

  const onAssignmentSaved = () => {
    setStatusRefetch((n) => n + 1);
  };

  const openAssignmentModal = (pos: Position) => {
    setAssignmentPosition(pos);
    setAssignModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin mb-3" />
        <p className="text-sm text-slate-500">טוען נתונים רפואיים...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* כותרת ראשית וסרגל הגדרות */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-300 text-xs font-bold mb-1">
            <HeartPulse className="w-4 h-4" />
            <span>תמונת מצב רפואית | מוכנות וכשירות חובשים ורופאים</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">סטטוס תקינה ואיוש רפואי לפי מסגרות</h1>
          <p className="text-xs text-slate-300 mt-1">
            {currentSelectedUnit ? `נתונים עבור מסגרת: ${currentSelectedUnit.name}` : 'תמונת מצב רפואית כלל-מערכתית'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-bold rounded-xl border border-white/15 transition-all cursor-pointer text-rose-100"
          >
            <Settings className="w-4 h-4" />
            <span>הגדרת ספי כשירות</span>
          </button>
        </div>
      </div>

      {/* סרגל סינון היררכי מסלול (Breadcrumb) */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 overflow-x-auto">
          <span className="text-slate-400">מיקומים:</span>
          <button
            onClick={() => { setLevel1Id(''); setLevel2Id(''); setLevel3Id(''); }}
            className={`hover:underline cursor-pointer ${!level1Id ? 'text-rose-600 font-extrabold' : 'text-slate-600'}`}
          >
            כלל המערכת
          </button>

          {level1Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <button
                onClick={() => handleBreadcrumbClick(1)}
                className={`hover:underline cursor-pointer ${level1Id && !level2Id ? 'text-rose-600 font-extrabold' : 'text-slate-600'}`}
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
                className={`hover:underline cursor-pointer ${level2Id && !level3Id ? 'text-rose-600 font-extrabold' : 'text-slate-600'}`}
              >
                {units.find((u) => String(u.id) === String(level2Id))?.name || 'רמה 2'}
              </button>
            </>
          )}

          {level3Id && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 rotate-180" />
              <span className="text-rose-600 font-extrabold">
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

      {/* א. טבלת מסגרות מרכזית (רפואי) */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">
              סטטוס תקינה רפואית במסגרות כפופות – {currentSelectedUnit ? currentSelectedUnit.name : ''}
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
                <th className="p-3.5 text-center">תקינה רפואית</th>
                <th className="p-3.5 text-center">מאויש</th>
                <th className="p-3.5 text-center">כשיר</th>
                <th className="p-3.5 text-center">לא כשיר</th>
                <th className="p-3.5 text-center">פער איוש</th>
                <th className="p-3.5 text-center">איוש %</th>
                <th className="p-3.5 text-center">כשירות %</th>
                <th className="p-3.5 pl-5 text-center">פעולה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {subFrameworksTableData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    אין מסגרות רפואיות כפופות להצגה ברמה זו
                  </td>
                </tr>
              ) : (
                subFrameworksTableData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => handleDrillDown(String(row.id), row.isSelfMete)}
                    className={`hover:bg-slate-50/80 transition-colors ${row.isSelfMete ? 'bg-rose-50/20' : 'cursor-pointer'}`}
                  >
                    <td className="p-3.5 pr-5 font-bold text-slate-900 flex items-center gap-2">
                      <span>{row.name}</span>
                      {row.isSelfMete && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-semibold">
                          מטה היחידה
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center text-slate-800 font-bold">{row.totalPositions}</td>
                    <td className="p-3.5 text-center text-blue-600 font-bold">{row.assignedCount}</td>
                    <td className="p-3.5 text-center text-emerald-600 font-bold">{row.readyCount}</td>
                    <td className="p-3.5 text-center text-amber-600 font-bold">{row.unqualifiedCount}</td>
                    <td className="p-3.5 text-center text-rose-600 font-bold">{row.shortageCount}</td>
                    <td className="p-3.5 text-center text-slate-700">{row.manningRate.toFixed(0)}%</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-black ${getReadinessBadgeColor(row.readinessRate)}`}>
                        {row.readinessRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="p-3.5 pl-5 text-center">
                      {!row.isSelfMete && (
                        <span className="text-rose-600 hover:text-rose-800 font-bold flex items-center justify-center gap-1">
                          צולל <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* שורת סה"כ */}
            <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="p-3.5 pr-5">סה"כ מסגרת</td>
                <td className="p-3.5 text-center">{totalSummaryRow.totalPositions}</td>
                <td className="p-3.5 text-center text-blue-700">{totalSummaryRow.assignedCount}</td>
                <td className="p-3.5 text-center text-emerald-700">{totalSummaryRow.readyCount}</td>
                <td className="p-3.5 text-center text-amber-700">{totalSummaryRow.unqualifiedCount}</td>
                <td className="p-3.5 text-center text-rose-700">{totalSummaryRow.shortageCount}</td>
                <td className="p-3.5 text-center">{totalSummaryRow.manningRate.toFixed(0)}%</td>
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

      {/* ב. גרף השוואת מסגרות (Horizontal Stacked Bar Chart) רפואי */}
      <div className="card p-6 bg-white border border-slate-200 rounded-2xl space-y-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">השוואת מוכנות רפואית ותקינה לפי מסגרות</h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> מאויש וכשיר</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400"></span> מאויש ולא כשיר</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500"></span> פער איוש</div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {subFrameworksTableData.map((row) => {
            if (row.totalPositions === 0) return null;
            const readyPct = (row.readyCount / row.totalPositions) * 100;
            const unqualPct = (row.unqualifiedCount / row.totalPositions) * 100;
            const shortPct = (row.shortageCount / row.totalPositions) * 100;

            return (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>{row.name}</span>
                  <span className="text-slate-400 font-normal">
                    {row.readyCount} כשירים / {row.totalPositions} תקנים ({row.readinessRate.toFixed(0)}% כשירות)
                  </span>
                </div>

                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    style={{ width: `${readyPct}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                    title={`כשיר: ${row.readyCount} (${readyPct.toFixed(1)}%)`}
                  />
                  <div
                    style={{ width: `${unqualPct}%` }}
                    className="bg-amber-400 transition-all duration-500"
                    title={`לא כשיר: ${row.unqualifiedCount} (${unqualPct.toFixed(1)}%)`}
                  />
                  <div
                    style={{ width: `${shortPct}%` }}
                    className="bg-rose-500 transition-all duration-500"
                    title={`לא מאויש: ${row.shortageCount} (${shortPct.toFixed(1)}%)`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* טבלת מטריצה רוחבית: תפקידים רפואיים מול יחידות משנה ישירות */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <Stethoscope className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-bold">פריסת תפקידים רפואיים לפי יחידות משנה (מאוישים / תקינה)</h3>
          </div>
          <span className="text-[11px] text-slate-400">השוואת איוש רוחבית ברמה אחת כלפי מטה</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 pr-4 min-w-[160px]">תפקיד רפואי</th>
                {subFrameworksTableData.map((subUnit) => (
                  <th key={subUnit.id} className="p-2.5 text-center min-w-[110px] border-r border-slate-200">
                    {subUnit.name}
                  </th>
                ))}
                <th className="p-2.5 text-center min-w-[90px] bg-slate-100 border-r-2 border-slate-300 font-black">
                  סה"כ מערכתי
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {(() => {
                const uniqueTitles = Array.from(new Set(medicalPositions.map(p => p.title.trim())));
                
                if (uniqueTitles.length === 0) {
                  return (
                    <tr>
                      <td colSpan={subFrameworksTableData.length + 2} className="text-center py-5 text-slate-400">
                        לא נמצאו תפקידים רפואיים להצגה במטריצה זו
                      </td>
                    </tr>
                  );
                }

                const columnTotals: Record<string, { req: number; assigned: number }> = {};
                subFrameworksTableData.forEach(subUnit => {
                  columnTotals[subUnit.id] = { req: 0, assigned: 0 };
                });
                let grandTotalReq = 0;
                let grandTotalAssigned = 0;

                const rowsMarkup = uniqueTitles.map((title) => {
                  let totalReqAll = 0;
                  let totalAssignedAll = 0;

                  return (
                    <tr key={title} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2 pr-4 font-bold text-slate-900 bg-slate-50/40 text-[11px]">{title}</td>
                      
                      {subFrameworksTableData.map((subUnit) => {
                        const descSet = descendantMaps[subUnit.id] || new Set();
                        const unitSet = new Set<string>([String(subUnit.id)]);
                        descSet.forEach(id => unitSet.add(String(id)));

                        const matchingPositions = medicalPositions.filter(
                          p => p.title.trim() === title && p.unit_id && unitSet.has(String(p.unit_id))
                        );

                        const reqCount = matchingPositions.length;
                        const assignedCount = matchingPositions.filter(p => {
                          const st = medicalStatusMap[p.id]?.status;
                          return st === 'READY' || st === 'UNQUALIFIED' || st === 'ACTING' || st === 'OVERSTAFFED';
                        }).length;

                        totalReqAll += reqCount;
                        totalAssignedAll += assignedCount;

                        columnTotals[subUnit.id].req += reqCount;
                        columnTotals[subUnit.id].assigned += assignedCount;

                        grandTotalReq += reqCount;
                        grandTotalAssigned += assignedCount;

                        const hasGap = assignedCount < reqCount;

                        return (
                          <td key={subUnit.id} className="p-2 text-center border-r border-slate-100">
                            {reqCount === 0 ? (
                              <span className="text-slate-300">-</span>
                            ) : (
                              <span 
                                dir="ltr" 
                                className={`px-1.5 py-0.5 rounded-md font-bold inline-block text-[11px] ${
                                  hasGap ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {assignedCount} / {reqCount}
                              </span>
                            )}
                          </td>
                        );
                      })}

                      <td className="p-2 text-center bg-slate-50/70 border-r-2 border-slate-200 font-black text-slate-900 text-[11px]">
                        <span dir="ltr" className={`inline-block ${totalAssignedAll < totalReqAll ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {totalAssignedAll} / {totalReqAll}
                        </span>
                      </td>
                    </tr>
                  );
                });

                return (
                  <>
                    {rowsMarkup}
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td className="p-2.5 pr-4 text-xs">סה"כ ליחידות משנה</td>
                      {subFrameworksTableData.map((subUnit) => {
                        const col = columnTotals[subUnit.id];
                        const hasColGap = col.assigned < col.req;
                        return (
                          <td key={subUnit.id} className="p-2.5 text-center border-r border-slate-300 text-xs">
                            <span dir="ltr" className={`inline-block ${hasColGap ? 'text-rose-700' : 'text-emerald-700'}`}>
                              {col.assigned} / {col.req}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-2.5 text-center bg-slate-200 border-r-2 border-slate-300 text-xs">
                        <span dir="ltr" className={`inline-block ${grandTotalAssigned < grandTotalReq ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {grandTotalAssigned} / {grandTotalReq}
                        </span>
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* ד. פערים קריטיים בתפקידים רפואיים (מתוקן) */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">פערים רפואיים קריטיים בתפקידים</h3>
          </div>
          <span className="text-xs text-slate-400">ריכוז איוש, כשירות, תקינה עודפת ופערי תקנים</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5 pr-5">תפקיד רפואי</th>
                <th className="p-2.5 text-center">תקינה מוגדרת</th>
                <th className="p-2.5 text-center text-blue-700">משובצים</th>
                <th className="p-2.5 text-center text-blue-900">תקנים מאוישים בפועל</th>
                <th className="p-2.5 text-center text-purple-700">תקינה עודפת</th>
                <th className="p-2.5 text-center text-emerald-600">כשירים בפועל</th>
                <th className="p-2.5 text-center text-amber-600">מאוישים לא כשירים</th>
                <th className="p-2.5 text-center text-rose-600">פער איוש תקן</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {criticalMedicalGaps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-6 text-slate-400">
                    לא נמצאו פערים רפואיים קריטיים במסגרת זו
                  </td>
                </tr>
              ) : (
                criticalMedicalGaps.map((gap, idx) => (
                  <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                    <td className="p-2 pr-5 font-bold text-slate-900">{gap.positionTitle}</td>
                    <td className="p-2 text-center text-slate-700 font-bold">{gap.totalReq}</td>
                    <td className="p-2 text-center text-blue-700 font-bold">{gap.assignedPersonsCount}</td>
                    <td className="p-2 text-center text-blue-900 font-bold">{gap.mannedPositionsCount}</td>
                    <td className="p-2 text-center">
                      {gap.overstaffedCount > 0 ? (
                        <span className="bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                          +{gap.overstaffedCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="p-2 text-center text-emerald-600 font-bold">{gap.readyCount}</td>
                    <td className="p-2 text-center">
                      {gap.unqualifiedCount > 0 ? (
                        <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg font-bold text-[11px]">
                          {gap.unqualifiedCount}
                        </span>
                      ) : (
                        <span className="text-slate-300">0</span>
                      )}
                    </td>
                    <td className="p-2 text-center text-rose-600 font-black text-xs">
                      {gap.positionGapCount > 0 ? (
                        <span dir="ltr" className="bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg inline-block">
                          -{gap.positionGapCount}
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[11px]">תקין (0)</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* מודל הגדרת ספים */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-rose-600" />
                <span>הגדרת ספי כשירות רפואית במערכת</span>
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

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 block">מקרא צבעים כעת:</span>
                <div className="text-emerald-700 font-medium">🟢 מעל {greenThreshold}% : מוכנות רפואית תקינה</div>
                <div className="text-amber-700 font-medium">🟠 בין {orangeThreshold}% ל-{greenThreshold}% : סיכון בינוני</div>
                <div className="text-rose-700 font-medium">🔴 מתחת ל-{orangeThreshold}% : פער רפואי קריטי</div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white text-xs py-2.5 rounded-xl font-bold transition-colors cursor-pointer"
              >
                שמור הגדרות ספים
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      <AssignmentModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        position={assignmentPosition}
        onSaved={onAssignmentSaved}
      />
    </div>
  );
}
