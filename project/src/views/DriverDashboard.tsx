import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Truck,
  ChevronDown,
  ChevronLeft,
  Building2,
  Shield,
  Building,
  Map as MapIcon,
  ClipboardList,
  Layers,
  Users,
  User,
  CircleUser,
  Loader2,
  UserPlus,
  Car,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  IdCard,
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
  UNIT_TYPE_ORDER,
  getUnitTypeLabel,
  getUnitTypeColor,
  getFullName,
  isDriverPosition,
  isDrivingQualification,
  calculatePositionStatus,
  getMissingQualificationIds,
} from '@/types';
import StatusBadge from '@/components/StatusBadge';
import AssignmentModal from '@/components/AssignmentModal';
import { useToast } from '@/components/Toast';
import { useUnitScope } from '@/context/UnitScopeContext';

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

interface DriverMetrics {
  totalDriverPositions: number;
  manned: number;
  manningGap: number;
  qualified: number;
  unqualified: number;
  acting: number;
  overstaffed: number;
}

interface DriverPositionDetail {
  position: Position;
  status: PositionStatus;
  assignment: Assignment | null;
  missingQualNames: string[];
  requiredQuals: Qualification[];
  personQuals: Qualification[];
}

interface UnitNode extends Unit {
  children: UnitNode[];
  driverPositions: Position[];
  metrics: DriverMetrics;
}

interface MatrixUnit {
  unit: Unit;
  descendantIds: Set<string>;
}

interface MatrixCell {
  certifiedCount: number;
  requiredCount: number;
  gap: number;
}

export default function DriverDashboard() {
  const { toast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [unitDetail, setUnitDetail] = useState<{
    positions: DriverPositionDetail[];
    persons: Person[];
  } | null>(null);
  const [assignmentPosition, setAssignmentPosition] = useState<Position | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusRefetch, setStatusRefetch] = useState(0);
  const { descendantIds: scopeDescendantIds } = useUnitScope();

  const [rawRequirements, setRawRequirements] = useState<PositionRequirement[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<PersonQualification[]>([]);

  // פונקציה לשליפת כל התקנים בפעימות (עוקפת את מגבלת ה-1000 שורות של Supabase)
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
    const [unitRes, qualRes, reqRes, assignRes, personQualRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('qualifications').select('*').order('name'),
      supabase.from('position_requirements').select('*, qualifications(*)'),
      supabase.from('assignments').select('*, persons(*), positions(*)').eq('is_active', true),
      supabase.from('person_qualifications').select('*, qualifications(*)'),
    ]);

    const positionsData = await fetchAllPositions();

    if (unitRes.error) {
      toast('שגיאה בטעינת נתוני נהגים', 'error');
      setLoading(false);
      return;
    }

    setUnits((unitRes.data || []) as Unit[]);
    setAllPositions((positionsData || []) as Position[]);
    setQualifications((qualRes.data || []) as Qualification[]);
    setRawRequirements((reqRes.data || []) as PositionRequirement[]);
    setRawAssignments((assignRes.data || []) as Assignment[]);
    setRawPersonQuals((personQualRes.data || []) as PersonQualification[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData, statusRefetch]);

  const driverPositions = useMemo(
    () => allPositions.filter(
      (p) => isDriverPosition(p) && (!scopeDescendantIds || (p.unit_id !== null && scopeDescendantIds.has(p.unit_id))),
    ),
    [allPositions, scopeDescendantIds],
  );

  const scopedUnits = useMemo(
    () => (scopeDescendantIds ? units.filter((u) => scopeDescendantIds.has(u.id)) : units),
    [units, scopeDescendantIds],
  );

  const drivingQuals = useMemo(
    () => qualifications.filter((q) => isDrivingQualification(q)),
    [qualifications],
  );

  const driverStatusMap = useMemo(() => {
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

    const map: Record<string, DriverPositionDetail> = {};

    driverPositions.forEach((pos) => {
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
  }, [driverPositions, rawAssignments, rawRequirements, rawPersonQuals, qualifications]);

  const descendantMaps = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    units.forEach((u) => {
      if (u.parent_unit_id) {
        const arr = childrenMap.get(u.parent_unit_id) || [];
        arr.push(u.id);
        childrenMap.set(u.parent_unit_id, arr);
      }
    });

    const result: Record<string, Set<string>> = {};
    const collect = (unitId: string, seen: Set<string>): Set<string> => {
      if (result[unitId] !== undefined) {
        result[unitId].forEach((id) => seen.add(id));
        return seen;
      }
      seen.add(unitId);
      const children = childrenMap.get(unitId) || [];
      children.forEach((childId) => collect(childId, seen));
      return seen;
    };

    units.forEach((u) => {
      if (result[u.id] === undefined) {
        result[u.id] = collect(u.id, new Set());
      }
    });
    return result;
  }, [units]);

  const computeMetrics = useCallback(
    (unitIds: Set<string>): DriverMetrics => {
      const relevant = driverPositions.filter(
        (p) => p.unit_id !== null && unitIds.has(p.unit_id),
      );

      const m: DriverMetrics = {
        totalDriverPositions: relevant.length,
        manned: 0,
        manningGap: 0,
        qualified: 0,
        unqualified: 0,
        acting: 0,
        overstaffed: 0,
      };

      relevant.forEach((p) => {
        const status = driverStatusMap[p.id]?.status;
        switch (status) {
          case 'READY':
            m.manned++;
            m.qualified++;
            break;
          case 'UNQUALIFIED':
            m.manned++;
            m.unqualified++;
            break;
          case 'ACTING':
            m.manned++;
            m.acting++;
            break;
          case 'OVERSTAFFED':
            m.manned++;
            m.overstaffed++;
            break;
          case 'SHORTAGE':
            m.manningGap++;
            break;
        }
      });
      return m;
    },
    [driverPositions, driverStatusMap],
  );

  const unitsWithDrivers = useMemo(() => {
    const unitIdsWithDrivers = new Set<string>();
    driverPositions.forEach((p) => {
      if (p.unit_id) unitIdsWithDrivers.add(p.unit_id);
    });

    const result = new Set<string>();
    const parentMap = new Map(scopedUnits.map((u) => [u.id, u.parent_unit_id]));
    unitIdsWithDrivers.forEach((uid) => {
      let current: string | null = uid;
      while (current) {
        result.add(current);
        current = parentMap.get(current) || null;
      }
    });
    return result;
  }, [driverPositions, scopedUnits]);

  const driverTree = useMemo((): UnitNode[] => {
    const childrenMap = new Map<string, Unit[]>();
    scopedUnits.forEach((u) => {
      if (u.parent_unit_id) {
        const arr = childrenMap.get(u.parent_unit_id) || [];
        arr.push(u);
        childrenMap.set(u.parent_unit_id, arr);
      }
    });

    const sortUnits = (arr: Unit[]) =>
      arr.sort((a, b) => {
        const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
        const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, 'he');
      });

    const buildNode = (unit: Unit): UnitNode => {
      const children = (childrenMap.get(unit.id) || [])
        .filter((c) => unitsWithDrivers.has(c.id))
        .slice();
      sortUnits(children);
      const childNodes = children.map(buildNode);
      const drPositions = driverPositions.filter((p) => p.unit_id === unit.id);
      const descIds = descendantMaps[unit.id] || new Set([unit.id]);
      const metrics = computeMetrics(descIds);

      return {
        ...unit,
        children: childNodes,
        driverPositions: drPositions,
        metrics,
      };
    };

    const roots = scopedUnits
      .filter((u) => !scopedUnits.some((su) => su.id === u.parent_unit_id) && unitsWithDrivers.has(u.id))
      .slice();
    sortUnits(roots);
    return roots.map(buildNode);
  }, [scopedUnits, driverPositions, unitsWithDrivers, descendantMaps, computeMetrics]);

  useEffect(() => {
    if (driverTree.length > 0 && expanded.size === 0) {
      setExpanded(new Set(driverTree.map((n) => n.id)));
    }
  }, [driverTree]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectUnit = useCallback(
    async (unit: Unit) => {
      setSelectedUnitId(unit.id);
      setDetailLoading(true);

      const descIds = descendantMaps[unit.id] || new Set([unit.id]);
      const unitDriverPositions = driverPositions.filter(
        (p) => p.unit_id !== null && descIds.has(p.unit_id),
      );

      const details: DriverPositionDetail[] = unitDriverPositions.map((pos) => {
        const detail = driverStatusMap[pos.id];
        if (detail) return detail;
        return {
          position: pos,
          status: 'SHORTAGE' as PositionStatus,
          assignment: null,
          missingQualNames: [],
          requiredQuals: [],
          personQuals: [],
        };
      });

      const personIds = new Set<string>();
      details.forEach((d) => {
        if (d.assignment?.persons) personIds.add(d.assignment.persons.id);
      });

      const personsList: Person[] = [];
      personIds.forEach((pid) => {
        const detail = details.find((d) => d.assignment?.persons?.id === pid);
        if (detail?.assignment?.persons) {
          personsList.push(detail.assignment.persons);
        }
      });

      setUnitDetail({ positions: details, persons: personsList });
      setDetailLoading(false);
    },
    [descendantMaps, driverPositions, driverStatusMap],
  );

  const onAssignmentSaved = () => {
    setStatusRefetch((n) => n + 1);
    if (selectedUnitId) {
      const unit = units.find((u) => u.id === selectedUnitId);
      if (unit) selectUnit(unit);
    }
  };

  const openAssignmentModal = (pos: Position) => {
    setAssignmentPosition(pos);
    setAssignModalOpen(true);
  };

  const overallMetrics = useMemo(() => {
    return computeMetrics(scopeDescendantIds || new Set(units.map((u) => u.id)));
  }, [computeMetrics, units, scopeDescendantIds]);

  const readinessPct = overallMetrics.totalDriverPositions > 0
    ? Math.round((overallMetrics.qualified / overallMetrics.totalDriverPositions) * 100)
    : 0;
  const manningPct = overallMetrics.totalDriverPositions > 0
    ? Math.round((overallMetrics.manned / overallMetrics.totalDriverPositions) * 100)
    : 0;

  const matrixUnits = useMemo((): MatrixUnit[] => {
    const relevantTypes: UnitType[] = ['BATTALION', 'COMPANY', 'HEADQUARTERS', 'FORWARD_HQ'];
    return scopedUnits
      .filter((u) => {
        if (!relevantTypes.includes(u.unit_type)) return false;
        const desc = descendantMaps[u.id] || new Set([u.id]);
        return driverPositions.some((p) => p.unit_id !== null && desc.has(p.unit_id));
      })
      .sort((a, b) => {
        const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
        const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.name.localeCompare(b.name, 'he');
      })
      .map((unit) => ({
        unit,
        descendantIds: descendantMaps[unit.id] || new Set([unit.id]),
      }));
  }, [scopedUnits, descendantMaps, driverPositions]);

  const matrixQuals = useMemo(() => {
    return drivingQuals.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [drivingQuals]);

  const personDrivingQuals = useMemo(() => {
    const drivingQualIds = new Set(drivingQuals.map((q) => q.id));
    const result = new Map<string, Set<string>>();
    rawPersonQuals.forEach((pq) => {
      if (drivingQualIds.has(pq.qualification_id)) {
        const set = result.get(pq.person_id) || new Set<string>();
        set.add(pq.qualification_id);
        result.set(pq.person_id, set);
      }
    });
    return result;
  }, [rawPersonQuals, drivingQuals]);

  const positionDrivingReqs = useMemo(() => {
    const drivingQualIds = new Set(drivingQuals.map((q) => q.id));
    const result = new Map<string, Set<string>>();
    rawRequirements.forEach((r) => {
      if (drivingQualIds.has(r.qualification_id)) {
        const set = result.get(r.position_id) || new Set<string>();
        set.add(r.qualification_id);
        result.set(r.position_id, set);
      }
    });
    return result;
  }, [rawRequirements, drivingQuals]);

  const assignmentsByPosition = useMemo(() => {
    const result = new Map<string, Assignment[]>();
    rawAssignments.forEach((a) => {
      const arr = result.get(a.position_id) || [];
      arr.push(a);
      result.set(a.position_id, arr);
    });
    return result;
  }, [rawAssignments]);

  const matrix = useMemo((): Record<string, Record<string, MatrixCell>> => {
    const result: Record<string, Record<string, MatrixCell>> = {};

    matrixQuals.forEach((qual) => {
      result[qual.id] = {};

      matrixUnits.forEach(({ unit, descendantIds }) => {
        const unitDriverPositions = driverPositions.filter(
          (p) => p.unit_id !== null && descendantIds.has(p.unit_id),
        );

        const requiredCount = unitDriverPositions.filter((p) => {
          const reqs = positionDrivingReqs.get(p.id);
          return reqs?.has(qual.id);
        }).length;

        const assignedPersonIds = new Set<string>();
        unitDriverPositions.forEach((p) => {
          const assigns = assignmentsByPosition.get(p.id) || [];
          assigns.forEach((a) => assignedPersonIds.add(a.person_id));
        });

        let certifiedCount = 0;
        assignedPersonIds.forEach((pid) => {
          const quals = personDrivingQuals.get(pid);
          if (quals?.has(qual.id)) certifiedCount++;
        });

        result[qual.id][unit.id] = {
          certifiedCount,
          requiredCount,
          gap: certifiedCount - requiredCount,
        };
      });
    });

    return result;
  }, [matrixQuals, matrixUnits, driverPositions, positionDrivingReqs, assignmentsByPosition, personDrivingQuals]);

  const renderNode = (node: UnitNode, depth: number): React.ReactNode => {
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedUnitId === node.id;
    const Icon = ICON_BY_TYPE[node.unit_type] || Building2;
    const hasChildren = node.children.length > 0;
    const hasDirectDrivers = node.driverPositions.length > 0;
    const m = node.metrics;

    return (
      <div key={node.id}>
        <div
          className={`group flex items-center gap-1.5 py-2 pr-2 pl-3 rounded-lg transition-all duration-100 cursor-pointer ${
            isSelected
              ? 'bg-amber-600/15 border border-amber-500/30'
              : 'hover:bg-slate-100/50 border border-transparent'
          }`}
          style={{ paddingRight: `${depth * 20 + 8}px` }}
          onClick={() => {
            selectUnit(node);
            if (hasChildren) toggleExpand(node.id);
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node.id);
              }}
              className="p-0.5 text-slate-500 hover:text-slate-800 transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className={`text-sm flex-1 truncate ${isSelected ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>
            {node.name}
          </span>
          {hasDirectDrivers && (
            <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex-shrink-0">
              <Car className="w-3 h-3" />
              {node.driverPositions.length}
            </span>
          )}
          <span className={`badge text-[10px] ${getUnitTypeColor(node.unit_type)} flex-shrink-0`}>
            {getUnitTypeLabel(node.unit_type)}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {m.manningGap > 0 && (
              <span className="text-[10px] text-red-400" title="חוסר איוש">
                {m.manningGap}
              </span>
            )}
            {m.unqualified > 0 && (
              <span className="text-[10px] text-orange-400" title="חסרי היתר">
                {m.unqualified}
              </span>
            )}
            {m.qualified > 0 && (
              <span className="text-[10px] text-emerald-400" title="כשירים">
                {m.qualified}
              </span>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="animate-slideDown">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedUnit = units.find((u) => u.id === selectedUnitId) || null;

  const selectedUnitPath = useMemo(() => {
    if (!selectedUnit) return '';
    const nameMap = new Map(units.map((u) => [u.id, u.name]));
    const parentMap = new Map(units.map((u) => [u.id, u.parent_unit_id]));
    const parts: string[] = [selectedUnit.name];
    let currentId: string | null = selectedUnit.parent_unit_id;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const name = nameMap.get(currentId);
      if (!name) break;
      parts.unshift(name);
      currentId = parentMap.get(currentId) || null;
    }
    return parts.join(' > ');
  }, [selectedUnit, units]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-3" />
        <p className="text-sm text-slate-500">טוען נתוני נהגים והיתרים...</p>
      </div>
    );
  }

  if (driverPositions.length === 0) {
    return (
      <div className="card text-center py-16">
        <Car className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-600 text-sm">לא נמצאו תקנים לנהגים במערכת</p>
        <p className="text-slate-500 text-xs mt-2">
          תקנים שכוללים מילות מפתח רלוונטית (נהג, נהיגה, נגמ"ש, משאית וכו') יופיעו כאן אוטומטית
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Truck className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">תמונת מצב נהגים והיתרים</h3>
            <p className="text-xs text-slate-500">תקינת נהגים, רישיונות והיתרי נהיגה ברחבי החטיבה</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white/50 rounded-lg p-3">
            <div className="text-[11px] text-slate-500 mb-1">סך תקני נהגים</div>
            <div className="text-2xl font-bold text-slate-900">{overallMetrics.totalDriverPositions}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="text-[11px] text-emerald-400 mb-1">מאוכלסים</div>
            <div className="text-2xl font-bold text-emerald-400">{overallMetrics.manned}</div>
            <div className="text-[10px] text-slate-500">{manningPct}% איוש</div>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <div className="text-[11px] text-red-400 mb-1">חוסר איוש</div>
            <div className="text-2xl font-bold text-red-400">{overallMetrics.manningGap}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
            <div className="text-[11px] text-emerald-400 mb-1">כשירים</div>
            <div className="text-2xl font-bold text-emerald-400">{overallMetrics.qualified}</div>
            <div className="text-[10px] text-slate-500">{readinessPct}% מוכנות</div>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
            <div className="text-[11px] text-orange-400 mb-1">חסרי היתר</div>
            <div className="text-2xl font-bold text-orange-400">{overallMetrics.unqualified}</div>
          </div>
          <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
            <div className="text-[11px] text-amber-400 mb-1">ממלאי מקום</div>
            <div className="text-2xl font-bold text-amber-400">{overallMetrics.acting}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>מוכנות נהגים כוללת</span>
            <span className="font-bold text-slate-600">{readinessPct}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${readinessPct}%`,
                background: readinessPct >= 75
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : readinessPct >= 50
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
        </div>
      </div>

      {matrixQuals.length > 0 && matrixUnits.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <IdCard className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-800">מטריצת היתרים ומוסמכים</h3>
            <span className="text-xs text-slate-500">מספר מוסמכים לעומת תקנים נדרשים לפי יחידה</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="sticky right-0 bg-slate-100/80 text-right px-3 py-2.5 text-xs font-bold text-slate-600 border-b border-slate-300 min-w-[140px]">
                    סוג היתר / רישיון
                  </th>
                  {matrixUnits.map(({ unit }) => (
                    <th
                      key={unit.id}
                      className="px-3 py-2.5 text-center text-xs font-bold text-slate-600 border-b border-slate-300 min-w-[110px]"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-slate-800 text-sm">{unit.name}</span>
                        <span className={`badge text-[9px] ${getUnitTypeColor(unit.unit_type)}`}>
                          {getUnitTypeLabel(unit.unit_type)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixQuals.map((qual, rowIdx) => (
                  <tr key={qual.id} className={rowIdx % 2 === 0 ? 'bg-white/30' : ''}>
                    <td className="sticky right-0 bg-inherit px-3 py-2.5 text-right text-sm text-slate-800 font-medium border-b border-slate-300/50">
                      <div className="flex items-center gap-2">
                        <IdCard className="w-3.5 h-3.5 text-amber-400/70 flex-shrink-0" />
                        <span>{qual.name}</span>
                      </div>
                    </td>
                    {matrixUnits.map(({ unit }) => {
                      const cell = matrix[qual.id]?.[unit.id];
                      if (!cell) {
                        return (
                          <td key={unit.id} className="px-3 py-2.5 text-center border-b border-slate-300/50">
                            <span className="text-slate-600 text-xs">—</span>
                          </td>
                        );
                      }
                      const hasGap = cell.gap < 0;
                      const hasSurplus = cell.gap > 0;
                      const isZero = cell.certifiedCount === 0 && cell.requiredCount === 0;

                      return (
                        <td
                          key={unit.id}
                          className={`px-3 py-2.5 text-center border-b border-slate-300/50 ${
                            isZero
                              ? ''
                              : hasGap
                                ? 'bg-red-500/10'
                                : hasSurplus
                                  ? 'bg-emerald-500/8'
                                  : 'bg-emerald-500/5'
                          }`}
                        >
                          {isZero ? (
                            <span className="text-slate-600 text-xs">—</span>
                          ) : (
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-sm font-bold ${
                                    hasGap ? 'text-red-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {cell.certifiedCount}
                                </span>
                                <span className="text-slate-600 text-xs">/</span>
                                <span className="text-slate-600 text-sm">{cell.requiredCount}</span>
                              </div>
                              <span className="text-[9px] text-slate-500">
                                מוסמכים / תקנים
                              </span>
                              {hasGap && (
                                <span className="flex items-center gap-0.5 text-[9px] text-red-400 font-bold">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  חסר {Math.abs(cell.gap)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20" />
              חסר מוסמכים
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/8 border border-emerald-500/20" />
              עומד בדרישות / עודף
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-2/5 flex flex-col">
          <div className="card flex flex-col h-[calc(100vh-380px)] sticky top-20">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300/60">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-slate-800">יחידות עם תקני נהגים</h3>
              </div>
              <span className="badge text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {driverPositions.length} תקנים
              </span>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {driverTree.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Car className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">אין יחידות עם תקני נהגים</p>
                </div>
              ) : (
                driverTree.map((node) => renderNode(node, 0))
              )}
            </div>
          </div>
        </div>

        <div className="lg:w-3/5">
          {!selectedUnit ? (
            <div className="card flex items-center justify-center h-64 text-center">
              <div>
                <Car className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-600 text-sm">בחרו יחידה מהעץ לצפייה בפרטי תקני הנהגים</p>
              </div>
            </div>
          ) : detailLoading ? (
            <div className="space-y-3">
              <div className="skeleton w-full h-24 rounded-xl" />
              <div className="skeleton w-full h-48 rounded-xl" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      {(() => {
                        const Icon = selectedUnit ? ICON_BY_TYPE[selectedUnit.unit_type] || Building2 : Building2;
                        return <Icon className="w-6 h-6 text-amber-400" />;
                      })()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{selectedUnit?.name}</h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">{selectedUnitPath}</div>
                      <span className={`badge text-xs mt-1 ${selectedUnit ? getUnitTypeColor(selectedUnit.unit_type) : ''}`}>
                        {selectedUnit ? getUnitTypeLabel(selectedUnit.unit_type) : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  if (!selectedUnit) return null;
                  const desc = descendantMaps[selectedUnit.id] || new Set([selectedUnit.id]);
                  const m = computeMetrics(desc);
                  const unitReadiness = m.totalDriverPositions > 0
                    ? Math.round((m.qualified / m.totalDriverPositions) * 100)
                    : 0;
                  const unitManning = m.totalDriverPositions > 0
                    ? Math.round((m.manned / m.totalDriverPositions) * 100)
                    : 0;

                  return (
                    <div className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-white/40 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-slate-900">{m.totalDriverPositions}</div>
                          <div className="text-[10px] text-slate-500">סך תקני נהגים</div>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/20">
                          <div className="text-lg font-bold text-emerald-400">{m.manned}</div>
                          <div className="text-[10px] text-slate-500">מאוכלסים ({unitManning}%)</div>
                        </div>
                        <div className="bg-red-500/10 rounded-lg p-2 text-center border border-red-500/20">
                          <div className="text-lg font-bold text-red-400">{m.manningGap}</div>
                          <div className="text-[10px] text-slate-500">חוסר איוש</div>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-2 text-center border border-emerald-500/20">
                          <div className="text-lg font-bold text-emerald-400">{m.qualified}</div>
                          <div className="text-[10px] text-slate-500">כשירים ({unitReadiness}%)</div>
                        </div>
                      </div>
                      {(m.unqualified > 0 || m.acting > 0) && (
                        <div className="flex items-center gap-3 text-xs">
                          {m.unqualified > 0 && (
                            <span className="flex items-center gap-1 text-orange-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {m.unqualified} חסרי היתר
                            </span>
                          )}
                          {m.acting > 0 && (
                            <span className="flex items-center gap-1 text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                              {m.acting} ממלאי מקום
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="card p-5">
                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>תקני נהגים במסגרת</span>
                  <span className="text-xs text-slate-500 font-normal">(כולל תתי-יחידות)</span>
                </h4>
                {(!unitDetail || unitDetail.positions.length === 0) ? (
                  <p className="text-sm text-slate-500 py-3">אין תקני נהגים במסגרת זו</p>
                ) : (
                  <div className="space-y-3">
                    {unitDetail.positions.map((detail) => {
                      const pos = detail.position;
                      const unitName = pos.units?.name || units.find((u) => u.id === pos.unit_id)?.name || '';
                      return (
                        <div
                          key={pos.id}
                          className={`rounded-lg p-3 border transition-all ${
                            detail.status === 'SHORTAGE'
                              ? 'bg-red-500/5 border-red-500/15'
                              : detail.status === 'UNQUALIFIED'
                                ? 'bg-orange-500/5 border-orange-500/15'
                                : detail.status === 'READY'
                                  ? 'bg-emerald-500/5 border-emerald-500/15'
                                  : 'bg-white/40 border-slate-300/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <Car className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              <span className="text-sm font-semibold text-slate-800">{pos.title}</span>
                              {pos.code && <span className="text-xs text-slate-500">({pos.code})</span>}
                              {unitName && (
                                <span className="text-[10px] text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded">
                                  {unitName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <StatusBadge status={detail.status} size="xs" />
                              <button
                                onClick={() => openAssignmentModal(pos)}
                                className="p-1 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
                                title="שייך אדם לתקן"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {detail.assignment?.persons ? (
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600">
                                  {detail.assignment.persons.first_name.charAt(0)}
                                  {detail.assignment.persons.last_name.charAt(0)}
                                </div>
                                <div>
                                  <span className="text-sm text-slate-800 font-medium">
                                    {getFullName(detail.assignment.persons)}
                                  </span>
                                  {detail.assignment.persons.rank && (
                                    <span className="text-xs text-slate-500 mr-1.5">
                                      {detail.assignment.persons.rank}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-2 text-sm text-red-400">
                              <XCircle className="w-4 h-4" />
                              <span>תקן לא מאויש — נדרש שיוך אדם</span>
                            </div>
                          )}

                          {detail.requiredQuals.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-300/40">
                              <div className="text-[10px] text-slate-500 mb-1.5">היתרים / רישיונות נדרשים:</div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {detail.requiredQuals.map((req) => {
                                  const hasIt = detail.personQuals.some((pq) => pq.id === req.id);
                                  return (
                                    <span
                                      key={req.id}
                                      className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border ${
                                        hasIt
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                                      }`}
                                    >
                                      {hasIt ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                      ) : (
                                        <XCircle className="w-3 h-3" />
                                      )}
                                      {req.name}
                                    </span>
                                  );
                                })}
                              </div>
                              {detail.missingQualNames.length > 0 && (
                                <div className="text-[10px] text-orange-400 mt-1.5 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  חסר: {detail.missingQualNames.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {unitDetail && unitDetail.persons.length > 0 && (
                <div className="card p-5">
                  <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>נהגים במסגרת</span>
                  </h4>
                  <div className="space-y-2">
                    {unitDetail.persons.map((person) => {
                      const personDetail = unitDetail.positions.find(
                        (d) => d.assignment?.persons?.id === person.id,
                      );
                      return (
                        <div
                          key={person.id}
                          className="flex items-center justify-between bg-white/40 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-bold text-amber-300">
                              {person.first_name.charAt(0)}
                              {person.last_name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm text-slate-800 font-medium">{getFullName(person)}</div>
                              <div className="text-[11px] text-slate-500">
                                #{person.personal_id}
                                {personDetail?.position && ` · ${personDetail.position.title}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {person.rank && <span className="text-xs text-slate-600">{person.rank}</span>}
                            {personDetail && <StatusBadge status={personDetail.status} size="xs" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AssignmentModal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        position={assignmentPosition}
        onSaved={onAssignmentSaved}
      />
    </div>
  );
}
