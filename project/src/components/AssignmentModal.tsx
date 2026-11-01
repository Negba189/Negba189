import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, UserPlus, X, Search, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Person,
  type Position,
  type Assignment,
  type AssignmentType,
  type Qualification,
  type PositionRequirement,
  type Unit,
  ASSIGNMENT_TYPE_LABELS,
  getFullName,
} from '@/types';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { useSystemUser } from '@/context/SystemUserContext';

interface AssignmentModalProps {
  open: boolean;
  onClose: () => void;
  position: Position | null;
  unitId?: string;
  onSaved: () => void;
}

export default function AssignmentModal({ open, onClose, position, unitId, onSaved }: AssignmentModalProps) {
  const { toast } = useToast();
  const { canEdit } = useSystemUser();
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [existingAssignments, setExistingAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [personId, setPersonId] = useState('');
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('PERMANENT');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [personQualMap, setPersonQualMap] = useState<Record<string, string[]>>({});
  const [positionReqs, setPositionReqs] = useState<Qualification[]>([]);
  const [activeAssignPersonIds, setActiveAssignPersonIds] = useState<Set<string>>(new Set());
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);

  const requiredQualIds = useMemo(
    () => new Set(Array.isArray(positionReqs) ? positionReqs.map((q) => q.id) : []),
    [positionReqs],
  );

  const personQualIdMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    if (!personQualMap || typeof personQualMap !== 'object') return map;
    
    Object.entries(personQualMap).forEach(([pid, qualNames]) => {
      const idSet = new Set<string>();
      if (Array.isArray(qualNames)) {
        qualNames.forEach((qname) => {
          const found = Array.isArray(positionReqs) ? positionReqs.find((q) => q.name === qname) : null;
          if (found) idSet.add(found.id);
        });
      }
      map[pid] = idSet;
    });
    return map;
  }, [personQualMap, positionReqs]);

  const selectedPersonQualMatch = useMemo(() => {
    if (!personId || requiredQualIds.size === 0) return { hasAll: true, missing: [] as Qualification[] };
    const personQualIds = personQualIdMap[personId] || new Set<string>();
    const missing = Array.isArray(positionReqs) ? positionReqs.filter((q) => !personQualIds.has(q.id)) : [];
    return { hasAll: missing.length === 0, missing };
  }, [personId, requiredQualIds, personQualIdMap, positionReqs]);

  const fetchData = useCallback(async () => {
    if (!position) return;
    setLoading(true);

    let allPersonsData: Person[] = [];
    let page = 0;
    const pageSize = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data: chunk, error: chunkErr } = await supabase
        .from('persons')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('last_name')
        .order('first_name');

      if (chunkErr || !chunk || !Array.isArray(chunk) || chunk.length === 0) {
        fetchMore = false;
      } else {
        allPersonsData = [...allPersonsData, ...(chunk as Person[])];
        if (chunk.length < pageSize) {
          fetchMore = false;
        } else {
          page++;
        }
      }
    }

    const [assignRes, personQualRes, reqRes, unitsRes] = await Promise.all([
      supabase
        .from('assignments')
        .select('*, persons(*)')
        .eq('position_id', position.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase.from('person_qualifications').select('person_id, qualifications(id, name)'),
      supabase.from('position_requirements').select('*, qualifications(*)').eq('position_id', position.id),
      supabase.from('units').select('*'),
    ]);

    setPersons(allPersonsData);
    if (assignRes.data && Array.isArray(assignRes.data)) setExistingAssignments(assignRes.data as Assignment[]);
    if (unitsRes.data && Array.isArray(unitsRes.data)) setUnits(unitsRes.data as Unit[]);
  
    const qualMap: Record<string, string[]> = {};
    const personQualData = personQualRes.data;
    if (personQualData && Array.isArray(personQualData)) {
      personQualData.forEach((pq: any) => {
        const quals = pq?.qualifications;
        const pId = pq?.person_id;
        if (pId && quals) {
          const qualArr = Array.isArray(quals) ? quals : [quals];
          qualArr.forEach((q: any) => {
            if (q?.name) {
              if (!qualMap[pId]) qualMap[pId] = [];
              qualMap[pId].push(q.name);
            }
          });
        }
      });
    }
    setPersonQualMap(qualMap);

    if (reqRes.data && Array.isArray(reqRes.data)) {
      setPositionReqs(
        (reqRes.data as PositionRequirement[])
          .map((r) => r?.qualifications)
          .filter((q): q is Qualification => !!q && typeof q === 'object'),
      );
    }

    const activeIds = new Set<string>();
    const { data: allActive } = await supabase
      .from('assignments')
      .select('person_id, is_active')
      .eq('is_active', true);
      
    if (allActive && Array.isArray(allActive)) {
      (allActive as Array<{ person_id: string; is_active: boolean }>).forEach((a) => {
        if (a && a.is_active && a.person_id) {
          activeIds.add(String(a.person_id));
        }
      });
    }
    setActiveAssignPersonIds(activeIds);

    setLoading(false);
  }, [position]);

  useEffect(() => {
    if (open) {
      setPersonId('');
      setAssignmentType('PERMANENT');
      setNotes('');
      setSearch('');
      setOverrideConfirmed(false);
      fetchData();
    }
  }, [open, fetchData]);

  const filteredPersons = useMemo(() => {
    let result = Array.isArray(persons) ? persons : [];
    const targetUnitId = position?.unit_id || unitId;

    if (targetUnitId && Array.isArray(units) && units.length > 0) {
      const allowedUnitIds = new Set<string>([String(targetUnitId)]);
      
      const findDescendants = (parentId: string) => {
        units.forEach((u) => {
          if (u && u.parent_unit_id && String(u.parent_unit_id) === String(parentId)) {
            allowedUnitIds.add(String(u.id));
            findDescendants(String(u.id));
          }
        });
      };
      findDescendants(String(targetUnitId));

      const findAncestors = (currId: string) => {
        const current = units.find((u) => u && String(u.id) === String(currId));
        if (current && current.parent_unit_id) {
          const parentIdStr = String(current.parent_unit_id);
          if (!allowedUnitIds.has(parentIdStr)) {
            allowedUnitIds.add(parentIdStr);
            findAncestors(parentIdStr);
          }
        }
      };
      findAncestors(String(targetUnitId));

      result = result.filter((p) => {
        if (!p) return false;
        const pUnitId = p.unit_id ? String(p.unit_id) : null;
        return pUnitId && allowedUnitIds.has(pUnitId);
      });
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter((p) => {
        if (!p) return false;
        return (
          getFullName(p).toLowerCase().includes(s) ||
          (p.personal_id || '').toLowerCase().includes(s) ||
          (p.rank || '').toLowerCase().includes(s)
        );
      });
    }

    return result.sort((a, b) => {
      const aAssigned = activeAssignPersonIds.has(String(a?.id));
      const bAssigned = activeAssignPersonIds.has(String(b?.id));
      if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
      return getFullName(a).localeCompare(getFullName(b), 'he');
    });
  }, [persons, units, position, unitId, search, activeAssignPersonIds]);

  const handleSave = async () => {
    if (!position || !personId) {
      toast('נא לבחור אדם לשיוך', 'warning');
      return;
    }
    if (!selectedPersonQualMatch.hasAll && !overrideConfirmed) {
      toast('יש לאשר אזהרת חוסר הסמכה לפני השיוך', 'warning');
      return;
    }
    setSaving(true);
    
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        position_id: position.id,
        person_id: personId,
        assignment_type: assignmentType,
        is_active: true,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      setSaving(false);
      toast('שגיאה בשיוך אדם לתקן: ' + error.message, 'error');
      return;
    }

    const selectedPerson = persons.find((p) => String(p.id) === String(personId));

    if (data) {
      try {
        await supabase.from('audit_logs').insert({
          action: `שיוך ${getFullName(selectedPerson || { first_name: '', last_name: '' })} לתקן "${position.title}" (${ASSIGNMENT_TYPE_LABELS[assignmentType]})`,
          entity_type: 'assignments',
          entity_id: data.id,
          details: {
            position_id: position.id,
            person_id: personId,
            assignment_type: assignmentType,
          },
        });
      } catch (err) {
        console.warn('Audit log skipped due to schema mismatch:', err);
      }
    }

    setSaving(false);
    toast('האדם שויך לתקן בהצלחה');
    onSaved();
    await fetchData();
  };

  const handleDeactivate = async (assignmentId: string, personIdToClear?: string) => {
    const { error } = await supabase
      .from('assignments')
      .update({ is_active: false })
      .eq('id', assignmentId);

    if (error) {
      toast('שגיאה בביטול שיוך: ' + error.message, 'error');
      return;
    }

    if (personIdToClear) {
      await supabase
        .from('assignments')
        .update({ is_active: false })
        .eq('person_id', personIdToClear)
        .eq('is_active', true);
    }

    toast('השיוך בוטל בהצלחה והחייל חזר למצב פנוי');
    
    setActiveAssignPersonIds((prev) => {
      const next = new Set(prev);
      if (personIdToClear) next.delete(personIdToClear);
      return next;
    });

    await fetchData();
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={`איוש תקן${position ? ` - ${position.title}` : ''}`} size="md">
      <div className="space-y-4">
        {Array.isArray(existingAssignments) && existingAssignments.length > 0 && (
          <div>
            <label className="block text-sm text-slate-600 mb-2">שיוכים נוכחיים</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {existingAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-white/50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                      {a.persons?.first_name?.charAt(0)}
                      {a.persons?.last_name?.charAt(0)}
                    </div>
                    <span className="text-sm text-slate-800">
                      {a.persons ? getFullName(a.persons) : '—'}
                    </span>
                    <span
                      className={`badge text-[9px] px-1.5 py-0.5 ${
                        a.assignment_type === 'PERMANENT'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : a.assignment_type === 'ACTING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {ASSIGNMENT_TYPE_LABELS[a.assignment_type]}
                    </span>
                  </div>
                  {a.is_active && (
                    <button
                      onClick={() => handleDeactivate(a.id, a.person_id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="בטל שיוך"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(positionReqs) && positionReqs.length > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3">
            <div className="text-xs text-amber-400 mb-1.5 font-semibold">הסמכות נדרשות לתקן:</div>
            <div className="flex flex-wrap gap-1.5">
              {positionReqs.map((q) => (
                <span
                  key={q.id}
                  className="badge text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20"
                >
                  {q.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {personId && !selectedPersonQualMatch.hasAll && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 animate-fadeIn">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-orange-300 font-semibold mb-1">
                  חוסר התאמת הסמכות
                </div>
                <div className="text-[11px] text-orange-400/80 mb-2">
                  האדם הנבחר חסר את ההסמכות הבאות הנדרשות לתקן זה:
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedPersonQualMatch.missing.map((q) => (
                    <span
                      key={q.id}
                      className="badge text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/25"
                    >
                      {q.name}
                    </span>
                  ))}
                </div>
                {canEdit && (
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={overrideConfirmed}
                      onChange={(e) => setOverrideConfirmed(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-orange-500/40 bg-slate-100 text-orange-500 focus:ring-orange-500/30"
                    />
                    <span className="text-[11px] text-orange-300">
                      מאשר שיוך למרות חוסר ההסמכה (עקיפת הרשאה)
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-300/40">
          <label className="block text-sm text-slate-600 mb-1.5">בחירת אדם לאיוש (מהיחידה, תת-יחידות ויחידת אב בלבד)</label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pr-10 text-sm"
                  placeholder="חיפוש לפי שם, מספר אישי או דרגה..."
                />
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1 bg-white/40 rounded-lg border border-slate-300/40 p-1.5">
                {(!Array.isArray(filteredPersons) || filteredPersons.length === 0) ? (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    לא נמצאו אנשים זמינים במסגרת זו או ברמה אחת מעליה
                  </div>
                ) : (
                  filteredPersons.map((p) => {
                    const isSelected = personId === String(p.id);
                    const isAssigned = activeAssignPersonIds.has(String(p.id));
                    const personQuals = personQualMap[p.id] || [];
                    const hasAllReqs = requiredQualIds.size === 0 ||
                      Array.from(requiredQualIds).every((qId) =>
                        personQuals.some((qn) => Array.isArray(positionReqs) && positionReqs.find((pq) => pq.id === qId && pq.name === qn)),
                      );

                    return (
                      <button
                        key={p.id}
                        onClick={() => setPersonId(String(p.id))}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-right transition-all ${
                          isSelected
                            ? 'bg-brigade-600/20 border border-brigade-500/40'
                            : 'border border-transparent hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 flex-shrink-0">
                          {p.first_name?.charAt(0)}
                          {p.last_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 font-medium truncate">
                            {getFullName(p)}
                            <span className="text-xs text-slate-500 mr-1.5">#{p.personal_id}</span>
                            {p.rank && <span className="text-xs text-slate-600 mr-1">{p.rank}</span>}
                          </div>
                          {personQuals.length > 0 && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {personQuals.slice(0, 4).join(', ')}
                              {personQuals.length > 4 && ` +${personQuals.length - 4}`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isAssigned ? (
                            <span className="badge text-[9px] bg-slate-700/50 text-slate-600 border border-slate-600/40">
                              משויך
                            </span>
                          ) : (
                            <span className="badge text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              פנוי
                            </span>
                          )}
                          {requiredQualIds.size > 0 && (
                            <span className={`flex items-center gap-0.5 text-[10px] ${hasAllReqs ? 'text-emerald-400' : 'text-orange-400'}`}>
                              {hasAllReqs ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                              {hasAllReqs ? 'כשיר' : 'חסר'}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1.5">סוג שיוך</label>
          <div className="grid grid-cols-3 gap-2">
            {(['PERMANENT', 'ACTING', 'TEMPORARY'] as AssignmentType[]).map((type) => (
              <button
                key={type}
                onClick={() => setAssignmentType(type)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                  assignmentType === type
                    ? type === 'PERMANENT'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : type === 'ACTING'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-white/40 text-slate-600 border-slate-300/40 hover:border-slate-600'
                }`}
              >
                {ASSIGNMENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-600 mb-1.5">הערות (אופציונלי)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-field min-h-[60px] resize-none"
            placeholder="הערות נוספות..."
            rows={2}
          />
        </div>

        <div className="flex gap-2 pt-2 border-t border-slate-300/40">
          <button
            key="save-btn"
            onClick={handleSave}
            disabled={saving || !personId || (!selectedPersonQualMatch.hasAll && !overrideConfirmed)}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {saving ? 'שומר...' : 'שייך לתקן'}
          </button>
          <button key="cancel-btn" onClick={onClose} className="btn-secondary flex-1" disabled={saving}>
            ביטול
          </button>
        </div>
      </div>
    </Modal>
  );
}