import { useState, useRef, useEffect } from 'react';
import { Users, ChevronDown, Check, Eye, Shield, ShieldCheck, ShieldHalf, UserCog, RotateCcw } from 'lucide-react';
import { useSystemUser } from '@/context/SystemUserContext';
import { useAuth } from '@/context/AuthContext';
import { SYSTEM_ROLE_LABELS, SYSTEM_ROLE_COLORS, type SystemRole } from '@/types';

const ROLE_ICONS: Record<SystemRole, typeof Shield> = {
  ADMIN: ShieldCheck,
  BATTALION_ADMIN: ShieldHalf,
  COMPANY_ADMIN: Shield,
  VIEWER: Eye,
};

const FALLBACK_ICON = UserCog;

function getRoleIcon(role: string | null | undefined): typeof Shield {
  if (!role) return FALLBACK_ICON;
  return ROLE_ICONS[role as SystemRole] || FALLBACK_ICON;
}

function getRoleLabel(role: string | null | undefined): string {
  if (!role) return '';
  return SYSTEM_ROLE_LABELS[role as SystemRole] || role;
}

function getRoleColor(role: string | null | undefined): string {
  if (!role) return 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
  return SYSTEM_ROLE_COLORS[role as SystemRole] || 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
}

export default function RoleSimulator() {
  const { systemUsers, activeUser, activeUserId, setActiveUserId, loading } = useSystemUser();
  const { authenticatedUser } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSimulating = activeUserId !== authenticatedUser?.id && activeUserId !== null;
  const isDefault = !isSimulating;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return null;

  const ActiveIcon = getRoleIcon(activeUser?.role);
  const displayName = activeUser?.full_name || authenticatedUser?.full_name || 'משתמש';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-sm ${
          open
            ? 'bg-slate-100 border-slate-600 text-slate-900'
            : 'bg-slate-100/60 border-slate-600/50 text-slate-600 hover:text-slate-800 hover:border-slate-600'
        }`}
        title="סימולטור תפקידים — החלפת נקודת מבט"
      >
        <ActiveIcon className="w-3.5 h-3.5 flex-shrink-0 text-brigade-400" />
        <span className="font-medium hidden md:inline">צפייה כ:</span>
        <span className="font-semibold truncate max-w-[100px] lg:max-w-[140px] text-slate-900">
          {displayName}
        </span>
        {activeUser?.role && (
          <span className={`badge text-[9px] flex-shrink-0 ${getRoleColor(activeUser.role)}`}>
            {getRoleLabel(activeUser.role)}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-72 max-h-96 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-2xl z-50 py-1.5">
          {/* Default: revert to authenticated user */}
          <button
            onClick={() => {
              setActiveUserId(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-right transition-colors ${
              isDefault ? 'bg-brigade-600/20 text-brigade-300' : 'text-slate-600 hover:bg-slate-100/60'
            }`}
          >
            {isDefault ? (
              <Check className="w-4 h-4 flex-shrink-0 text-brigade-400" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate block">
                {authenticatedUser?.full_name || 'משתמש נוכחי'}
              </span>
              <span className="text-[10px] text-slate-500 truncate block">
                {authenticatedUser ? getRoleLabel(authenticatedUser.role) : 'משתמש מערכת'}
              </span>
            </div>
            {authenticatedUser?.role && (
              <span className={`badge text-[9px] flex-shrink-0 ${getRoleColor(authenticatedUser.role)}`}>
                {getRoleLabel(authenticatedUser.role)}
              </span>
            )}
          </button>

          {isSimulating && <div className="h-px bg-slate-700/50 my-1.5" />}

          {/* Other system users */}
          {systemUsers.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-sm">
              <Users className="w-6 h-6 mx-auto mb-1 opacity-50" />
              אין משתמשי מערכת נוספים
            </div>
          ) : (
            systemUsers
              .filter((u) => u.id !== authenticatedUser?.id)
              .map((user) => {
                const isSelected = activeUserId === user.id;
                const RoleIcon = getRoleIcon(user.role);
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      setActiveUserId(user.id);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-right transition-colors ${
                      isSelected ? 'bg-brigade-600/20 text-brigade-300' : 'text-slate-600 hover:bg-slate-100/60'
                    }`}
                  >
                    {isSelected ? (
                      <Check className="w-4 h-4 flex-shrink-0 text-brigade-400" />
                    ) : (
                      <span className="w-4 flex-shrink-0" />
                    )}
                    <RoleIcon className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{user.full_name}</span>
                      <span className="text-[10px] text-slate-500 truncate block">{user.email}</span>
                    </div>
                    <span className={`badge text-[9px] flex-shrink-0 ${getRoleColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </button>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
