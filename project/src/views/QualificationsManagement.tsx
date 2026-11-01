import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Award,
  X,
  Loader2,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type Qualification, QUALIFICATION_CATEGORIES, getCategoryColor } from '@/types';
import Modal from '@/components/Modal';
import { SkeletonRow } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import { useSystemUser } from '@/context/SystemUserContext';

interface QualForm {
  name: string;
  description: string;
  category: string;
}

const EMPTY_FORM: QualForm = { name: '', description: '', category: '' };

export default function QualificationsManagement() {
  const { toast } = useToast();
  //  שינוי מרכזי: שימוש בהרשאה הנכונה מתוך הקונטקסט
  const { canManagePositionsAndQuals } = useSystemUser();
  
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [personCounts, setPersonCounts] = useState<Record<string, number>>({});
  const [reqCounts, setReqCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editQual, setEditQual] = useState<Qualification | null>(null);
  const [form, setForm] = useState<QualForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [qualRes, personQualRes, reqRes] = await Promise.all([
      supabase.from('qualifications').select('*').order('name'),
      supabase.from('person_qualifications').select('qualification_id'),
      supabase.from('position_requirements').select('qualification_id'),
    ]);
    if (qualRes.error) {
      toast('שגיאה בטעינת הסמכות: ' + qualRes.error.message, 'error');
      setLoading(false);
      return;
    }
    setQualifications((qualRes.data || []) as Qualification[]);

    const pCounts: Record<string, number> = {};
    (personQualRes.data || []).forEach((pq: { qualification_id: string }) => {
      pCounts[pq.qualification_id] = (pCounts[pq.qualification_id] || 0) + 1;
    });
    setPersonCounts(pCounts);

    const rCounts: Record<string, number> = {};
    (reqRes.data || []).forEach((pr: { qualification_id: string }) => {
      rCounts[pr.qualification_id] = (rCounts[pr.qualification_id] || 0) + 1;
    });
    setReqCounts(rCounts);

    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredQuals = useMemo(() => {
    return qualifications.filter((q) => {
      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        q.name.toLowerCase().includes(searchLower) ||
        (q.description || '').toLowerCase().includes(searchLower);
      const matchCategory = !categoryFilter || q.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [qualifications, search, categoryFilter]);

  const openAddModal = () => {
    if (!canManagePositionsAndQuals) return;
    setEditQual(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (qual: Qualification) => {
    if (!canManagePositionsAndQuals) return;
    setEditQual(qual);
    setForm({
      name: qual.name,
      description: qual.description || '',
      category: qual.category || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!canManagePositionsAndQuals) {
      toast('אין הרשאה לבצע פעולה זו', 'error');
      return;
    }
    if (!form.name.trim()) {
      toast('נא להזין שם הסמכה', 'warning');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category || null,
    };

    if (editQual) {
      const { error } = await supabase
        .from('qualifications')
        .update(payload)
        .eq('id', editQual.id);
      setSaving(false);
      if (error) {
        toast('שגיאה בעדכון הסמכה: ' + error.message, 'error');
        return;
      }
      toast('ההסמכה עודכנה בהצלחה');
    } else {
      const { error } = await supabase.from('qualifications').insert(payload);
      setSaving(false);
      if (error) {
        toast('שגיאה בהוספת הסמכה: ' + error.message, 'error');
        return;
      }
      toast('ההסמכה נוספה בהצלחה');
    }
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async (qual: Qualification) => {
    if (!canManagePositionsAndQuals) {
      toast('אין הרשאה לבצע פעולה זו', 'error');
      return;
    }
    const personUsage = personCounts[qual.id] || 0;
    const reqUsage = reqCounts[qual.id] || 0;
    const totalUsage = personUsage + reqUsage;
    const warning =
      totalUsage > 0
        ? `\n\nהסמכה זו משויכת ל-${personUsage} אנשים ו-${reqUsage} תקנים. מחיקה תסיר את כל השיוכים.`
        : '';
    if (!confirm(`האם למחוק את ההסמכה "${qual.name}"?${warning}`)) return;

    await supabase.from('person_qualifications').delete().eq('qualification_id', qual.id);
    await supabase.from('position_requirements').delete().eq('qualification_id', qual.id);

    const { error } = await supabase.from('qualifications').delete().eq('id', qual.id);
    if (error) {
      toast('שגיאה במחיקת הסמכה: ' + error.message, 'error');
      return;
    }
    toast('ההסמכה נמחקה');
    fetchData();
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pr-10"
              placeholder="חיפוש הסמכה לפי שם או תיאור..."
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
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field sm:w-44"
          >
            <option value="">כל הקטגוריות</option>
            {QUALIFICATION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {/* בדיקת הרשאה מעודכנת */}
          {canManagePositionsAndQuals && (
            <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>הוסף הסמכה חדשה</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-slate-600 px-1 flex-wrap">
        <span>
          <strong className="text-slate-800">{filteredQuals.length}</strong> הסמכות
        </span>
        {(search || categoryFilter) && (
          <span className="text-slate-500">מתוך {qualifications.length} בסה"כ</span>
        )}
      </div>

      {/* Qualifications table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/60 text-slate-600 text-xs uppercase border-b border-slate-300/60">
                <th className="text-right px-4 py-3 font-medium">שם ההסמכה</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">קטגוריה</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">תיאור</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">אנשים</th>
                <th className="text-center px-4 py-3 font-medium hidden sm:table-cell">תקנים</th>
                <th className="text-right px-4 py-3 font-medium hidden lg:table-cell">תאריך יצירה</th>
                {canManagePositionsAndQuals && <th className="text-center px-4 py-3 font-medium">פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-200/40">
                    <SkeletonRow columns={canManagePositionsAndQuals ? 7 : 6} />
                  </tr>
                ))
              ) : filteredQuals.length === 0 ? (
                <tr>
                  <td colSpan={canManagePositionsAndQuals ? 7 : 6} className="text-center py-16 text-slate-500">
                    <Award className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>{search || categoryFilter ? 'לא נמצאו תוצאות' : 'אין הסמכות מוגדרות'}</p>
                  </td>
                </tr>
              ) : (
                filteredQuals.map((qual, idx) => {
                  const personCount = personCounts[qual.id] || 0;
                  const reqCount = reqCounts[qual.id] || 0;
                  return (
                    <tr
                      key={qual.id}
                      className={`border-b border-slate-200/40 hover:bg-slate-100/30 transition-colors animate-fadeIn ${
                        idx % 2 === 0 ? '' : 'bg-white/20'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                            <Award className="w-4 h-4 text-amber-400" />
                          </div>
                          <span className="text-slate-800 font-medium">{qual.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {qual.category ? (
                          <span className={`badge text-[10px] ${getCategoryColor(qual.category)}`}>
                            {qual.category}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                        {qual.description ? (
                          <span className="line-clamp-2 max-w-xs">{qual.description}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {personCount > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-emerald-400">
                            <Users className="w-3 h-3" />
                            <span className="font-medium">{personCount}</span>
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        {reqCount > 0 ? (
                          <span className="badge text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {reqCount}
                          </span>
                        ) : (
                          <span className="text-slate-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                        {formatDate(qual.created_at)}
                      </td>
                      {canManagePositionsAndQuals && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditModal(qual)}
                              className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
                              title="ערוך"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(qual)}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-100 rounded-lg transition-all"
                              title="מחק"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Qualification Modal */}
      {canManagePositionsAndQuals && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editQual ? `עריכת הסמכה: ${editQual.name}` : 'הוספת הסמכה חדשה'}
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">
                שם ההסמכה <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder='לדוגמה: חובש קרבי, נהג דוד, מפעיל רחפן, רישיון ג'
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">קטגוריה</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="input-field"
              >
                <option value="">ללא קטגוריה</option>
                {QUALIFICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">תיאור</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field min-h-[80px] resize-y"
                placeholder="תיאור אופציונלי של ההסמכה..."
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4 mt-2 border-t border-slate-300/60">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {editQual ? 'עדכן' : 'הוסף'}
              </button>
              <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
                ביטול
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}