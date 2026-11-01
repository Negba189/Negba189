import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface AssignmentRecord {
  id: string;
  is_active: boolean;
  persons?: {
    id: string;
    first_name: string;
    last_name: string;
    rank?: string;
  } | null;
}

interface PositionWithAssignment {
  id: string;
  title: string;
  unit_id: string;
  is_key_position: boolean;
  is_active: boolean;
  code?: string;
  assignments?: AssignmentRecord[];
}

export default function BattalionStructureDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'hq' | 'companies'>('hq');
  const [positions, setPositions] = useState<PositionWithAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBattalionData = useCallback(async () => {
    setLoading(true);
    // שליפת התקנים יחד עם שיוכים פעילים בלבד ישירות ברמת השרת
    const { data, error } = await supabase
      .from('positions')
      .select(`
        *,
        assignments!inner (
          id,
          is_active,
          persons (
            id,
            first_name,
            last_name,
            rank
          )
        )
      `)
      .eq('assignments.is_active', true)
      .order('title');

    if (error) {
      // אם אין שיוכים פעילים כלל, השאילתא עם inner join עשויה להחזיר שגיאה או מערך ריק, לכן נגבה בשליפה רגילה במידת הצורך
      const fallbackRes = await supabase
        .from('positions')
        .select(`
          *,
          assignments (
            id,
            is_active,
            persons (
              id,
              first_name,
              last_name,
              rank
            )
          )
        `)
        .order('title');

      if (fallbackRes.error) {
        toast('שגיאה בטעינת מבנה הגדוד: ' + fallbackRes.error.message, 'error');
        setLoading(false);
        return;
      }
      if (fallbackRes.data) {
        setPositions(fallbackRes.data as PositionWithAssignment[]);
      }
    } else if (data) {
      setPositions(data as PositionWithAssignment[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchBattalionData();
  }, [fetchBattalionData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brigade-500" />
      </div>
    );
  }

  // פונקציית עזר קפדנית לוודא שהשיוך אכן פעיל לחלוטין
  const getActivePersonName = (pos: PositionWithAssignment) => {
    const activeAssigns = (pos.assignments || []).filter(
      (a) => a.is_active === true && a.persons != null
    );
    if (activeAssigns.length === 0) return null;
    const p = activeAssigns[0].persons;
    if (!p) return null;
    return `${p.first_name} ${p.last_name}`;
  };

  const battalionCommander = positions.find((p) => p.title.includes('מג"ד'));
  const deputyCommander = positions.find((p) => p.title.includes('סמג"ד'));
  const companyCommanders = positions.filter((p) => p.title.includes('מ"פ'));

  return (
    <div className="space-y-6">
      {/* כותרת וטאבים */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/60 p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">גדוד 1891 - מבנה ארגוני דינמי</h2>
          <p className="text-xs text-slate-600 mt-1">תמונת מצב מתעדכנת בזמן אמת מתוך מאגר התקנים והשיבוצים</p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('hq')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'hq' ? 'bg-brigade-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            מטה גדוד ותומכ"ל
          </button>
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'companies' ? 'bg-brigade-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            פלוגות מבצעיות ופערים
          </button>
        </div>
      </div>

      {/* טאב 1: מטה גדוד */}
      {activeTab === 'hq' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-amber-900/40 border border-amber-600/50 px-6 py-3 rounded-xl text-center shadow-lg min-w-[240px]">
              <span className="text-xs text-amber-300 block">מפקד הגדוד</span>
              <span className="text-sm font-bold text-slate-900">
                {battalionCommander && getActivePersonName(battalionCommander) ? (
                  getActivePersonName(battalionCommander)
                ) : (
                  <span className="text-red-400">פער איוש</span>
                )}
              </span>
            </div>
            <div className="w-0.5 h-6 bg-slate-700"></div>
            <div className="bg-amber-900/40 border border-amber-600/50 px-6 py-3 rounded-xl text-center shadow-lg min-w-[240px]">
              <span className="text-xs text-amber-300 block">סגן מפקד הגדוד</span>
              <span className="text-sm font-bold text-slate-900">
                {deputyCommander && getActivePersonName(deputyCommander) ? (
                  getActivePersonName(deputyCommander)
                ) : (
                  <span className="text-red-400">פער איוש</span>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-200">
            {positions.map((pos) => {
              const personName = getActivePersonName(pos);
              return (
                <div key={pos.id} className="bg-white/80 border border-slate-200 p-3 rounded-lg">
                  <p className="text-xs font-bold text-slate-600">{pos.title}</p>
                  <p className={`text-xs mt-1 ${personName ? 'text-slate-800' : 'text-red-400 font-medium'}`}>
                    {personName ? personName : '⚠️ פער תקני (לא מאויש)'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* טאב 2: פלוגות מבצעיות */}
      {activeTab === 'companies' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {companyCommanders.map((comp) => {
              const compName = getActivePersonName(comp);
              return (
                <div key={comp.id} className="bg-white/80 border border-slate-200 p-3 rounded-xl space-y-2">
                  <div className="bg-emerald-900/30 border border-emerald-700/40 p-2 rounded text-xs font-bold text-emerald-300 text-center">
                    מ"פ: {compName ? compName : <span className="text-red-400">פער מ"פ</span>}
                  </div>
                  <div className="bg-slate-100/50 p-2 rounded text-xs text-slate-600">
                    {compName ? 'מפקד משובץ תקין' : <span className="text-red-400 font-bold">מ"מ / סמ"פ - פער</span>}
                  </div>
                </div>
              );
            })}
            {companyCommanders.length === 0 && (
              <p className="text-slate-500 text-center col-span-full py-8">לא נמצאו תקני מ"פ מוגדרים במערכת.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
