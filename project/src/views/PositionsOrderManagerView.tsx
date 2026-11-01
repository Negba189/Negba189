import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  SlidersHorizontal,
  Filter,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type Unit, type Position } from '@/types';

export default function PositionsOrderManagerView() {
  console.log("=== PositionsOrderManagerView IS RENDERING ===");

  const [units, setUnits] = useState<Unit[]>([]);
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  
  // 4 רמות סינון היררכיות
  const [filterLevel1, setFilterLevel1] = useState<string>('');
  const [filterLevel2, setFilterLevel2] = useState<string>('');
  const [filterLevel3, setFilterLevel3] = useState<string>('');
  const [filterLevel4, setFilterLevel4] = useState<string>('');

  // מילונים מקומיים לניהול הערכים בטבלה לפני שמירה (position_id -> string value)
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({});
  const [tacticalInputs, setTacticalInputs] = useState<Record<string, string>>({});
  
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // שליפת כל התקנים (עוקף מגבלת 1000 שורות)
  const fetchAllPositions = async () => {
    let allData: Position[] = [];
    let from = 0;
    const step = 1000;
    let keepFetching = true;

    while (keepFetching) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
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
    try {
      const unitRes = await supabase.from('units').select('*').order('name');
      const positionsData = await fetchAllPositions();

      if (unitRes.data) {
        const allUnits = unitRes.data as Unit[];
        allUnits.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        setUnits(allUnits);
      }

      if (positionsData) {
        setAllPositions(positionsData as Position[]);
        
        // אתחול ערכי האינפוטים המקומיים לפי מה שקיים בדאטה בייס
        const initialDisplayInputs: Record<string, string> = {};
        const initialTacticalInputs: Record<string, string> = {};

        positionsData.forEach((p: any) => {
          const displayVal = p.display_order;
          initialDisplayInputs[String(p.id)] = (displayVal !== null && displayVal !== undefined && displayVal !== 999999) ? String(displayVal) : '';

          const tacticalVal = p.tactical_order;
          initialTacticalInputs[String(p.id)] = (tacticalVal !== null && tacticalVal !== undefined) ? String(tacticalVal) : '';
        });

        setOrderInputs(initialDisplayInputs);
        setTacticalInputs(initialTacticalInputs);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // רמה 1: יחידות שבהן ה-parent_unit_id הוא 189
  const level1Units = useMemo(() => {
    return units.filter(u => 
      u.parent_unit_id !== null && 
      u.parent_unit_id !== undefined && 
      String(u.parent_unit_id) === '189'
    );
  }, [units]);

  const level2Units = useMemo(() => {
    if (!filterLevel1) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel1));
  }, [units, filterLevel1]);

  const level3Units = useMemo(() => {
    if (!filterLevel2) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel2));
  }, [units, filterLevel2]);

  const level4Units = useMemo(() => {
    if (!filterLevel3) return [];
    return units.filter(u => u.parent_unit_id && String(u.parent_unit_id) === String(filterLevel3));
  }, [units, filterLevel3]);

  // היחידה הנבחרת הסופית
  const selectedUnit = useMemo(() => {
    const targetId = filterLevel4 || filterLevel3 || filterLevel2 || filterLevel1;
    if (!targetId) return null;
    return units.find(u => String(u.id) === String(targetId)) || null;
  }, [units, filterLevel1, filterLevel2, filterLevel3, filterLevel4]);

  // כל התקנים ששייכים ישירות ליחידה הנבחרת
  const currentPositions = useMemo(() => {
    if (!selectedUnit) return [];
    
    const positions = allPositions.filter(
      (p: any) => p.unit_id !== null && p.unit_id !== undefined && String(p.unit_id) === String(selectedUnit.id)
    );

    return positions.sort((a: any, b: any) => {
      const orderA = a.tactical_order ?? a.display_order ?? 999999;
      const orderB = b.tactical_order ?? b.display_order ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.id).localeCompare(String(b.id), 'he', { numeric: true });
    });
  }, [allPositions, selectedUnit]);

  // טיפול בשינוי אינפוט תצוגה מקומי
  const handleDisplayInputChange = (positionId: string, value: string) => {
    setOrderInputs(prev => ({
      ...prev,
      [positionId]: value
    }));
  };

  // טיפול בשינוי אינפוט טקטי מקומי
  const handleTacticalInputChange = (positionId: string, value: string) => {
    setTacticalInputs(prev => ({
      ...prev,
      [positionId]: value
    }));
  };

  // שמירה מרוכזת של כל התקנים במסגרת הנוכחית (גם display_order וגם tactical_order)
  const handleSaveAll = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      for (const pos of currentPositions) {
        const rawDisplay = orderInputs[String(pos.id)];
        const finalDisplay = (rawDisplay !== undefined && rawDisplay.trim() !== '') ? Number(rawDisplay) : 999999;

        const rawTactical = tacticalInputs[String(pos.id)];
        const finalTactical = (rawTactical !== undefined && rawTactical.trim() !== '') ? Number(rawTactical) : null;

        const { error } = await supabase
          .from('positions')
          .update({ 
            display_order: finalDisplay,
            tactical_order: finalTactical 
          })
          .eq('id', pos.id);

        if (error) throw error;
      }

      // עדכון ה-state המקומי
      const updatedPositions = allPositions.map((p: any) => {
        if (currentPositions.some(cp => String(cp.id) === String(p.id))) {
          const rawDisplay = orderInputs[String(p.id)];
          const finalDisplay = (rawDisplay !== undefined && rawDisplay.trim() !== '') ? Number(rawDisplay) : 999999;

          const rawTactical = tacticalInputs[String(p.id)];
          const finalTactical = (rawTactical !== undefined && rawTactical.trim() !== '') ? Number(rawTactical) : null;

          return { ...p, display_order: finalDisplay, tactical_order: finalTactical };
        }
        return p;
      });
      setAllPositions(updatedPositions);

      setStatusMessage({ text: 'כל סדרי התקנים וההגדרות הטקטיות עודכנו בהצלחה!', type: 'success' });
    } catch (err) {
      console.error('Error updating orders:', err);
      setStatusMessage({ text: 'שגיאה בעדכון המסד', type: 'error' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* כותרת ראשית */}
      <div className="card p-4 space-y-3 bg-white/80 border-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-slate-900">ניהול וסידור סדר תקנים (Display & Tactical Order)</h2>
          </div>
        </div>

        {/* פילטרים היררכיים */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>סינון היררכי לבחירת מסגרת:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              value={filterLevel1}
              onChange={(e) => { setFilterLevel1(e.target.value); setFilterLevel2(''); setFilterLevel3(''); setFilterLevel4(''); }}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none"
            >
              <option value="">-- רמה 1 (יחידת אב) --</option>
              {level1Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel2}
              onChange={(e) => { setFilterLevel2(e.target.value); setFilterLevel3(''); setFilterLevel4(''); }}
              disabled={!filterLevel1 || level2Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 2 (פלוגה) --</option>
              {level2Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel3}
              onChange={(e) => { setFilterLevel3(e.target.value); setFilterLevel4(''); }}
              disabled={!filterLevel2 || level3Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 3 (מחלקה) --</option>
              {level3Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>

            <select
              value={filterLevel4}
              onChange={(e) => setFilterLevel4(e.target.value)}
              disabled={!filterLevel3 || level4Units.length === 0}
              className="bg-white text-xs text-slate-800 p-2 rounded border border-slate-300 outline-none disabled:opacity-50"
            >
              <option value="">-- רמה 4 (כיתה/תת-מסגרת) --</option>
              {level4Units.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.unit_type})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* הודעת סטטוס צפה */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${statusMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-red-950/80 border-red-800 text-red-300'}`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* אזור התצוגה והעריכה של התקנים */}
      {selectedUnit ? (
        <div className="card p-6 space-y-4 bg-white border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">תקנים במסגרת: {selectedUnit.name}</h3>
              <span className="text-xs text-cyan-400">הגדר Display Order ו־Tactical Order (סדר טקטי לפריסה המרחבית) לכל תקן.</span>
            </div>
            {currentPositions.length > 0 && (
              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'שומר שינויים...' : 'שמור את כל השינויים במסגרת'}</span>
              </button>
            )}
          </div>

          {currentPositions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              אין תקנים ישירים המוגדרים תחת מסגרת זו.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-bold text-slate-600 border-b border-slate-200">
                <div className="col-span-6">שם התקן (Title)</div>
                <div className="col-span-3">Display Order</div>
                <div className="col-span-3">Tactical Order (סדר טקטי)</div>
              </div>

              {currentPositions.map((pos: any) => {
                const currentDisplayValue = orderInputs[String(pos.id)] ?? '';
                const currentTacticalValue = tacticalInputs[String(pos.id)] ?? '';

                return (
                  <div key={pos.id} className="grid grid-cols-12 gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="col-span-6">
                      <span className="text-xs font-bold text-slate-800 block">{pos.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">ID: {pos.id}</span>
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="999999"
                        value={currentDisplayValue}
                        onChange={(e) => handleDisplayInputChange(String(pos.id), e.target.value)}
                        className="w-full bg-white text-xs text-slate-800 p-2.5 rounded border border-slate-300 outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="col-span-3">
                      <input
                        type="number"
                        placeholder="ריק / אוטומטי"
                        value={currentTacticalValue}
                        onChange={(e) => handleTacticalInputChange(String(pos.id), e.target.value)}
                        className="w-full bg-white text-xs text-cyan-300 p-2.5 rounded border border-slate-300 outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>
                );
              })}

              {/* כפתור שמירה נוסף גם בתחתית הטבלה לנוחות המשתמש */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'שומר שינויים...' : 'שמור את כל השינויים במסגרת'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-500 text-sm bg-white border-slate-200">
          אנא בחר יחידה דרך 4 רמות הסינון למעלה כדי לצפות ולנהל את סדר התקנים שבה.
        </div>
      )}
    </div>
  );
}