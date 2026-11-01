import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Save, Loader2, CheckSquare, Square, Filter, CheckCheck, ChevronRight, ChevronLeft, Target } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { useSystemUser } from '@/context/SystemUserContext';
import { useUnitScope } from '@/context/UnitScopeContext';

interface Position {
  id: string | number;
  title: string;
  unit_id?: string | number;
}

interface Qualification {
  id: string | number;
  name: string;
  category?: string;
}

interface Unit {
  id: string | number;
  name: string;
  unit_type: string;
  parent_unit_id?: string | number;
}

export const PositionQualificationsMatrixView: React.FC = () => {
  const { toast } = useToast();
  const { canEdit } = useSystemUser();
  const { selectedScopeUnitId } = useUnitScope();

  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [exactMatch, setExactMatch] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // שמירת מצב הנתונים המקורי מהשרת לצורך השוואת שינויים (Delta)
  const initialMatrixRef = useRef<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 100; 

  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  useEffect(() => {
    if (!selectedScopeUnitId || !Array.isArray(units) || units.length === 0) {
      return;
    }

    const chain: string[] = [];
    let currId: string | null = String(selectedScopeUnitId);

    while (currId) {
      const u = units.find(item => String(item.id) === currId);
      if (!u) break;
      chain.unshift(String(u.id));
      currId = u.parent_unit_id ? String(u.parent_unit_id) : null;
    }

    const filteredChain = chain.filter(id => id !== '189');

    const newL1 = filteredChain[0] || '';
    const newL2 = filteredChain[1] || '';
    const newL3 = filteredChain[2] || '';

    setLevel1Id(prev => (prev !== newL1 ? newL1 : prev));
    setLevel2Id(prev => (prev !== newL2 ? newL2 : prev));
    setLevel3Id(prev => (prev !== newL3 ? newL3 : prev));
  }, [selectedScopeUnitId, units]);

  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('id, title, unit_id')
        .range(from, from + step - 1);

      if (error) { 
        console.error('Error fetching positions:', error); 
        break; 
      }
      
      if (data && Array.isArray(data) && data.length > 0) {
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
    let allRequirements: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('position_requirements')
        .select('position_id, qualification_id')
        .range(from, from + step - 1);

      if (error) {
        console.error('Error fetching requirements chunk:', error);
        break;
      }

      if (data && data.length > 0) {
        allRequirements = [...allRequirements, ...data];
        if (data.length < step) {
          keepFetching = false;
        } else {
          from += step;
        }
      } else {
        keepFetching = false;
      }
    }
    return allRequirements;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [unitRes, qualRes, reqsData, allPositions] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('qualifications').select('*').order('name'),
          fetchAllRequirements(),
          fetchAllPositions(),
        ]);

        if (unitRes.error) throw unitRes.error;
        if (qualRes.error) throw qualRes.error;

        setUnits(unitRes.data || []);
        setQualifications(qualRes.data || []);
        setPositions(allPositions);

        const initialMatrix: Record<string, boolean> = {};
        reqsData.forEach((req: any) => {
          const key = `${req.position_id}-${req.qualification_id}`;
          initialMatrix[key] = true;
        });
        
        setMatrix(initialMatrix);
        initialMatrixRef.current = { ...initialMatrix }; // שמירת העתק של המצב המקורי
      } catch (err: any) {
        console.error('Error loading matrix data:', err);
        toast('שגיאה בטעינת נתוני המטריצה: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    qualifications.forEach(q => {
      if (q.category) cats.add(q.category);
    });
    return Array.from(cats);
  }, [qualifications]);

  const filteredQualifications = useMemo(() => {
    if (!selectedCategory) return qualifications;
    return qualifications.filter(q => q.category === selectedCategory);
  }, [qualifications, selectedCategory]);

  const handleCheckboxChange = (positionId: string | number, qualificationId: string | number) => {
    if (!canEdit) {
      toast('אין לך הרשאה לערוך הגדרות מערכת', 'warning');
      return;
    }
    const key = `${positionId}-${qualificationId}`;
    setMatrix(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleColumn = (qualificationId: string | number) => {
    if (!canEdit) {
      toast('אין לך הרשאה לערוך הגדרות מערכת', 'warning');
      return;
    }

    setMatrix(prev => {
      const updated = { ...prev };
      const allCurrentlyChecked = filteredPositions.every(pos => updated[`${pos.id}-${qualificationId}`]);
      const newState = !allCurrentlyChecked;

      filteredPositions.forEach(pos => {
        updated[`${pos.id}-${qualificationId}`] = newState;
      });

      return updated;
    });
  };

  // שמירה חכמה מבוססת הפרשים (Delta - רק השינויים שבוצעו)
  const handleSaveAll = async () => {
    if (!canEdit) {
      toast('אין לך הרשאה לעדכן נתונים', 'warning');
      return;
    }

    setSaving(true);
    try {
      const toAdd: { position_id: string | number; qualification_id: string | number }[] = [];
      const toRemove: { position_id: string | number; qualification_id: string | number }[] = [];

      const allKeys = new Set([...Object.keys(matrix), ...Object.keys(initialMatrixRef.current)]);

      allKeys.forEach(key => {
        const currentVal = !!matrix[key];
        const initialVal = !!initialMatrixRef.current[key];

        if (currentVal !== initialVal) {
          const [posId, qualId] = key.split('-');
          if (currentVal) {
            toAdd.push({ position_id: posId, qualification_id: qualId });
          } else {
            toRemove.push({ position_id: posId, qualification_id: qualId });
          }
        }
      });

      // ביצוע מחיקות של מה שהוסר (במידה ויש)
      if (toRemove.length > 0) {
        for (const item of toRemove) {
          const { error: delErr } = await supabase
            .from('position_requirements')
            .delete()
            .match({ position_id: item.position_id, qualification_id: item.qualification_id });

          if (delErr) throw delErr;
        }
      }

      // ביצוע הוספות של מה שסומן חדש (במידה ויש) בקבוצות של 500
      if (toAdd.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < toAdd.length; i += chunkSize) {
          const chunk = toAdd.slice(i, i + chunkSize);
          const { error: insertErr } = await supabase.from('position_requirements').insert(chunk);
          if (insertErr) throw insertErr;
        }
      }

      // עדכון ה-Ref למצב הנוכחי לאחר הצלחה
      initialMatrixRef.current = { ...matrix };

      toast('דרישות ההסמכות לתקנים עודכנו בהצלחה!');
    } catch (err: any) {
      console.error('Error saving requirements matrix:', err);
      toast('שגיאה בשמירת הנתונים: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const level1Units = useMemo(() => {
    if (!units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id !== null && String(u.parent_unit_id) === '189');
  }, [units]);

  const level2Units = useMemo(() => {
    if (!level1Id || !units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level1Id));
  }, [units, level1Id]);

  const level3Units = useMemo(() => {
    if (!level2Id || !units || !Array.isArray(units)) return [];
    return units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(level2Id));
  }, [units, level2Id]);

  const targetUnit = useMemo(() => {
    if (!Array.isArray(units)) return null;
    if (level3Id) return units.find(u => u && String(u.id) === String(level3Id)) || null;
    if (level2Id) return units.find(u => u && String(u.id) === String(level2Id)) || null;
    if (level1Id) return units.find(u => u && String(u.id) === String(level1Id)) || null;
    return null;
  }, [units, level1Id, level2Id, level3Id]);

  const relevantUnitIds = useMemo(() => {
    if (!targetUnit) return [];
    const subUnits = units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(targetUnit.id));
    const subSubUnitIds: string[] = [];
    subUnits.forEach(sub => {
      const children = units.filter(u => u && u.parent_unit_id && String(u.parent_unit_id) === String(sub.id));
      children.forEach(c => subSubUnitIds.push(String(c.id)));
    });
    return [String(targetUnit.id), ...subUnits.map(s => String(s.id)), ...subSubUnitIds];
  }, [targetUnit, units]);

  const filteredPositions = useMemo(() => {
    let result = positions;

    if (targetUnit && relevantUnitIds.length > 0) {
      result = result.filter(p => p && p.unit_id && relevantUnitIds.includes(String(p.unit_id)));
    }

    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      result = result.filter(p => {
        const title = (p.title || '').toLowerCase();
        if (exactMatch) {
          return title === s;
        }
        return title.includes(s);
      });
    }

    return result;
  }, [positions, targetUnit, relevantUnitIds, searchTerm, exactMatch]);

  const totalPages = Math.ceil(filteredPositions.length / pageSize) || 1;
  
  const paginatedPositions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPositions.slice(start, start + pageSize);
  }, [filteredPositions, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [level1Id, level2Id, level3Id, searchTerm, exactMatch, selectedCategory]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-900" dir="rtl">
      
      <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-600">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">ניהול מטריצת הסמכות לתקנים</h1>
            <p className="text-xs text-slate-500">הגדרת דרישות כשירות והסמכות רוחביות לכלל התקנים במערכת</p>
          </div>
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving || loading}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-xs font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'מעדכן נתונים...' : 'עדכון הסמכות'}
        </button>
      </div>

      <div className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter className="w-4 h-4 text-cyan-600" />
              <span>סינון היררכי לפי יחידה:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={level1Id}
                onChange={(e) => {
                  setLevel1Id(e.target.value);
                  setLevel2Id('');
                  setLevel3Id('');
                }}
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer"
              >
                <option value="">– רמה 1 –</option>
                {Array.isArray(level1Units) && level1Units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <select
                value={level2Id}
                onChange={(e) => {
                  setLevel2Id(e.target.value);
                  setLevel3Id('');
                }}
                disabled={!level1Id}
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="">– רמה 2 –</option>
                {Array.isArray(level2Units) && level2Units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <select
                value={level3Id}
                onChange={(e) => setLevel3Id(e.target.value)}
                disabled={!level2Id}
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="">– רמה 3 –</option>
                {Array.isArray(level3Units) && level3Units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>סינון הסמכות לפי קטגוריה:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer w-full"
            >
              <option value="">– כל הקטגוריות (הצג הכל) –</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 w-full max-w-lg">
          <div className="flex items-center gap-2 w-full">
            <Filter className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            <input
              type="text"
              placeholder="חיפוש תקן לפי כותרת..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field text-xs w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setExactMatch(!exactMatch)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex-shrink-0 ${
              exactMatch 
                ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' 
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="הצג רק תקנים שהשם שלהם זהה מדויק לטקסט החיפוש"
          >
            <Target className="w-3.5 h-3.5" />
            התאמה מדויקת
          </button>
        </div>

        <div className="text-xs font-mono text-slate-500 whitespace-nowrap">
          מוצגים תקנים <span className="font-bold text-cyan-600">{filteredPositions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> עד <span className="font-bold text-cyan-600">{Math.min(currentPage * pageSize, filteredPositions.length)}</span> מתוך <span className="font-bold text-slate-800">{filteredPositions.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[350px] bg-white border border-slate-200 rounded-2xl shadow-sm">
          <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
        </div>
      ) : paginatedPositions.length === 0 || filteredQualifications.length === 0 ? (
        <div className="flex items-center justify-center h-[350px] bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-500 text-sm">
          לא נמצאו תקנים או הסמכות התואמים את תנאי הסינון.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full border-collapse text-right">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200">
                <tr>
                  <th className="p-3 text-xs font-black text-slate-700 min-w-[220px] bg-slate-100 sticky right-0 z-20 border-l border-slate-200">
                    שם התקן
                  </th>
                  {filteredQualifications.map((q) => {
                    const allColChecked = filteredPositions.length > 0 && filteredPositions.every(pos => matrix[`${pos.id}-${q.id}`]);

                    return (
                      <th key={q.id} className="p-2 text-[11px] font-bold text-slate-700 text-center min-w-[130px] max-w-[150px] border-l border-slate-200 bg-slate-100" title={q.name}>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className="truncate w-full" title={q.name}>{q.name}</span>
                          {q.category && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-normal">
                              {q.category}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleToggleColumn(q.id)}
                            className="text-[10px] text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors mt-0.5"
                            title="סמן/בטל הכל לעמודה זו"
                          >
                            <CheckCheck className="w-3 h-3" />
                            {allColChecked ? 'בטל הכל' : 'סמן הכל'}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedPositions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800 bg-white sticky right-0 z-10 border-l border-slate-200 shadow-sm">
                      {pos.title}
                    </td>
                    {filteredQualifications.map((qual) => {
                      const key = `${pos.id}-${qual.id}`;
                      const isChecked = !!matrix[key];

                      return (
                        <td key={qual.id} className="p-3 text-center border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleCheckboxChange(pos.id, qual.id)}
                            className="inline-flex items-center justify-center p-1 rounded hover:bg-cyan-50 transition-colors"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-cyan-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs">
            <div className="text-slate-500 font-mono">
              עמוד <span className="font-bold text-slate-800">{currentPage}</span> מתוך <span className="font-bold text-slate-800">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold"
              >
                <ChevronRight className="w-4 h-4" /> הקודם
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold"
              >
                הבא <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveAll}
          disabled={saving || loading}
          className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'מעדכן נתונים...' : 'עדכון הסמכות'}
        </button>
      </div>

    </div>
  );
};

export default PositionQualificationsMatrixView;