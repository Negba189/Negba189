import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  type Assignment,
  type PositionStatus,
  type PositionRequirement,
  type PersonQualification,
  type Qualification,
  type Person,
} from '@/types';

export interface PositionStatusInfo {
  status: PositionStatus;
  activeAssignments: Assignment[];
  requirements: PositionRequirement[];
  /** Names of qualifications the assigned person is missing (only for UNQUALIFIED) */
  missingQualificationNames: string[];
}

/**
 * Hook that fetches all data needed to calculate position readiness statuses
 * across all positions: active assignments, position requirements, and
 * person qualifications. Returns a map of positionId → status info.
 *
 * Every position gets an entry — even those with no assignments (SHORTAGE).
 */
export function usePositionStatuses(refetchTrigger: number = 0) {
  const [statusMap, setStatusMap] = useState<Record<string, PositionStatusInfo>>({});
  const [loading, setLoading] = useState(true);

  const fetchStatusData = useCallback(async () => {
    setLoading(true);

    // שליפה נפרדת של הטבלאות ללא Joins מסוכנים שעשויים להיחסם על ידי RLS
    const [posRes, assignRes, personsRes, reqRes, personQualRes, qualRes] = await Promise.all([
      supabase.from('positions').select('id, title'),
      supabase.from('assignments').select('*').eq('is_active', true),
      supabase.from('persons').select('*'),
      supabase.from('position_requirements').select('*, qualifications(*)'),
      supabase.from('person_qualifications').select('*, qualifications(*)'),
      supabase.from('qualifications').select('*'),
    ]);

    if (assignRes.error || reqRes.error || personQualRes.error || qualRes.error) {
      setLoading(false);
      return;
    }

    const positionsData = (posRes.data || []) as { id: string; title: string }[];
    const rawAssignments = (assignRes.data || []) as Assignment[];
    const personsData = (personsRes.data || []) as Person[];
    const requirements = (reqRes.data || []) as PositionRequirement[];
    const personQuals = (personQualRes.data || []) as PersonQualification[];
    const qualifications = (qualRes.data || []) as Qualification[];

    // מיפוי אנשים לפי ID לחיבור מהיר
    const personsMap = new Map<string, Person>();
    personsData.forEach((p) => personsMap.set(p.id, p));

    // הרכבת השיוכים יחד עם פרטי האדם המלאים
    const assignments: Assignment[] = rawAssignments.map((a) => ({
      ...a,
      persons: a.person_id ? personsMap.get(a.person_id) || null : null,
    }));

    // Map qualification_id → name for missing-qual display
    const qualNameMap = new Map<string, string>();
    qualifications.forEach((q) => qualNameMap.set(q.id, q.name));

    // Group assignments by position_id
    const assignmentsByPosition = new Map<string, Assignment[]>();
    assignments.forEach((a) => {
      const arr = assignmentsByPosition.get(a.position_id) || [];
      arr.push(a);
      assignmentsByPosition.set(a.position_id, arr);
    });

    // Group requirements by position_id
    const requirementsByPosition = new Map<string, PositionRequirement[]>();
    requirements.forEach((r) => {
      const arr = requirementsByPosition.get(r.position_id) || [];
      arr.push(r);
      requirementsByPosition.set(r.position_id, arr);
    });

    // Group person qualifications by person_id
    const personQualsByPerson = new Map<string, Set<string>>();
    const personQualNamesByPerson = new Map<string, Set<string>>();
    
    personQuals.forEach((pq) => {
      const set = personQualsByPerson.get(pq.person_id) || new Set<string>();
      set.add(pq.qualification_id);
      personQualsByPerson.set(pq.person_id, set);

      const qName = pq.qualifications?.name || qualNameMap.get(pq.qualification_id);
      if (qName) {
        const nameSet = personQualNamesByPerson.get(pq.person_id) || new Set<string>();
        nameSet.add(qName);
        personQualNamesByPerson.set(pq.person_id, nameSet);
      }
    });

    // Build status map for EVERY position
    const map: Record<string, PositionStatusInfo> = {};

    positionsData.forEach((pos) => {
      const posId = pos.id;
      const activeAssignments = assignmentsByPosition.get(posId) || [];
      const posReqs = requirementsByPosition.get(posId) || [];
      
      const requiredQualIds = new Set(posReqs.map((r) => r.qualification_id));
      const requiredQualNames = new Set(
        posReqs.map((r) => r.qualifications?.name || qualNameMap.get(r.qualification_id)).filter(Boolean) as string[]
      );

      let personQualIds = new Set<string>();
      let personQualNames = new Set<string>();

      if (activeAssignments.length === 1) {
        const personId = activeAssignments[0].person_id;
        personQualIds = personQualsByPerson.get(personId) || new Set<string>();
        personQualNames = personQualNamesByPerson.get(personId) || new Set<string>();
      }

      // Check if person has all required qualifications
      let hasAll = true;
      if (posReqs.length > 0) {
        hasAll = posReqs.every((req) => {
          const reqId = req.qualification_id;
          const reqName = req.qualifications?.name || qualNameMap.get(reqId);
          return personQualIds.has(reqId) || (reqName && personQualNames.has(reqName));
        });
      }

      let status: PositionStatus = 'READY';
      const count = activeAssignments.length;

      if (count > 1) {
        status = 'OVERSTAFFED';
      } else if (count === 0) {
        status = 'SHORTAGE';
      } else {
        const assignment = activeAssignments[0];
        if (assignment.assignment_type === 'ACTING' || assignment.assignment_type === 'TEMPORARY') {
          status = 'ACTING';
        } else if (!hasAll) {
          status = 'UNQUALIFIED'; // כאן המג"ד יזוהה עכשיו כחסר הסמכה!
        }
      }

      let missingQualificationNames: string[] = [];
      if (status === 'UNQUALIFIED') {
        posReqs.forEach((req) => {
          const reqId = req.qualification_id;
          const reqName = req.qualifications?.name || qualNameMap.get(reqId) || 'הסמכה';
          if (!personQualIds.has(reqId) && !(reqName && personQualNames.has(reqName))) {
            missingQualificationNames.push(reqName);
          }
        });
      }

      map[posId] = {
        status,
        activeAssignments,
        requirements: posReqs,
        missingQualificationNames,
      };
    });

    setStatusMap(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatusData();
  }, [fetchStatusData, refetchTrigger]);

  return { statusMap, loading, refetch: fetchStatusData };
}