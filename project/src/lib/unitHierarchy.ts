import type { Unit, Position, PositionStatus } from '@/types';
import { UNIT_TYPE_ORDER } from '@/types';

/**
 * Build a map of unitId → full hierarchical path string (root > ... > leaf),
 * using the parent_unit_id chain. Uses " > " as separator.
 */
export function buildUnitPaths(units: Unit[]): Record<string, string> {
  const nameMap = new Map(units.map((u) => [u.id, u.name]));
  const parentMap = new Map(units.map((u) => [u.id, u.parent_unit_id]));

  const cache: Record<string, string> = {};

  const resolve = (unitId: string): string => {
    if (cache[unitId] !== undefined) return cache[unitId];
    const parts: string[] = [];
    let currentId: string | null = unitId;
    const seen = new Set<string>();
    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const name = nameMap.get(currentId);
      if (!name) break;
      parts.unshift(name);
      currentId = parentMap.get(currentId) || null;
    }
    const path = parts.join(' > ');
    cache[unitId] = path;
    return path;
  };

  units.forEach((u) => resolve(u.id));
  return cache;
}

/**
 * Given a flat list of units, return a map of unitId → Set of all descendant
 * unit ids (including the unit itself), computed recursively.
 */
export function buildDescendantMaps(units: Unit[]): Record<string, Set<string>> {
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
      // Merge cached set but still ensure we don't double-add
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
}

export interface HierarchicalUnit {
  unit: Unit;
  depth: number;
}

/**
 * Return units in depth-first traversal order following the org tree,
 * sorted within each level by UNIT_TYPE_ORDER then by name.
 * Each entry includes its depth (0 = root).
 */
export function buildHierarchicalUnitList(units: Unit[]): HierarchicalUnit[] {
  const childrenMap = new Map<string, Unit[]>();
  units.forEach((u) => {
    if (u.parent_unit_id) {
      const arr = childrenMap.get(u.parent_unit_id) || [];
      arr.push(u);
      childrenMap.set(u.parent_unit_id, arr);
    }
  });

  // Sort children by unit_type order, then by name
  const sortChildren = (arr: Unit[]) =>
    arr.sort((a, b) => {
      const aOrder = UNIT_TYPE_ORDER.indexOf(a.unit_type);
      const bOrder = UNIT_TYPE_ORDER.indexOf(b.unit_type);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name, 'he');
    });

  const result: HierarchicalUnit[] = [];
  const roots = units.filter((u) => !u.parent_unit_id);
  sortChildren(roots);

  const traverse = (unit: Unit, depth: number) => {
    result.push({ unit, depth });
    const children = childrenMap.get(unit.id) || [];
    sortChildren(children);
    children.forEach((child) => traverse(child, depth + 1));
  };

  roots.forEach((root) => traverse(root, 0));
  return result;
}

export interface AggregateMetrics {
  /** Total positions in the unit subtree */
  totalPositions: number;
  /** Positions with an active assignment (quantitative manning) */
  manned: number;
  /** Positions without any active assignment (quantitative manning gap) */
  manningGap: number;
  /** Manned positions where the person meets all requirements (qualitative) */
  qualified: number;
  /** Manned positions where the person is missing required qualifications (qualitative) */
  unqualified: number;
  /** Manned positions with an ACTING/TEMPORARY assignment */
  acting: number;
  /** Positions with more than one active assignment */
  overstaffed: number;
}

/**
 * Compute aggregated position metrics for a set of unit ids (typically a unit
 * plus all its descendants). Uses the statusMap to classify each position.
 *
 * Metrics distinguish between:
 * - Quantitative (איוש): manned vs. manning gap
 * - Qualitative (כשירות): qualified vs. unqualified among manned positions
 */
export function computeAggregateMetrics(
  positions: Position[],
  descendantUnitIds: Set<string>,
  statusMap: Record<string, { status: PositionStatus }>,
): AggregateMetrics {
  const relevantPositions = positions.filter(
    (p) => p.unit_id !== null && descendantUnitIds.has(p.unit_id),
  );

  const metrics: AggregateMetrics = {
    totalPositions: relevantPositions.length,
    manned: 0,
    manningGap: 0,
    qualified: 0,
    unqualified: 0,
    acting: 0,
    overstaffed: 0,
  };

  relevantPositions.forEach((p) => {
    const status = statusMap[p.id]?.status;
    switch (status) {
      case 'READY':
        metrics.manned++;
        metrics.qualified++;
        break;
      case 'UNQUALIFIED':
        metrics.manned++;
        metrics.unqualified++;
        break;
      case 'ACTING':
        metrics.manned++;
        metrics.acting++;
        break;
      case 'OVERSTAFFED':
        metrics.manned++;
        metrics.overstaffed++;
        break;
      case 'SHORTAGE':
        metrics.manningGap++;
        break;
    }
  });

  return metrics;
}
