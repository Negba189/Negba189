import { Network, LayoutGrid, Users, ArrowRight } from 'lucide-react';
import brigadeMottoImg from '@/assets/brigade-motto.jpg';
import brigadeLogoImg from '@/assets/סמל_חטיבה.jpg';
import divisionLogoImg from '@/assets/סמל_אוגדה.jpg';

interface HomeDashboardProps {
  onNavigate: (tabId: any) => void;
}

export default function HomeDashboard({ onNavigate }: HomeDashboardProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4">
      {/* כותרת ראשית עם סמל אוגדה משמאל, כיתוב במרכז, וסמל חטיבה מימין */}
      <div className="card p-8 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white text-center space-y-3 shadow-xl rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between px-4">
          {/* סמל אוגדה (גדל ונקי ללא מסגרת) */}
          <div className="flex-shrink-0">
            <img 
              src={divisionLogoImg} 
              alt="סמל אוגדה" 
              className="w-24 h-24 lg:w-28 lg:h-28 object-contain drop-shadow-md" 
            />
          </div>

          {/* כיתוב מרכזי */}
          <div className="flex flex-col items-center space-y-1 mx-auto">
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white">
              חטיבת נגבה - 189
            </h1>
            <p className="text-base lg:text-lg font-medium text-blue-200">
              מערכת מבנה וארגון הקרב
            </p>
          </div>

          {/* סמל חטיבה (גדל ונקי ללא מסגרת) */}
          <div className="flex-shrink-0">
            <img 
              src={brigadeLogoImg} 
              alt="סמל חטיבה" 
              className="w-24 h-24 lg:w-28 lg:h-28 object-contain drop-shadow-md" 
            />
          </div>
        </div>
      </div>

      {/* תמונה מוטו חטיבה */}
      <div className="card p-3 bg-white border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col items-center">
        <div className="w-full rounded-xl overflow-hidden shadow-md max-h-[400px] bg-slate-900 flex items-center justify-center">
          <img 
            src={brigadeMottoImg} 
            alt="מוטו חטיבת נגבה - כי ארץ הנגב נתתני" 
            className="w-full h-auto object-cover max-h-[400px]"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2 font-medium italic">
          "כִּי אֶרֶץ הַנֶּגֶב נְתַתַּנִי" (שופטים א', ט"ו)
        </p>
      </div>

      {/* קישורים מהירים למודולים המרכזיים */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div 
          onClick={() => onNavigate('org-tree')}
          className="card p-5 bg-white border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer rounded-xl flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Network className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">1. עץ ארגוני</h3>
            <p className="text-xs text-slate-500 mt-1">ניהול היררכיית היחידות, תקנים, שיבוצים ונתוני כשירות מצטברים.</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('BattalionView1')}
          className="card p-5 bg-white border-slate-200 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer rounded-xl flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">א. מטה גדוד</h3>
            <p className="text-xs text-slate-500 mt-1">תצוגת שדרת הפיקוד הראשית וחלוקה לענפים מבצעיים לבחירה לפי גדוד.</p>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('BattalionView2')}
          className="card p-5 bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer rounded-xl flex flex-col justify-between space-y-4 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Users className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:-translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">ב. תצוגת פלוגות</h3>
            <p className="text-xs text-slate-500 mt-1">מבנה הפלוגות המבצעיות, הסמ"פים והמחלקות לפי גדוד.</p>
          </div>
        </div>

      </div>
    </div>
  );
}