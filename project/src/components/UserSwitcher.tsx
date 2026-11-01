import { useSystemUser } from '@/context/SystemUserContext';
import { UserCog, ShieldAlert, ShieldCheck, User } from 'lucide-react';

export default function UserSwitcher() {
  const { systemUsers, activeUserId, setActiveUserId, activeUser } = useSystemUser();

  if (!systemUsers.length) return null;

  return (
    <div className="flex items-center gap-2 bg-white/80 border border-slate-300/60 rounded-xl px-3 py-1.5 shadow-lg">
      <div className="flex items-center gap-1.5 text-xs text-slate-600">
        <UserCog className="w-4 h-4 text-brigade-400" />
        <span className="hidden sm:inline">משתמש פעיל:</span>
      </div>
      <select
        value={activeUserId || ''}
        onChange={(e) => setActiveUserId(e.target.value ? e.target.value : null)}
        className="bg-slate-100 text-slate-800 text-xs rounded-lg px-2.5 py-1 border border-slate-300 focus:outline-none focus:border-brigade-500 transition-colors"
      >
        {systemUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name} ({u.role})
          </option>
        ))}
      </select>
      {activeUser?.role === 'ADMIN' ? (
        <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-medium">
          <ShieldCheck className="w-3 h-3" />
          ADMIN
        </span>
      ) : (
        <span className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded font-medium">
          <User className="w-3 h-3" />
          {activeUser?.role || 'USER'}
        </span>
      )}
    </div>
  );
}