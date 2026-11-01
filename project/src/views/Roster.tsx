import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Phone,
  User as UserIcon,
  Filter,
  X,
  Award,
  CheckCircle2,
  MinusCircle,
  Download,
  Printer,
  Building2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Person,
  type Unit,
  type Position,
  type Qualification,
  MILITARY_RANKS,
  SERVICE_STATUSES,
  getServiceStatusColor,
  getFullName,
  calculateAge,
} from '@/types';
import Modal from '@/components/Modal';
import QualificationsModal from '@/components/QualificationsModal';
import { SkeletonRow } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import { useUnitScope } from '@/context/UnitScopeContext';
import { useSystemUser } from '@/context/SystemUserContext';
import { exportToCSV, printReport, timestampForFilename } from '@/lib/exportUtils';

interface PersonForm {
  personal_id: string;
  first_name: string;
  last_name: string;
  rank: string;
  service_status: string;
  phone_number: string;
  birth_date: string;
  unit_id: string;
}

const EMPTY_FORM: PersonForm = {
  personal_id: '',
  first_name: '',
  last_name: '',
  rank: 'לוחם',
  service_status: 'מילואים',
  phone_number: '',
  birth_date: '',
  unit_id: '',
};

export default function Roster() {
  const { toast } = useToast();
  const { canEdit } = useSystemUser();
  const { descendantIds: scopeDescendantIds } = useUnitScope();
  const [persons, setPersons] = useState<Person[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [personQualCounts, setPersonQualCounts] = useState<Record<string, number>>({});
  const [personQualNames, setPersonQualNames] = useState<Record<string, string[]>>({});
  const [personQualIdMap, setPersonQualIdMap] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rankFilter, setRankFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [qualFilterId, setQualFilterId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [qualModalOpen, setQualModalOpen] = useState(false);
  const [qualPerson, setQualPerson] = useState<Person | null>(null);

  const [formLevel1, setFormLevel1] = useState('');
  const [formLevel2, setFormLevel2] = useState('');
  const [formLevel3, setFormLevel3] = useState('');

  const [allQualifications, setAllQualifications] = useState<Qualification[]>([]);
  const [initialQualIds, setInitialQualIds] = useState<Set<string>>(new Set());

  // פונקציה לשליפת כל האנשים בפעימות (עוקפת את מגבלת ה-1000 שורות של Supabase)
  const fetchAllPersons = async () => {
    let allData: Record<string, unknown>[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('persons')
        .select(
          `*,
           assignments!left(
             id,
             assignment_type,
             is_active,
             positions(
               id,
               title,
               unit_id,
               units(id, name)
             )
           )`,
        )
        .order('last_name')
        .order('first_name')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching persons chunk:', error);
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

  const fetchPersons = useCallback(async () => {
    setLoading(true);
    const [qualRes, unitsRes] = await Promise.all([
      supabase.from('person_qualifications').select('person_id, qualification_id, qualifications(id, name)'),
      supabase.from('units').select('id, name'),
    ]);

    const personsData = await fetchAllPersons();

    const unitsMap = new Map((unitsRes.data || []).map((u: { id: number | string; name: string }) => [String(u.id), u]));

    const mapped = personsData.map((row: Record<string, unknown>) => {
      const assignments = (row.assignments as Array<{
        id: string;
        assignment_type: string;
        is_active: boolean;
        positions: {
          id: string;
          title: string;
          unit_id: string | number;
          units: { id: string | number; name: string } | null;
        } | null;
      }> | null) ?? [];

      const activeAssignment = assignments.find((a) => a.is_active);
      const directUnitId = row.unit_id ? String(row.unit_id) : null;
      const positionUnitId = activeAssignment?.positions?.unit_id ? String(activeAssignment.positions.unit_id) : null;
      const directUnit = directUnitId ? unitsMap.get(directUnitId) : null;

      return {
        ...(row as unknown as Person),
        unit_id: directUnitId || positionUnitId,
        positions: activeAssignment?.positions ?? null,
        units: activeAssignment?.positions?.units ?? directUnit ?? null,
      } as Person;
    });

    setPersons(mapped);

    const counts: Record<string, number> = {};
    const qualNames: Record<string, string[]> = {};
    const qualIdMap: Record<string, Set<string>> = {};

    (qualRes.data || []).forEach((pq: {
      person_id: string;
      qualification_id: string;
      qualifications: { id: string; name: string }[] | null;
    }) => {
      counts[pq.person_id] = (counts[pq.person_id] || 0) + 1;
      if (!qualIdMap[pq.person_id]) qualIdMap[pq.person_id] = new Set();
      qualIdMap[pq.person_id].add(pq.qualification_id);
      const quals = pq.qualifications;
      if (quals && quals.length > 0 && quals[0]?.name) {
        if (!qualNames[pq.person_id]) qualNames[pq.person_id] = [];
        qualNames[pq.person_id].push(quals[0].name);
      }
    });

    setPersonQualCounts(counts);
    setPersonQualNames(qualNames);
    setPersonQualIdMap(qualIdMap);
    setLoading(false);
  }, []);

  const fetchSupportData = useCallback(async () => {
    const [uRes, qualRes] = await Promise.all([
      supabase.from('units').select('*').order('name'),
      supabase.from('qualifications').select('*').order('name'),
    ]);
    if (uRes.data) setUnits(uRes.data as Unit[]);
    if (qualRes.data) setAllQualifications(qualRes.data as Qualification[]);
  }, []);

  useEffect(() => {
    fetchPersons();
    fetchSupportData();
  }, [fetchPersons, fetchSupportData]);

  const modalLevel1Units = useMemo(() => {
    const rootIds = new Set(units.filter(u => !u.parent_unit_id).map(u => u.id));
    const directChildren = units.filter(u => u.parent_unit_id && rootIds.has(u.parent_unit_id));
    return directChildren.length > 0 ? directChildren : units.filter(u => u.parent_unit_id);
  }, [units]);

  const modalLevel2Units = useMemo(() => {
    if (!formLevel1) return [];
    return units.filter(u => String(u.parent_unit_id) === String(formLevel1));
  }, [units, formLevel1]);

  const modalLevel3Units = useMemo(() => {
    if (!formLevel2) return [];
    return units.filter(u => String(u.parent_unit_id) === String(formLevel2));
  }, [units, formLevel2]);

  useEffect(() => {
    if (formLevel3) {
      setForm(prev => ({ ...prev, unit_id: formLevel3 }));
    } else if (formLevel2) {
      setForm(prev => ({ ...prev, unit_id: formLevel2 }));
    } else if (formLevel1) {
      setForm(prev => ({ ...prev, unit_id: formLevel1 }));
    } else {
      setForm(prev => ({ ...prev, unit_id: '' }));
    }
  }, [formLevel1, formLevel2, formLevel3]);

  const scopedUnitIds = useMemo(() => {
    if (!scopeDescendantIds) return null;
    return scopeDescendantIds;
  }, [scopeDescendantIds]);

  const filteredPersons = useMemo(() => {
    return persons.filter((p) => {
      if (scopedUnitIds && scopedUnitIds.size > 0) {
        // המרת כל מזהי הסקופ למחרוזות להשוואה בטוחה (מונע בעיית מספרים מול מחרוזות)
        const scopeStrings = new Set(Array.from(scopedUnitIds).map(id => String(id)));

        const personUnitId = p.unit_id ? String(p.unit_id) : null;
        const positionUnitId = p.positions?.unit_id ? String(p.positions.unit_id) : null;
        
        const belongsToScope = 
          (personUnitId && scopeStrings.has(personUnitId)) || 
          (positionUnitId && scopeStrings.has(positionUnitId));

        if (!belongsToScope) return false;
      }

      const fullName = getFullName(p).toLowerCase();
      const pid = (p.personal_id || '').toLowerCase();
      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        fullName.includes(searchLower) ||
        pid.includes(searchLower) ||
        (p.rank || '').toLowerCase().includes(searchLower);
      const matchRank = !rankFilter || p.rank === rankFilter;
      const matchStatus = !statusFilter || p.service_status === statusFilter;

      const isAssigned = !!p.positions?.title;
      const matchAssignment =
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned' && isAssigned) ||
        (assignmentFilter === 'unassigned' && !isAssigned);

      const matchQual = !qualFilterId || (personQualIdMap[p.id] && personQualIdMap[p.id].has(qualFilterId));

      return matchSearch && matchRank && matchStatus && matchAssignment && matchQual;
    });
  }, [persons, search, rankFilter, statusFilter, assignmentFilter, qualFilterId, scopedUnitIds, personQualIdMap]);
  
  const openAddModal = () => {
    setEditPerson(null);
    setForm(EMPTY_FORM);
    setFormLevel1('');
    setFormLevel2('');
    setFormLevel3('');
    setInitialQualIds(new Set());
    setModalOpen(true);
  };

  const openEditModal = (person: Person) => {
    setEditPerson(person);
    const uId = person.unit_id ? String(person.unit_id) : '';
    setForm({
      personal_id: person.personal_id,
      first_name: person.first_name,
      last_name: person.last_name,
      rank: person.rank || '',
      service_status: person.service_status || 'מילואים',
      phone_number: person.phone_number || '',
      birth_date: person.birth_date || '',
      unit_id: uId,
    });

    if (uId) {
      const u3 = units.find(u => String(u.id) === uId);
      if (u3 && u3.parent_unit_id) {
        const u2 = units.find(u => String(u.id) === String(u3.parent_unit_id));
        if (u2 && u2.parent_unit_id) {
          setFormLevel1(String(u2.parent_unit_id));
          setFormLevel2(String(u2.id));
          setFormLevel3(String(u3.id));
        } else {
          setFormLevel1(String(u3.parent_unit_id));
          setFormLevel2(String(u3.id));
          setFormLevel3('');
        }
      } else {
        setFormLevel1(uId);
        setFormLevel2('');
        setFormLevel3('');
      }
    } else {
      setFormLevel1('');
      setFormLevel2('');
      setFormLevel3('');
    }

    setInitialQualIds(new Set());
    setModalOpen(true);
  };

  const openQualModal = (person: Person) => {
    setQualPerson(person);
    setQualModalOpen(true);
  };

  const toggleInitialQual = (qualId: string) => {
    setInitialQualIds((prev) => {
      const next = new Set(prev);
      if (next.has(qualId)) next.delete(qualId);
      else next.add(qualId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.personal_id.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      toast('נא למלא מספר אישי, שם פרטי ושם משפחה', 'warning');
      return;
    }
    setSaving(true);

    const personPayload = {
      personal_id: form.personal_id.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      rank: form.rank && form.rank !== '' ? form.rank : null,
      service_status: form.service_status || 'מילואים',
      phone_number: form.phone_number || null,
      birth_date: form.birth_date || null,
      unit_id: form.unit_id ? Number(form.unit_id) : null,
    };

    if (editPerson) {
      const { error: updateError } = await supabase
        .from('persons')
        .update(personPayload)
        .eq('id', editPerson.id);
      if (updateError) {
        setSaving(false);
        toast('שגיאה בעדכון אדם: ' + updateError.message, 'error');
        return;
      }

      setSaving(false);
      toast('פרטי האדם עודכנו בהצלחה');
    } else {
      const { data: newPerson, error: insertError } = await supabase
        .from('persons')
        .insert(personPayload)
        .select('id')
        .single();

      if (insertError) {
        setSaving(false);
        toast('שגיאה בהוספת אדם: ' + insertError.message, 'error');
        return;
      }

      if (newPerson && initialQualIds.size > 0) {
        const qualRows = Array.from(initialQualIds).map((qualId) => ({
          person_id: newPerson.id,
          qualification_id: qualId,
        }));
        await supabase.from('person_qualifications').insert(qualRows);
      }

      setSaving(false);
      toast('החייל נוסף בהצלחה ושויך ליחידה');
    }
    setModalOpen(false);
    fetchPersons();
  };

  const handleDelete = async (person: Person) => {
    if (!confirm(`האם למחוק את ${getFullName(person)}?`)) return;
    const { error } = await supabase.from('persons').delete().eq('id', person.id);
    if (error) {
      toast('שגיאה במחיקה: ' + error.message, 'error');
      return;
    }
    toast('האדם נמחק מהמאגר');
    fetchPersons();
  };

  const clearFilters = () => {
    setRankFilter('');
    setStatusFilter('');
    setAssignmentFilter('all');
    setQualFilterId('');
    setSearch('');
  };

  const hasFilters = rankFilter || statusFilter || search || assignmentFilter !== 'all' || qualFilterId;

  const assignedCount = filteredPersons.filter((p) => p.positions?.title).length;
  const unassignedCount = filteredPersons.length - assignedCount;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pr-10"
              placeholder="חיפוש לפי שם, מספר אישי או דרגה..."
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-blue-500/40' : ''}`}
          >
            <Filter className="w-4 h-4" />
            <span>סינון</span>
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-400" />}
          </button>
          {canEdit && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>הוסף חייל</span>
            </button>
          )}
          <button
            onClick={() => {
              const rows = filteredPersons.map((p) => ({
                personalId: p.personal_id,
                fullName: getFullName(p),
                rank: p.rank || '',
                serviceStatus: p.service_status || '',
                unit: p.units?.name || '',
                position: p.positions?.title || '',
                phone: p.phone_number || '',
                quals: (personQualNames[p.id] || []).join('; '),
              }));
              exportToCSV(rows, `רשימת_אנשים_${timestampForFilename()}.csv`, [
                { key: 'personalId', label: 'מספר אישי' },
                { key: 'fullName', label: 'שם מלא' },
                { key: 'rank', label: 'דרגה' },
                { key: 'serviceStatus', label: 'סטטוס' },
                { key: 'unit', label: 'מסגרת/יחידה' },
                { key: 'position', label: 'תקן' },
                { key: 'phone', label: 'טלפון' },
                { key: 'quals', label: 'הסמכות' },
              ]);
              toast('הרשימה יוצאה בהצלחה');
            }}
            className="btn-secondary flex items-center gap-2 no-print"
            title="ייצוא ל-CSV"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">ייצוא</span>
          </button>
          <button
            onClick={printReport}
            className="btn-secondary flex items-center gap-2 no-print"
            title="הדפסה"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">הדפסה</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-300/60 animate-slideDown">
            <select
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="">כל הדרגות</option>
              {MILITARY_RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="">כל סטטוסי שירות</option>
              {SERVICE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="assigned">משויכים לתקן</option>
              <option value="unassigned">לא משויכים</option>
            </select>
            <select
              value={qualFilterId}
              onChange={(e) => setQualFilterId(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="">כל ההסמכות</option>
              {allQualifications.map((q) => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 text-sm">
                <X className="w-3.5 h-3.5" />
                <span>נקה</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-600 px-1 flex-wrap">
        <span><strong className="text-slate-800">{filteredPersons.length}</strong> אנשים</span>
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <strong className="text-emerald-400">{assignedCount}</strong> משויכים
        </span>
        <span className="flex items-center gap-1">
          <MinusCircle className="w-3.5 h-3.5 text-slate-500" />
          <strong className="text-slate-600">{unassignedCount}</strong> לא משויכים
        </span>
        {hasFilters && <span className="text-slate-500">מתוך {persons.length} בסה"כ</span>}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/60 text-slate-600 text-xs uppercase border-b border-slate-300/60">
                <th className="text-right px-4 py-3 font-medium">מספר אישי</th>
                <th className="text-right px-4 py-3 font-medium">שם מלא</th>
                <th className="text-right px-4 py-3 font-medium">דרגה</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">גיל</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">הסמכות עיקריות</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס שיוך</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">מסגרת / יחידה</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">תקן</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">טלפון</th>
                <th className="text-center px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-200/40">
                    <SkeletonRow columns={9} />
                  </tr>
                ))
              ) : filteredPersons.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-500">
                    <UserIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>{hasFilters ? 'לא נמצאו תוצאות' : 'אין אנשים במאגר'}</p>
                  </td>
                </tr>
              ) : (
                filteredPersons.map((person, idx) => {
                  const qualCount = personQualCounts[person.id] || 0;
                  const qualNames = personQualNames[person.id] || [];
                  const isAssigned = !!person.positions?.title;
                  return (
                    <tr
                      key={person.id}
                      className={`border-b border-slate-200/40 hover:bg-slate-100/30 transition-colors animate-fadeIn ${
                        idx % 2 === 0 ? '' : 'bg-white/20'
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-600 font-mono text-xs">{person.personal_id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {person.first_name.charAt(0)}
                            {person.last_name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-slate-800 font-medium">{getFullName(person)}</span>
                            {person.service_status && (
                              <span className={`badge text-[9px] mr-1.5 ${getServiceStatusColor(person.service_status)}`}>
                                {person.service_status}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{person.rank || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                        {(() => {
                          const age = calculateAge(person.birth_date);
                          return age !== null ? (
                            <span className="text-slate-600">{age}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {qualNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {qualNames.slice(0, 3).map((name, i) => (
                              <span
                                key={i}
                                className="badge text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20"
                              >
                                {name}
                              </span>
                            ))}
                            {qualNames.length > 3 && (
                              <span className="text-[10px] text-slate-500" title={qualNames.join(', ')}>
                                +{qualNames.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          canEdit ? (
                            <button
                              onClick={() => openQualModal(person)}
                              className="text-[11px] text-slate-500 hover:text-amber-400 transition-colors"
                            >
                              ללא הסמכות
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-600">ללא הסמכות</span>
                          )
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAssigned ? (
                          <span className="badge text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            משויך
                          </span>
                        ) : (
                          <span className="badge text-[11px] bg-slate-700/40 text-slate-600 border border-slate-600/40 flex items-center gap-1 w-fit">
                            <MinusCircle className="w-3 h-3" />
                            לא משויך
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                        {person.units?.name ? (
                          <span className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium">
                            <Building2 className="w-3.5 h-3.5 opacity-70" />
                            {person.units.name}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                        {person.positions?.title || <span className="text-slate-600">ללא תקן</span>}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {person.phone_number ? (
                          <span className="flex items-center gap-1 text-slate-600 text-xs">
                            <Phone className="w-3 h-3" />
                            {person.phone_number}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openQualModal(person)}
                              className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
                              title={`הסמכות (${qualCount})`}
                            >
                              <Award className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => openEditModal(person)}
                              className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
                              title="ערוך"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(person)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-100 rounded-lg transition-all"
                              title="מחק"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPerson ? `עריכת ${getFullName(editPerson)}` : 'הוספת חייל חדש'}
        size="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">מספר אישי <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.personal_id}
              onChange={(e) => setForm({ ...form, personal_id: e.target.value })}
              className="input-field"
              placeholder="0000000"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">טלפון</label>
            <input
              type="text"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="input-field"
              placeholder="050-0000000"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">תאריך לידה</label>
            <input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">שם פרטי <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              className="input-field"
              placeholder="ישראל"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">שם משפחה <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              className="input-field"
              placeholder="ישראלי"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">דרגה (אופציונלי)</label>
            <select
              value={form.rank}
              onChange={(e) => setForm({ ...form, rank: e.target.value })}
              className="input-field"
            >
              <option value="">לא הוזן</option>
              {MILITARY_RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">סטטוס שירות</label>
            <select
              value={form.service_status}
              onChange={(e) => setForm({ ...form, service_status: e.target.value })}
              className="input-field"
            >
              {SERVICE_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-sm text-slate-600 font-semibold">שיוך היררכי ליחידה (3 רמות)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={formLevel1}
                onChange={(e) => {
                  setFormLevel1(e.target.value);
                  setFormLevel2('');
                  setFormLevel3('');
                }}
                className="input-field text-xs"
              >
                <option value="">-- רמה 1: יחידה ראשית --</option>
                {modalLevel1Units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                ))}
              </select>

              <select
                value={formLevel2}
                onChange={(e) => {
                  setFormLevel2(e.target.value);
                  setFormLevel3('');
                }}
                disabled={!formLevel1}
                className="input-field text-xs disabled:opacity-50"
              >
                <option value="">-- רמה 2: יחידה כפופה --</option>
                {modalLevel2Units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                ))}
              </select>

              <select
                value={formLevel3}
                onChange={(e) => setFormLevel3(e.target.value)}
                disabled={!formLevel2 || modalLevel3Units.length === 0}
                className="input-field text-xs disabled:opacity-50"
              >
                <option value="">-- רמה 3: תת-יחידה --</option>
                {modalLevel3Units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
                ))}
              </select>
            </div>
          </div>

          {!editPerson && allQualifications.length > 0 && (
            <div className="sm:col-span-2">
              <label className="block text-sm text-slate-600 mb-2 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                <span>הסמכות / כישורים ראשוניים</span>
                <span className="text-xs text-slate-500">({initialQualIds.size} נבחרו)</span>
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto bg-white/40 rounded-lg p-3 border border-slate-300/40">
                {allQualifications.map((q) => {
                  const selected = initialQualIds.has(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleInitialQual(q.id)}
                      className={`badge text-[11px] px-2.5 py-1 transition-all cursor-pointer ${
                        selected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-100 text-slate-600 border border-slate-300/40 hover:border-amber-500/30 hover:text-amber-300'
                      }`}
                    >
                      {selected && <CheckCircle2 className="w-3 h-3 inline ml-1" />}
                      {q.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-4 mt-4 border-t border-slate-300/60">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'שומר...' : editPerson ? 'עדכן' : 'הוסף'}
          </button>
          <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
            ביטול
          </button>
        </div>
      </Modal>

      <QualificationsModal
        open={qualModalOpen}
        onClose={() => setQualModalOpen(false)}
        person={qualPerson}
        onChanged={fetchPersons}
      />
    </div>
  );
}