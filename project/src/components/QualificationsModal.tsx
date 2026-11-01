import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X, Award, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Person,
  type Qualification,
  type PersonQualification,
  type Position,
  type Assignment,
  type PositionRequirement,
  getFullName,
} from '@/types';
import Modal from '@/components/Modal';
import { useToast } from '@/components/Toast';

interface QualificationsModalProps {
  open: boolean;
  onClose: () => void;
  person: Person | null;
  onChanged: () => void;
}

interface MissingReqInfo {
  positionTitle: string;
  missingQuals: Qualification[];
}

export default function QualificationsModal({ open, onClose, person, onChanged }: QualificationsModalProps) {
  const { toast } = useToast();
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [personQuals, setPersonQuals] = useState<PersonQualification[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedQualId, setSelectedQualId] = useState('');
  const [personAssignments, setPersonAssignments] = useState<Assignment[]>([]);
  const [positionsMap, setPositionsMap] = useState<Record<string, Position>>({});
  const [positionReqs, setPositionReqs] = useState<PositionRequirement[]>([]);

  const fetchData = useCallback(async () => {
    if (!person) return;
    setLoading(true);
    const [qualRes, personQualRes, assignRes, posRes, reqRes] = await Promise.all([
      supabase.from('qualifications').select('*').order('name'),
      supabase
        .from('person_qualifications')
        .select('*, qualifications(*)')
        .eq('person_id', person.id),
      supabase
        .from('assignments')
        .select('*, positions(*)')
        .eq('person_id', person.id)
        .eq('is_active', true),
      supabase.from('positions').select('*'),
      supabase.from('position_requirements').select('*, qualifications(*)'),
    ]);
    if (qualRes.data) setQualifications(qualRes.data as Qualification[]);
    if (personQualRes.data) setPersonQuals(personQualRes.data as PersonQualification[]);
    if (assignRes.data) setPersonAssignments(assignRes.data as Assignment[]);
    if (posRes.data) {
      const map: Record<string, Position> = {};
      (posRes.data as Position[]).forEach((p) => { map[p.id] = p; });
      setPositionsMap(map);
    }
    if (reqRes.data) setPositionReqs(reqRes.data as PositionRequirement[]);
    setLoading(false);
  }, [person]);

  useEffect(() => {
    if (open) {
      setSelectedQualId('');
      fetchData();
    }
  }, [open, fetchData]);

  // Compute missing requirements for assigned positions
  const missingRequirements = useCallback((): MissingReqInfo[] => {
    const personQualIds = new Set(personQuals.map((pq) => pq.qualification_id));
    const result: MissingReqInfo[] = [];
    personAssignments.forEach((a) => {
      const pos = a.positions || positionsMap[a.position_id];
      if (!pos) return;
      const reqs = positionReqs.filter((r) => r.position_id === pos.id);
      const missing = reqs
        .map((r) => r.qualifications)
        .filter((q): q is Qualification => !!q && !personQualIds.has(q.id));
      if (missing.length > 0) {
        result.push({ positionTitle: pos.title, missingQuals: missing });
      }
    });
    return result;
  }, [personQuals, personAssignments, positionsMap, positionReqs]);

  const handleAddQualification = async () => {
    if (!person || !selectedQualId) {
      toast('נא לבחור הסמכה', 'warning');
      return;
    }
    if (personQuals.some((pq) => pq.qualification_id === selectedQualId)) {
      toast('האדם כבר מחזיק בהסמכה זו', 'warning');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('person_qualifications').insert({
      person_id: person.id,
      qualification_id: selectedQualId,
    });
    setSaving(false);
    if (error) {
      toast('שגיאה בהוספת הסמכה: ' + error.message, 'error');
      return;
    }

    const qual = qualifications.find((q) => q.id === selectedQualId);
    try {
      await supabase.from('audit_logs').insert({
        action: `הוספת הסמכה "${qual?.name || ''}" ל${getFullName(person)}`,
        entity_type: 'person_qualifications',
        entity_id: person.id,
        details: { qualification_id: selectedQualId },
      });
    } catch {
      // Suppress audit log secondary errors
    }

    toast('ההסמכה נוספה בהצלחה');
    setSelectedQualId('');
    fetchData();
    onChanged();
  };

  const handleRemoveQualification = async (pqId: string, qualName: string) => {
    if (!person) return;
    setSaving(true);
    const { error } = await supabase.from('person_qualifications').delete().eq('id', pqId);
    setSaving(false);
    if (error) {
      toast('שגיאה בהסרת הסמכה: ' + error.message, 'error');
      return;
    }

    try {
      await supabase.from('audit_logs').insert({
        action: `הסרת הסמכה "${qualName}" מ${getFullName(person)}`,
        entity_type: 'person_qualifications',
        entity_id: person.id,
        details: { qualification_id: pqId },
      });
    } catch {
      // Suppress audit log secondary errors
    }

    toast('ההסמכה הוסרה');
    fetchData();
    onChanged();
  };

  const personQualIds = new Set(personQuals.map((pq) => pq.qualification_id));
  const availableQuals = qualifications.filter((q) => !personQualIds.has(q.id));
  const missingReqs = missingRequirements();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? `הסמכות - ${getFullName(person)}` : 'הסמכות'}
      size="md"
    >
      <div className="space-y-4">
        {/* Current assignments context */}
        {personAssignments.length > 0 && (
          <div className="bg-white/50 rounded-lg p-3 border border-slate-300/40">
            <div className="text-xs text-slate-500 mb-1.5">מאויש כעת בתקנים:</div>
            <div className="flex flex-wrap gap-1.5">
              {personAssignments.map((a) => (
                <span
                  key={a.id}
                  className="badge text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  {a.positions?.title || 'תקן לא ידוע'}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing requirements warning */}
        {missingReqs.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 animate-fadeIn">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-orange-300 font-semibold mb-1.5">
                  חסרות הסמכות נדרשות לתקנים
                </div>
                {missingReqs.map((mr, idx) => (
                  <div key={idx} className="mb-1.5 last:mb-0">
                    <div className="text-[11px] text-orange-400/80 mb-1">{mr.positionTitle}:</div>
                    <div className="flex flex-wrap gap-1">
                      {mr.missingQuals.map((q) => (
                        <span
                          key={q.id}
                          className="badge text-[10px] bg-orange-500/15 text-orange-300 border border-orange-500/25"
                        >
                          {q.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Current qualifications */}
        <div>
          <label className="block text-sm text-slate-600 mb-2 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            <span>הסמכות נוכחיות</span>
            <span className="text-xs text-slate-500">({personQuals.length})</span>
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            </div>
          ) : personQuals.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              <AlertCircle className="w-6 h-6 mx-auto mb-1 opacity-50" />
              אין הסמכות רשומות
            </div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {personQuals.map((pq) => (
                <div
                  key={pq.id}
                  className="flex items-center gap-2 bg-white/50 rounded-lg px-3 py-2 group justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-slate-800 font-medium truncate">
                      {pq.qualifications?.name || '—'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveQualification(pq.id, pq.qualifications?.name || '')}
                    disabled={saving}
                    className="p-1 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                    title="הסר הסמכה"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add qualification */}
        {availableQuals.length > 0 && (
          <div className="pt-2 border-t border-slate-300/40">
            <label className="block text-sm text-slate-600 mb-1.5">הוספת הסמכה חדשה</label>
            <div className="flex gap-2">
              <select
                value={selectedQualId}
                onChange={(e) => setSelectedQualId(e.target.value)}
                className="input-field flex-1"
                disabled={loading || saving}
              >
                <option value="">בחר הסמכה...</option>
                {availableQuals.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}{q.category ? ` (${q.category})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddQualification}
                disabled={saving || !selectedQualId}
                className="btn-primary flex items-center gap-1.5 px-3"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>הוסף</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-300/40">
          <button onClick={onClose} className="btn-secondary w-full">
            סגור
          </button>
        </div>
      </div>
    </Modal>
  );
}
