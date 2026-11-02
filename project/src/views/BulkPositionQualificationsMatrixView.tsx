import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Shield, Save, Loader2, CheckSquare, Square, Filter, CheckCheck, ChevronRight, ChevronLeft, User, Building2, AlertCircle, Target } from 'lucide-react';
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

interface Person {
  id: string | number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  personal_number?: string;
  personal_id?: string;
}

interface PersonRow {
  person_id: string | number;
  full_name: string;
  personal_number: string;
  position_id?: string | number;
  position_title: string;
  unit_id?: string | number;
  unit_path_name?: string;
  unit_depth?: number;
}

export const BulkPersonQualificationsView: React.FC = () => {
  const { toast } = useToast();
  const { canEdit } = useSystemUser();
  const { selectedScopeUnitId } = useUnitScope();

  const [units, setUnits] = useState<Unit[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [personRows, setPersonRows] = useState<PersonRow[]>([]);
  const [positionRequirements, setPositionRequirements] = useState<any[]>([]);
  
  const [matrix, setMatrix] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>('');

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

    setLevel1Id(filteredChain[0] || '');
    setLevel2Id(filteredChain[1] || '');
    setLevel3Id(filteredChain[2] || '');
  }, [selectedScopeUnitId, units]);

  const fetchAllPersons = async (): Promise<Person[]> => {
    let allData: Person[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('persons').select('*').range(from, from + step - 1);
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

  const fetchAllPositions = async (): Promise<Position[]> => {
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

  const fetchAllAssignments = async (): Promise<any[]> => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('assignments').select('*').range(from, from + step - 1);
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

  const fetchAllPositionRequirements = async (): Promise<any[]> => {
    let allData: any[] = [];
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

  const fetchAllPersonQualifications = async (): Promise<any[]> => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase.from('person_qualifications').select('*').range(from, from + step - 1);
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [unitRes, qualRes, personsData, positionsData, assignmentsData, reqsData, personQualsData] = await Promise.all([
          supabase.from('units').select('*').order('name'),
          supabase.from('qualifications').select('*').order('name'),
          fetchAllPersons(),
          fetchAllPositions(),
          fetchAllAssignments(),
          fetchAllPositionRequirements(),
          fetchAllPersonQualifications(),
        ]);

        if (unitRes.error) throw unitRes.error;
        if (qualRes.error) throw qualRes.error;

        setUnits(unitRes.data || []);
        setQualifications(qualRes.data || []);
        setPositionRequirements(reqsData);

        const positionsMap = new Map<string, Position>();
        positionsData.forEach(p => positionsMap.set(String(p.id), p));

        const personsMap = new Map<string, Person>();
        personsData.forEach(p => personsMap.set(String(p.id), p));

        const rowsMap = new Map<string, PersonRow>();
        
        assignmentsData.forEach((a: any) => {
          if (a.is_active === false) return;

          const personId = String(a.person_id || a.soldier_id || '');
          const positionId = String(a.position_id || '');

          const person = personsMap.get(personId);
          const position = positionsMap.get(positionId);

          if (person) {
            const fullName = person.full_name || `${person.first_name || ''} ${person.last_name || ''}`.trim() || 'ללא שם';
            const personalNo = person.personal_number || person.personal_id || '';
            const posTitle = position?.title || 'ללא תקן';
            const unitId = position?.unit_id || person.unit_id;

            rowsMap.set(personId, {
              person_id: personId,
              full_name: fullName,
              personal_number: personalNo,
              position_id: positionId,
              position_title: posTitle,
              unit_id: unitId,
            });
          }
        });

        setPersonRows(Array.from(rowsMap.values()));

        const initialMatrix: Record<string, boolean> = {};
        personQualsData.forEach((pq: any) => {
          const pId = String(pq.person_id || pq.soldier_id || '');
          const qId = String(pq.qualification_id || '');
          if (pId && qId) {
            initialMatrix[`${pId}-${qId}`] = true;
          }
        });
        
        setMatrix(initialMatrix);
        initialMatrixRef.current = { ...initialMatrix };
      } catch (err: any) {
        console.error('Error loading data:', err);
        toast('שגיאה בטעינת נתונים: ' + err.message, 'error');
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

  const availableQualificationsLevel2 = useMemo(() => {
    if (!selectedCategory) return qualifications;
    return qualifications.filter(q => q.category === selectedCategory);
  }, [qualifications, selectedCategory]);

  const filteredQualifications = useMemo(() => {
    if (selectedQualificationId) {
      return qualifications.filter(q => String(q.id) === String(selectedQualificationId));
    }
    return [];
  }, [qualifications, selectedQualificationId]);

  const handleCheckboxChange = (personId: string | number, qualificationId: string | number) => {
    if (!canEdit) {
      toast('אין לך הרשאה לערוך נתונים', 'warning');
      return;
    }
    const key = `${personId}-${qualificationId}`;
    setMatrix(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleColumn = (qualificationId: string | number) => {
    if (!canEdit) {
      toast('אין לך הרשאה לערוך נתונים', 'warning');
      return;
    }

    setMatrix(prev => {
      const updated = { ...prev };
      const allChecked = filteredPersons.every(p => updated[`${p.person_id}-${qualificationId}`]);
      const newState = !allChecked;

      filteredPersons.forEach(p => {
        updated[`${p.person_id}-${qualificationId}`] = newState;
      });

      return updated;
    });
  };

  const handleSaveAll = async () => {
    if (!canEdit) {
      toast('אין לך הרשאה לעדכן נתונים', 'warning');
      return;
    }

    setSaving(true);
    try {
      const toAdd: { person_id: string | number; qualification_id: string | number }[] = [];
      const toRemove: { person_id: string | number; qualification_id: string | number }[] = [];

      const allKeys = new Set([...Object.keys(matrix), ...Object.keys(initialMatrixRef.current)]);

      allKeys.forEach(key => {
        const currentVal = !!matrix[key];
        const initialVal = !!initialMatrixRef.current[key];

        if (currentVal !== initialVal) {
          const [personId, qualId] = key.split('-');
          if (currentVal) {
            toAdd.push({ person_id: personId, qualification_id: qualId });
          } else {
            toRemove.push({ person_id: personId, qualification_id: qualId });
          }
        }
      });

      if (toRemove.length > 0) {
        for (const item of toRemove) {
          const { error: delErr } = await supabase
            .from('person_qualifications')
            .delete()
            .match({ person_id: item.person_id, qualification_id: item.qualification_id });

          if (delErr) throw delErr;
        }
      }

      if (toAdd.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < toAdd.length; i += chunkSize) {
          const chunk = toAdd.slice(i, i + chunkSize);
          const { error: insertErr } = await supabase.from('person_qualifications').insert(chunk);
          if (insertErr) throw insertErr;
        }
      }

      initialMatrixRef.current = { ...matrix };
      toast('הסמכות האנשים עודכנו בהצלחה!');
    } catch (err: any) {
      console.error('Error saving person qualifications:', err);
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

  const getUnitHierarchyPathAndChain = (unitId?: string | number) => {
    if (!unitId) return { path: 'יחידה לא מוגדרת', chain: [] as string[] };
    const unitMap = new Map(units.map(u => [String(u.id), u]));
    const pathNames: string[] = [];
    const chainIds: string[] = [];
    let curr: Unit | undefined = unitMap.get(String(unitId));

    while (curr) {
      pathNames.unshift(curr.name);
      chainIds.unshift(String(curr.id));
      curr = curr.parent_unit_id ? unitMap.get(String(curr.parent_unit_id)) : undefined;
    }
    return { path: pathNames.join(' / '), chain: chainIds };
  };

  // פונקציית עזר לקביעת סדר חשיבות התפקיד (מג"ד קודם, סמג"ד אח"כ, מ"פ ואז השאר)
  const getPositionPriority = (title: string = ''): number => {
    const t = title.trim();
    if (t.includes('מג"ד') || t.includes('מפקד גדוד')) return 1;
    if (t.includes('סמג"ד')) return 2;
    if (t.includes('מ"פ') || t.includes('מפקד פלוגה')) return 3;
    return 4;
  };

  // סינון ומיון חכם לפי עץ היחידות וסדר הפיקוד
  const filteredPersons = useMemo(() => {
    let result = personRows;

    if (selectedQualificationId) {
      const validPositionIds = new Set(
        positionRequirements
          .filter(req => String(req.qualification_id) === String(selectedQualificationId))
          .map(req => String(req.position_id))
      );

      result = result.filter(p => p.position_id && validPositionIds.has(String(p.position_id)));
    } else {
      return []; 
    }

    if (targetUnit && relevantUnitIds.length > 0) {
      result = result.filter(p => p && p.unit_id && relevantUnitIds.includes(String(p.unit_id)));
    }

    if (searchTerm.trim()) {
      const s = searchTerm.trim().toLowerCase();
      result = result.filter(p => {
        const name = (p.full_name || '').toLowerCase();
        const posTitle = (p.position_title || '').toLowerCase();
        const personalNo = (p.personal_number || '').toLowerCase();
        return name.includes(s) || posTitle.includes(s) || personalNo.includes(s);
      });
    }

    // מיון לפי עץ היחידות ולאחר מכן לפי סדר חשיבות התפקיד
    result.sort((a, b) => {
      const unitA = getUnitHierarchyPathAndChain(a.unit_id);
      const unitB = getUnitHierarchyPathAndChain(b.unit_id);

      // השוואת שרשרת היחידות ברמת ההיררכיה
      const minLen = Math.min(unitA.chain.length, unitB.chain.length);
      for (let i = 0; i < minLen; i++) {
        if (unitA.chain[i] !== unitB.chain[i]) {
          return unitA.chain[i].localeCompare(unitB.chain[i], 'he');
        }
      }
      if (unitA.chain.length !== unitB.chain.length) {
        return unitA.chain.length - unitB.chain.length;
      }

      // באותה היחידה – מיון לפי סדר תפקידים (מג"ד -> סמג"ד -> מ"פ)
      const priorityA = getPositionPriority(a.position_title);
      const priorityB = getPositionPriority(b.position_title);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return (a.full_name || '').localeCompare(b.full_name || '', 'he');
    });

    return result;
  }, [personRows, positionRequirements, selectedQualificationId, targetUnit, relevantUnitIds, searchTerm, units]);

  const totalPages = Math.ceil(filteredPersons.length / pageSize) || 1;
  
  const paginatedPersons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPersons.slice(start, start + pageSize);
  }, [filteredPersons, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [level1Id, level2Id, level3Id, searchTerm, selectedCategory, selectedQualificationId]);

  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-screen text-slate-900" dir="rtl">
      
      {/* כותרת ראשית קומפקטית */}
      <div className="flex items-center justify-between bg-white border border-slate-200 px-5 py-3 rounded-xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-600">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900">הכנסה גורפת של הסמכות ללוחמים</h1>
            <p className="text-[11px] text-slate-500">עדכון מהיר של הסמכות קיימות בפועל עבור התקנים הנדרשים</p>
          </div>
        </div>
        {selectedQualificationId && (
          <button
            onClick={handleSaveAll}
            disabled={saving || loading}
            className="btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold shadow-xs transition-all"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'מעדכן...' : 'שמור שינויים'}
          </button>
        )}
      </div>

      {/* אזור הסינונים - מסודר מימין לשמאל בסרט אחד נוח */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          
          {/* סינון יחידות היררכי (5 עמודות) */}
          <div className="lg:col-span-5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-cyan-600" />
              <span>סינון לפי יחידה היררכית:</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={level1Id}
                onChange={(e) => {
                  setLevel1Id(e.target.value);
                  setLevel2Id('');
                  setLevel3Id('');
                }}
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer"
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
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
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
                className="bg-slate-50 text-xs text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer disabled:opacity-50"
              >
                <option value="">– רמה 3 –</option>
                {Array.isArray(level3Units) && level3Units.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* סינון קטגוריה (3 עמודות) */}
          <div className="lg:col-span-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-indigo-600" />
              <span>קטגוריית הסמכה:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedQualificationId(''); 
              }}
              className="bg-slate-50 text-xs text-slate-800 p-2 rounded-lg border border-slate-200 outline-none cursor-pointer w-full"
            >
              <option value="">– כל הקטגוריות –</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* סינון הסמכה ספציפית (4 עמודות) */}
          <div className="lg:col-span-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-cyan-600" />
              <span>הסמכה ספציפית (חובה):</span>
            </div>
            <select
              value={selectedQualificationId}
              onChange={(e) => setSelectedQualificationId(e.target.value)}
              disabled={!selectedCategory && availableQualificationsLevel2.length === 0}
              className="bg-cyan-50/60 text-xs text-slate-900 p-2 rounded-lg border border-cyan-200 outline-none cursor-pointer w-full disabled:opacity-50 font-bold"
            >
              <option value="">– בחר הסמכה ספציפית לפתיחת הטבלה –</option>
              {availableQualificationsLevel2.map(q => (
                <option key={q.id} value={q.id}>{q.name}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* תצוגה מותנית: אם לא נבחרה הסמכה ספציפית */}
      {!selectedQualificationId ? (
        <div className="flex flex-col items-center justify-center h-[320px] bg-white border border-slate-200 rounded-xl shadow-xs text-slate-500 space-y-3 p-6 text-center">
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-full border border-cyan-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">נדרש לבחור הסמכה ספציפית</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              בחר קטגוריה והסמכה ספציפית ברמה 2 כדי להציג את טבלת הלוחמים והתקנים הדורשים הסמכה זו.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* סרגל חיפוש ומונה תוצאות קומפקטי */}
          <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="w-full max-w-sm">
              <div className="relative">
                <input
                  type="text"
                  placeholder="חיפוש מהיר לפי שם לוחם, מספר אישי..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-field text-xs w-full pl-3 pr-8 py-1.5 bg-slate-50"
                />
                <Filter className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
              מוצגים <span className="font-bold text-cyan-600">{filteredPersons.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span>–<span className="font-bold text-cyan-600">{Math.min(currentPage * pageSize, filteredPersons.length)}</span> מתוך <span className="font-bold text-slate-800">{filteredPersons.length}</span> לוחמים
            </div>
          </div>

          {/* טבלת הנתונים המפורקת ל-4 עמודות מסודרות לפי עץ היחידה */}
          {loading ? (
            <div className="flex items-center justify-center h-[300px] bg-white border border-slate-200 rounded-xl shadow-xs">
              <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
            </div>
          ) : paginatedPersons.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] bg-white border border-slate-200 rounded-xl shadow-xs text-slate-500 text-xs">
              לא נמצאו לוחמים משובצים לתקנים הדורשים הסמכה זו תחת תנאי הסינון.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full border-collapse text-right text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="p-2.5 font-bold border-l border-slate-200 w-[28%]">
                        עץ היחידה
                      </th>
                      <th className="p-2.5 font-bold border-l border-slate-200 w-[25%]">
                        התקן
                      </th>
                      <th className="p-2.5 font-bold border-l border-slate-200 w-[30%]">
                        הלוחם המשובץ
                      </th>
                      {filteredQualifications.map((q) => {
                        const allColChecked = filteredPersons.length > 0 && filteredPersons.every(p => matrix[`${p.person_id}-${q.id}`]);

                        return (
                          <th key={q.id} className="p-2.5 font-bold text-center w-[17%] bg-slate-100" title={q.name}>
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-black text-slate-900 truncate max-w-[180px]" title={q.name}>{q.name}</span>
                              <button
                                type="button"
                                onClick={() => handleToggleColumn(q.id)}
                                className="text-[10px] text-cyan-700 hover:text-cyan-900 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded flex items-center gap-1 transition-colors font-bold cursor-pointer"
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
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPersons.map((person) => {
                      const unitHierarchyStr = getUnitHierarchyPathAndChain(person.unit_id).path;

                      return (
                        <tr key={person.person_id} className="hover:bg-cyan-50/20 transition-colors">
                          <td className="p-2.5 border-l border-slate-100 text-slate-600 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate" title={unitHierarchyStr}>{unitHierarchyStr}</span>
                            </div>
                          </td>

                          <td className="p-2.5 border-l border-slate-100 font-semibold text-cyan-800">
                            <div className="flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-cyan-600 flex-shrink-0" />
                              <span className="truncate" title={person.position_title}>{person.position_title}</span>
                            </div>
                          </td>

                          <td className="p-2.5 border-l border-slate-100 font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <div className="p-1 bg-indigo-50 text-indigo-600 rounded">
                                <User className="w-3.5 h-3.5" />
                              </div>
                              <span className="truncate">{person.full_name}</span>
                              {person.personal_number && (
                                <span className="text-[11px] font-mono text-slate-400 font-normal">({person.personal_number})</span>
                              )}
                            </div>
                          </td>

                          {filteredQualifications.map((qual) => {
                            const key = `${person.person_id}-${qual.id}`;
                            const isChecked = !!matrix[key];

                            return (
                              <td key={qual.id} className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleCheckboxChange(person.person_id, qual.id)}
                                  className="inline-flex items-center justify-center p-1 rounded-lg hover:bg-cyan-100/50 transition-all cursor-pointer group"
                                  title="שנה סטטוס הסמכה"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="w-5 h-5 text-cyan-600 transition-transform group-hover:scale-110" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-300 transition-transform group-hover:scale-110" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* פגינציה קומפקטית */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border-t border-slate-200 text-xs">
                <div className="text-slate-500 font-mono text-[11px]">
                  עמוד <span className="font-bold text-slate-800">{currentPage}</span> מתוך <span className="font-bold text-slate-800">{totalPages}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold transition-colors cursor-pointer text-xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5" /> הקודם
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-bold transition-colors cursor-pointer text-xs"
                  >
                    הבא <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* כפתור שמירה תחתון */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-sm transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'מעדכן נתונים...' : 'שמור שינויים'}
            </button>
          </div>
        </>
      )}

    </div>
  );
};

export default BulkPersonQualificationsView;
