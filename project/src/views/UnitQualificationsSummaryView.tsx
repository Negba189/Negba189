import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Award, 
  BookOpen, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  Layers, 
  Filter, 
  BarChart3, 
  Loader2, 
  ArrowRightLeft,
  ShieldCheck,
  Briefcase
} from 'lucide-react';
import { useUnitScope } from '@/context/UnitScopeContext';
import { 
  type Unit, 
  type Position, 
  type Assignment, 
  type PositionRequirement, 
  type PersonQualification 
} from '@/types';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

export default function UnitQualificationsView() {
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rawAssignments, setRawAssignments] = useState<Assignment[]>([]);
  const [rawReqs, setRawReqs] = useState<any[]>([]);
  const [rawPersonQuals, setRawPersonQuals] = useState<any[]>([]);
  const [allQualifications, setAllQualifications] = useState<any[]>([]);
  const [unitPersonsMap, setUnitPersonsMap] = useState<Record<string, any[]>>({});

  // פילטר קטגוריה נבחרת לטבלה המרכזית
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // סינון היררכי (3 רמות)
  const [level1Id, setLevel1Id] = useState<string>(''); 
  const [level2Id, setLevel2Id] = useState<string>(''); 
  const [level3Id, setLevel3Id] = useState<string>(''); 

  // פונקציות שליפה עם עקיפת מגבלת 1000 שורות של Supabase
  const fetchAllPositions = async () => {
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

  // 1. שליפת שיבוצים פעילים עם לולאה מלאה
  const fetchAllAssignments = async () => {
    let allData: Assignment[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, persons(*)')
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

  // 2. שליפת דרישות תקנים במלואן ללא מגבלת 1000 שורות
  const fetchAllPositionRequirements = async () => {
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

  // 3. שליפת הסמכות אישיות במלואן ללא מגבלת 1000 שורות
  const fetchAllPersonQualifications = async () => {
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

  // 4. פונקציית הטעינה המרכזית המעודכנת
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [unitRes, qualRes, personQualList, reqList, posList, assignList] = await Promise.all([
        supabase.from('units').select('*').order('name'),
        supabase.from('qualifications').select('*'),
        fetchAllPersonQualifications(),
        fetchAllPositionRequirements(),
        fetchAllPositions(),
        fetchAllAssignments(),
      ]);

      // הנה ההדפסה הבטוחה והנכונה אחרי ש-reqList הוגדר
      console.log('Raw Requirements Loaded (reqList):', reqList);
      console.log('Total Requirements Count:', reqList?.length || 0);

      if (unitRes.data) setUnits(unitRes.data as Unit[]);
      if (qualRes.data) setAllQualifications(qualRes.data);
      setRawPersonQuals(personQualList);
      setRawReqs(reqList);
      setPositions(posList);
      setRawAssignments(assignList);

      const unitAssignedPersons: Record<string, any[]> = {};
      assignList.forEach((a: any) => {
        let pObj = a.persons || a.person;
        if (Array.isArray(pObj)) pObj = pObj[0];
        const targetUnitId = a.unit_id || (a.positions?.unit_id);
        if (targetUnitId && pObj) {
          const uKey = String(targetUnitId);
          if (!unitAssignedPersons[uKey]) unitAssignedPersons[uKey] = [];
          if (!unitAssignedPersons[uKey].some(e => String(e.id) === String(pObj.id))) {
            unitAssignedPersons[uKey].push(pObj);
          }
        }
      });
      setUnitPersonsMap(unitAssignedPersons);

    } catch (err) {
      console.error('Error fetching qualifications data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const descendantMaps = useMemo(() => buildDescendantMaps(units), [units]);

  // רמות סינון היררכיות (3 רמות)
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

  // תיקון: ברירת המחדל היא null (כלל המערכת), אלא אם כן המשתמש בחר יחידה בהיררכיה
  const currentSelectedUnit = useMemo(() => {
    if (!Array.isArray(units)) return null;
    if (level3Id) return units.find(u => String(u.id) === String(level3Id)) || null;
    if (level2Id) return units.find(u => String(u.id) === String(level2Id)) || null;
    if (level1Id) return units.find(u => String(u.id) === String(level1Id)) || null;
    return null; // ששום דבר לא נבחר - מוצג כלל הארגון החטיבתי/מערכתי במלואו
  }, [units, level1Id, level2Id, level3Id]);

  // מזהי יחידות רלוונטיות בסקופ הנבחר
  const unitIdsToInclude = useMemo(() => {
    if (!currentSelectedUnit) {
      const allIds = new Set<string>();
      units.forEach(u => allIds.add(String(u.id)));
      return allIds;
    }
    const set = new Set<string>([String(currentSelectedUnit.id)]);
    const descSet = descendantMaps[currentSelectedUnit.id];
    if (descSet) descSet.forEach(id => set.add(String(id)));
    return set;
  }, [currentSelectedUnit, units, descendantMaps]);

  // עיבוד נתונים קריטיים וחישוב מדדים מפורטים לפי הסקופ הנבחר
  const qualificationMetrics = useMemo(() => {
    // 1. איסוף כל התקנים והשיבוצים במסגרת הנבחרת
    // תקנים רלוונטיים בסקופ (ללא תלות ב-is_active אם אינו מוגדר)
    const scopedPositions = positions.filter(
      p => p.unit_id && (p.is_active === true || p.is_active === undefined || p.is_active === null) && unitIdsToInclude.has(String(p.unit_id))
    );
    const scopedPositionIds = new Set(scopedPositions.map(p => String(p.id)));

    // שיבוצים פעילים בתקנים של המסגרת
    const scopedAssignments = rawAssignments.filter(
      a => a.position_id && scopedPositionIds.has(String(a.position_id))
    );

    // חיילים ייחודיים ששייכים למסגרת
    const uniquePersonsInScope = new Set<string>();
    unitIdsToInclude.forEach(uId => {
      const list = unitPersonsMap[uId] || [];
      list.forEach(p => { if (p && p.id) uniquePersonsInScope.add(String(p.id)); });
    });
    scopedAssignments.forEach(a => {
      const pId = a.person_id || (a.persons ? a.persons.id : null);
      if (pId) uniquePersonsInScope.add(String(pId));
    });

    // מיפוי איזה חייל מחזיק באילו הסמכות
    const personHasQualMap = new Map<string, Set<string>>(); // personId -> Set<qualId>
    rawPersonQuals.forEach(pq => {
      const pId = String(pq.person_id);
      const qId = String(pq.qualification_id);
      if (!personHasQualMap.has(pId)) personHasQualMap.set(pId, new Set());
      personHasQualMap.get(pId)!.add(qId);
    });

    // מיפוי אילו הסמכות נדרשות לאיזה תקן
    const positionReqsMap = new Map<string, Set<string>>(); // positionId -> Set<qualId>
    rawReqs.forEach(r => {
      const posId = String(r.position_id);
      const qId = String(r.qualification_id);
      if (!positionReqsMap.has(posId)) positionReqsMap.set(posId, new Set());
      positionReqsMap.get(posId)!.add(qId);
    });

    // 2. בניית שורות הטבלה לכל הסמכה קיימת במערכת
    const qualRowsMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      requiredInStandard: number; // נדרש בתקינה
      certifiedInUnit: number;    // בעלי הסמכה כללי ביחידה
      assignedCertified: number;  // משובצים כשירים
      gapCount: number;           // פער כשירות (נדרש פחות משובצים כשירים בתקנים דורשים)
    }>();

    allQualifications.forEach(q => {
      qualRowsMap.set(String(q.id), {
        id: String(q.id),
        name: q.name || 'הסמכה ללא שם',
        category: q.category || 'כללי',
        requiredInStandard: 0,
        certifiedInUnit: 0,
        assignedCertified: 0,
        gapCount: 0
      });
    });

    // א. חישוב "בעלי הסמכה" (כמה חיילים בסקופ מחזיקים בהסמכה, ללא קשר לתפקיד)
    uniquePersonsInScope.forEach(pId => {
      const pQuals = personHasQualMap.get(pId);
      if (pQuals) {
        pQuals.forEach(qId => {
          const row = qualRowsMap.get(qId);
          if (row) {
            row.certifiedInUnit += 1;
          }
        });
      }
    });

    // ב. חישוב "נדרש בתקינה" ו"משובצים כשירים" ברמת התקנים
    scopedPositions.forEach(pos => {
      const posId = String(pos.id);
      const reqQuals = positionReqsMap.get(posId);
      if (!reqQuals) return;

      const posAssignments = scopedAssignments.filter(a => String(a.position_id) === posId);
      const assignedPerson = posAssignments.length === 1 ? posAssignments[0] : null;
      const assignedPersonId = assignedPerson ? String(assignedPerson.person_id || assignedPerson.persons?.id) : null;
      const personQuals = assignedPersonId ? personHasQualMap.get(assignedPersonId) : null;

      reqQuals.forEach(qId => {
        const row = qualRowsMap.get(qId);
        if (row) {
          row.requiredInStandard += 1; // תקן המחייב הסמכה זו

          // האם החייל שמשובץ לתקן אכן מחזיק בהסמכה?
          if (assignedPersonId && personQuals && personQuals.has(qId)) {
            row.assignedCertified += 1;
          }
        }
      });
    });

    // ג. חישוב הפער לכל הסמכה: נדרש בתקינה פחות משובצים כשירים
    qualRowsMap.forEach(row => {
      row.gapCount = Math.max(0, row.requiredInStandard - row.assignedCertified);
    });

    const tableRows = Array.from(qualRowsMap.values());

    // 3. סיכום לפי 6 קטגוריות עבור הכרטיסיות העליונות (א)
    const categorySummaryMap = new Map<string, { category: string; required: number; certified: number; gap: number }>();
    
    tableRows.forEach(row => {
      const cat = row.category;
      const existing = categorySummaryMap.get(cat) || { category: cat, required: 0, certified: 0, gap: 0 };
      existing.required += row.requiredInStandard;
      existing.certified += row.assignedCertified;
      existing.gap += row.gapCount;
      categorySummaryMap.set(cat, existing);
    });

    return {
      tableRows,
      categorySummary: Array.from(categorySummaryMap.values()),
      totalUniquePersons: uniquePersonsInScope.size,
      totalScopedPositions: scopedPositions.length,
      totalScopedAssignments: scopedAssignments.length
    };
  }, [positions, rawAssignments, rawReqs, rawPersonQuals, allQualifications, unitIdsToInclude, unitPersonsMap]);

  // סינון טבלת ההסמכות לפי קטגוריה נבחרת
  const filteredTableRows = useMemo(() => {
    if (selectedCategoryFilter === 'ALL') return qualificationMetrics.tableRows;
    return qualificationMetrics.tableRows.filter(r => r.category === selectedCategoryFilter);
  }, [qualificationMetrics.tableRows, selectedCategoryFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[500px] bg-slate-50 rounded-2xl">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      
      {/* כותרת ראשית */}
      <div className="card p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold mb-1">
            <Award className="w-4 h-4" />
            <span>סטטוס קורסים והסמכות | תמונת כשירות מקצועית</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">ניהול והשוואת פערֵי הסמכות וכשירות מקצועית</h1>
          <p className="text-xs text-slate-300 mt-1">
            {currentSelectedUnit ? `נתונים עבור מסגרת: ${currentSelectedUnit.name}` : 'תמונת מצב כלל מערכתית'}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs font-mono text-indigo-200">
          חיילים ייחודיים בסקופ: {qualificationMetrics.totalUniquePersons} | תקנים: {qualificationMetrics.totalScopedPositions}
        </div>
      </div>

      {/* סרגל סינון היררכי (3 רמות) */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-cyan-600" />
          <span>סינון היררכי מסגרת:</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={level1Id}
            onChange={(e) => { setLevel1Id(e.target.value); setLevel2Id(''); setLevel3Id(''); }}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer"
          >
            <option value="">– רמה 1 (יחידת אב) –</option>
            {level1Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>

          <select
            value={level2Id}
            onChange={(e) => { setLevel2Id(e.target.value); setLevel3Id(''); }}
            disabled={!level1Id}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– רמה 2 (פלוגה) –</option>
            {level2Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>

          <select
            value={level3Id}
            onChange={(e) => setLevel3Id(e.target.value)}
            disabled={!level2Id}
            className="bg-slate-50 text-xs text-slate-800 p-2.5 rounded-xl border border-slate-200 outline-none cursor-pointer disabled:opacity-40"
          >
            <option value="">– רמה 3 (מחלקה) –</option>
            {level3Units.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
            ))}
          </select>
        </div>
      </div>

      {/* א. סיכום הסמכות לפי קטגוריות (6 כרטיסיות עליונות) */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span>סיכום כשירות לפי קטגוריות הסמכה</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {qualificationMetrics.categorySummary.map((cat, idx) => {
            const pct = cat.required > 0 ? Math.round((cat.certified / cat.required) * 100) : 100;
            return (
              <div 
                key={idx} 
                onClick={() => setSelectedCategoryFilter(cat.category)}
                className={`card p-4 bg-white border cursor-pointer transition-all rounded-2xl shadow-xs flex flex-col justify-between hover:border-indigo-400 ${selectedCategoryFilter === cat.category ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/20' : 'border-slate-200'}`}
              >
                <div className="flex items-center justify-between text-slate-700 mb-2">
                  <span className="text-xs font-black truncate">{cat.category}</span>
                  <Award className="w-4 h-4 text-indigo-600 shrink-0" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-900">{cat.certified}</span>
                    <span className="text-[10px] text-slate-400">מתוך {cat.required} נדרש</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div style={{ width: `${Math.min(pct, 100)}%` }} className="bg-indigo-600 h-full rounded-full" />
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-slate-500 font-medium">פער: <strong className="text-rose-600">{cat.gap}</strong></span>
                    <span className="text-indigo-600 font-bold">{pct}% כללי</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ב. טבלת הסמכות מפורטת */}
      <div className="card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-4">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900">טבלת הסמכות מפורטת ובקרה מקצועית</h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">סינון לפי קטגוריה:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-50 text-xs font-bold text-slate-800 p-2 rounded-xl border border-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">כל הקטגוריות</option>
              {qualificationMetrics.categorySummary.map((c, i) => (
                <option key={i} value={c.category}>{c.category}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 pr-5">הסמכה / מקצוע</th>
                <th className="p-3.5">קטגוריה</th>
                <th className="p-3.5 text-center">נדרש בתקינה</th>
                <th className="p-3.5 text-center text-blue-700">בעלי הסמכה (ביחידה)</th>
                <th className="p-3.5 text-center text-emerald-700">משובצים כשירים</th>
                <th className="p-3.5 text-center text-rose-600">פער כשירות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    אין נתוני הסמכות להצגה תחת סינון זה
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 pr-5 font-bold text-slate-900">{row.name}</td>
                    <td className="p-3.5 text-slate-600 font-semibold">{row.category}</td>
                    <td className="p-3.5 text-center text-slate-800">{row.requiredInStandard}</td>
                    <td className="p-3.5 text-center text-blue-700 font-bold">{row.certifiedInUnit}</td>
                    <td className="p-3.5 text-center text-emerald-700 font-bold">{row.assignedCertified}</td>
                    <td className="p-3.5 text-center">
                      {row.gapCount > 0 ? (
                        <span className="bg-rose-50 border border-rose-200 text-rose-700 px-2.5 py-1 rounded-xl font-black">
                          {row.gapCount}-
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold">תקין (0)</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ג. הסבר ניהולי ותובנות פערים (פער הכשרה לעומת פוטנציאל שיבוץ) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 bg-amber-50/50 border-amber-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>הבחנה בין פער הכשרה לפוטנציאל שיבוץ</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            המערכת מבדיקה בין חייל המאויש בתפקיד וחסרה לו הסמכה (דורש יציאה לקורס והכשרה) לבין חייל מוסמך שיושב בתפקיד שאינו דורש זאת. ניתוח זה מאפשר למפקד לסגור פערי איוש מיידית באמצעות שינוי שיובוצים פנימיים מבלי להוציא חיילים להכשרות ארוכות.
          </p>
        </div>

        <div className="card p-5 bg-indigo-50/50 border-indigo-200 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>בקרה מוקפדת על תקנים, שיבוצים וחיילים</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            בוצעה הפרדה מלאה בין מספר התקנים (משרות על הנייר), מספר השיבוצים בפועל לבין ספירת חיילים ייחודיים במסגרת, כדי למנוע כפילויות ולהבטיח תמונת כשירות מבצעית אמינה ללא סטיות סטטיסטיות.
          </p>
        </div>
      </div>

    </div>
  );
}