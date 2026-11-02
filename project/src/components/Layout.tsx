import { Building2, Users, Target, Shield, Menu, X, Award, HeartPulse, Truck, ShieldCheck, LogOut, BarChart3, FileText, Eye, SlidersHorizontal, GitBranch, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useState } from 'react';
import UnitScopeSelector from '@/components/UnitScopeSelector';
import { useSystemUser } from '@/context/SystemUserContext';
import { useAuth } from '@/context/AuthContext';
import { SYSTEM_ROLE_LABELS } from '@/types';
import brigadeLogoImg from '@/assets/סמל_חטיבה.jpg';

import { PositionQualificationsMatrixView } from '@/views/PositionQualificationsMatrixView';

export type TabId = 
  | 'home'
  | 'org-tree' 
  | 'BattalionView1'
  | 'BattalionView2'
  | 'CompanyStructureView' 
  | 'platoon-structure' 
  | 'PlatoonStructureView'
  | 'readiness' 
  | 'medical' 
  | 'driving' 
  | 'roster' 
  | 'positions' 
  | 'qualifications' 
  | 'system-users' 
  | 'positions-order'
  | 'unit_summary'
  | 'unit_Position_summary'
  | 'unit_Qualifications_summary'
  | 'BulkPositionQualificationsMatrixView'
  | 'WeaponDashboard'
  | 'DavidDashboard'
  | 'CommandDashboard'
  | 'qualifications-matrix';

interface SubNavItem {
  id: TabId;
  label: string;
}

interface NavCategory {
  id: string;
  label: string;
  icon: typeof Building2;
  directId?: TabId;
  items?: SubNavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  { 
    id: 'org-tree', 
    label: '1. עץ ארגוני', 
    icon: Building2, 
    directId: 'org-tree' 
  },
  { 
    id: 'views', 
    label: '2. תצוגות ותרשימים', 
    icon: GitBranch, 
    items: [
      { id: 'BattalionView1', label: 'א. מטה גדוד' },
      { id: 'BattalionView2', label: 'ב. תצוגת פלוגות' },
      { id: 'company-structure', label: 'ג. פירוט פלוגתי' },
      { id: 'platoon-structure', label: 'ד. פריסה מחלקתית' },
    ]
  },
  { 
    id: 'summaries', 
    label: '3. סיכומים גדודיים', 
    icon: BarChart3, 
    items: [
      { id: 'unit_summary', label: 'א. סיכום יחידה' },
      { id: 'unit_Position_summary', label: 'ב. סטאטוס תקנים' },
      { id: 'unit_Qualifications_summary', label: 'ג. סטאטוס קורסים והסמכות' },
    ]
  },
  { 
    id: 'slices', 
    label: '4. חיתוכים יחידתיים', 
    icon: Layers, 
    items: [
      { id: 'DavidDashboard', label: 'א. ייעוד חטיבות דוד' },
      { id: 'CommandDashboard', label: 'ב. תמונת מצב מפקדים' },
      { id: 'medical', label: 'ג. תמונת מצב רפואי' },
      { id: 'driving', label: 'ד. תמונת מצב נהגים והיתרים' },
      { id: 'WeaponDashboard', label: 'ה. הסמכות נשקים' },
    ]
  },
  { 
    id: 'roster', 
    label: '5. מאגר כוח אדם', 
    icon: Users, 
    items: [
      { id: 'roster', label: 'א. מאגר כוח אדם' },
      { id: 'BulkPositionQualificationsMatrixView', label: 'ב. הגדרת הסמכות למשתמשים' },
    ]
  },
  { 
    id: 'parameters', 
    label: '6. ניהול פרמטרים', 
    icon: Target, 
    items: [
      { id: 'positions', label: 'א. ניהול תקנים' },
      { id: 'qualifications', label: 'ב. ניהול הסמכות' },
    ]
  },
  { 
    id: 'system-management', 
    label: '7. ניהול מערכת', 
    icon: ShieldCheck, 
    items: [
      { id: 'system-users', label: 'א. ניהול משתמשים' },
      { id: 'positions-order', label: 'ב. סדר תקנים' },
       { id: 'qualifications-matrix', label: 'ג. שיוך תקנים' },
    ]
  },
];

interface LayoutProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}

export default function Layout({ activeTab, onTabChange, children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canManageUsers, canEdit, activeUser } = useSystemUser();
  const { authenticatedUser, logout } = useAuth();

  const defaultOpenCategory = NAV_CATEGORIES.find(cat => 
    cat.directId === activeTab || cat.items?.some(sub => sub.id === activeTab)
  )?.id || 'views';

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    [defaultOpenCategory]: true
  });

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleTabChange = (tab: TabId) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('system_user');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 right-0 h-screen w-72 bg-white border-l border-slate-200 flex flex-col z-40 transition-transform duration-300 shadow-sm ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo/Header מעודכן - סמל מימין, כיתוב משמאל, לחיץ לעמוד הבית */}
        <div 
          onClick={() => onTabChange('home')}
          className="px-4 py-4 border-b border-slate-200 flex-shrink-0 cursor-pointer hover:bg-slate-50 transition-all group"
        >
          <div className="flex items-center gap-3">
            {/* סמל חטיבה (מימין) */}
            <div className="flex-shrink-0">
              <img 
                src={brigadeLogoImg} 
                alt="סמל חטיבה" 
                className="w-12 h-12 object-contain drop-shadow-sm" 
              />
            </div>
            
            {/* כיתוב (משמאל) */}
            <div className="min-w-0 text-right">
              <h1 className="text-xs font-black text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors">
                חטיבת נגבה - 189
              </h1>
              <p className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate">
                מערכת מבנה וארגון הקרב
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {NAV_CATEGORIES.map((cat) => {
            if (cat.id === 'system-management' && !canManageUsers) return null;

            const Icon = cat.icon;
            const isDirect = !!cat.directId;
            const isActiveDirect = isDirect && activeTab === cat.directId;
            const isOpen = !!openCategories[cat.id];
            const hasActiveChild = cat.items?.some(sub => sub.id === activeTab);

            return (
              <div key={cat.id} className="space-y-1">
                {isDirect ? (
                  <button
                    onClick={() => handleTabChange(cat.directId!)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 ${
                      isActiveDirect
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActiveDirect ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span className="text-sm flex-1 text-right">{cat.label}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150 ${
                        hasActiveChild
                          ? 'bg-slate-100 text-blue-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${hasActiveChild ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="text-sm">{cat.label}</span>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isOpen && cat.items && (
                      <div className="pr-8 pl-2 space-y-1 py-1 border-r-2 border-blue-100 mr-4">
                        {cat.items.map((sub) => {
                          const isSubActive = activeTab === sub.id;
                          return (
                            <button
                              key={sub.id + sub.label}
                              onClick={() => handleTabChange(sub.id)}
                              className={`w-full text-right px-3 py-2 rounded-lg text-xs transition-all ${
                                isSubActive
                                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                              }`}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex-shrink-0 space-y-2 bg-slate-50/50">
          {activeUser && (
            <div className="flex items-center gap-2">
              <span className={`badge text-[9px] px-2 py-0.5 rounded ${activeUser.role === 'ADMIN' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-slate-200 text-slate-700'}`}>
                {SYSTEM_ROLE_LABELS[activeUser.role]}
              </span>
              {!canEdit && (
                <span className="text-[9px] text-slate-500 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> קריאה בלבד
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate max-w-[140px]">{authenticatedUser?.full_name || 'משתמש'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
              title="התנתק"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {NAV_CATEGORIES.flatMap(c => c.items || [c]).find(i => (i as any).id === activeTab || (i as any).directId === activeTab)?.label || 'ניהול מערכת'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <UnitScopeSelector />
            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {authenticatedUser?.full_name?.charAt(0) || '?'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
