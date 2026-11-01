import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Users as UsersIcon,
  ShieldCheck,
  Shield,
  Eye,
  Mail,
  Lock,
  Unlock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { type SystemUser, type Unit } from '@/types';
import Modal from '@/components/Modal';
import { SkeletonRow } from '@/components/Skeletons';
import { useToast } from '@/components/Toast';
import { useSystemUser } from '@/context/SystemUserContext';

// הגדרת שלושת התפקידים החדשים בלבד
type SystemRole = 'ADMIN' | 'UNIT_MANAGER' | 'VIEWER';

const ALL_SYSTEM_ROLES: SystemRole[] = ['ADMIN', 'UNIT_MANAGER', 'VIEWER'];

const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  ADMIN: 'מנהל מערכת',
  UNIT_MANAGER: 'מנהל מסגרת',
  VIEWER: 'צפייה בלבד',
};

const SYSTEM_ROLE_COLORS: Record<SystemRole, string> = {
  ADMIN: 'bg-brigade-500/10 text-brigade-400 border-brigade-500/20',
  UNIT_MANAGER: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  VIEWER: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
};

const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  ADMIN: 'גישה מלאה לכלל המערכת ולכלל היחידות',
  UNIT_MANAGER: 'גישת צפייה, עריכה, שינויים ושיבוצים רק למסגרת שנבחרה עבורו',
  VIEWER: 'גישת צפייה בלבד למסגרת שנבחרה עבורו',
};

const ROLE_ICONS: Record<SystemRole, typeof ShieldCheck> = {
  ADMIN: ShieldCheck,
  UNIT_MANAGER: Shield,
  VIEWER: Eye,
};

interface UserForm {
  email: string;
  full_name: string;
  role: SystemRole;
  assigned_unit_id: string;
  is_active: boolean;
  password: string;
}

const EMPTY_FORM: UserForm = {
  email: '',
  full_name: '',
  role: 'VIEWER',
  assigned_unit_id: '',
  is_active: true,
  password: '',
};

export default function SystemUsersManagement() {
  const { toast } = useToast();
  const { canManageUsers, refresh } = useSystemUser();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const [usersRes, unitsRes] = await Promise.all([
      supabase.from('system_users').select('*, units(*)').order('full_name'),
      supabase.from('units').select('*').order('name'),
    ]);
    if (usersRes.error) {
      toast('שגיאה בטעינת משתמשים: ' + usersRes.error.message, 'error');
      setLoading(false);
      return;
    }
    setUsers(usersRes.data as SystemUser[]);
    if (unitsRes.data) setUnits(unitsRes.data as Unit[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const searchLower = search.toLowerCase();
      const matchSearch =
        !search ||
        u.full_name.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower);
      const matchRole = !roleFilter || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const scopedUnitOptions = useMemo(() => {
    const scopeTypes = new Set(['BRIGADE', 'BATTALION', 'COMPANY']);
    return units.filter((u) => scopeTypes.has(u.unit_type));
  }, [units]);

  const openAddModal = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (user: SystemUser) => {
    setEditUser(user);
    setForm({
      email: user.email,
      full_name: user.full_name,
      role: (user.role as SystemRole) || 'VIEWER',
      assigned_unit_id: user.assigned_unit_id || '',
      is_active: user.is_active,
      password: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.email.trim() || !form.full_name.trim()) {
      toast('נא למלא אימייל ושם מלא', 'warning');
      return;
    }
    if (form.role !== 'ADMIN' && !form.assigned_unit_id) {
      toast('נא לבחור יחידה למשתמש שאינו מנהל מערכת', 'warning');
      return;
    }
    if (!editUser && !form.password) {
      toast('נא להזין סיסמה למשתמש חדש', 'warning');
      return;
    }
    if (form.password && form.password.length < 4) {
      toast('הסיסמה חייבת להכיל לפחות 4 תווים', 'warning');
      return;
    }
    setSaving(true);

    const payload: Record<string, unknown> = {
      email: form.email.trim(),
      full_name: form.full_name.trim(),
      role: form.role,
      assigned_unit_id: form.role === 'ADMIN' ? null : (form.assigned_unit_id || null),
      is_active: form.is_active,
    };

    if (form.password) {
      const { data: hashData } = await supabase.rpc('hash_password', {
        raw_password: form.password,
      });
      if (hashData) {
        payload.password_hash = hashData;
      }
    }

    if (editUser) {
      const { error } = await supabase
        .from('system_users')
        .update(payload)
        .eq('id', editUser.id);
      setSaving(false);
      if (error) {
        toast('שגיאה בעדכון משתמש: ' + error.message, 'error');
        return;
      }
      toast('המשתמש עודכן בהצלחה');
    } else {
      const { error } = await supabase.from('system_users').insert(payload);
      setSaving(false);
      if (error) {
        toast('שגיאה בהוספת משתמש: ' + error.message, 'error');
        return;
      }
      toast('המשתמש נוסף בהצלחה');
    }

    setModalOpen(false);
    fetchUsers();
    refresh();
  };

  const handleDelete = async (user: SystemUser) => {
    if (!confirm(`האם למחוק את ${user.full_name}?`)) return;
    const { error } = await supabase.from('system_users').delete().eq('id', user.id);
    if (error) {
      toast('שגיאה במחיקה: ' + error.message, 'error');
      return;
    }
    toast('המשתמש נמחק');
    fetchUsers();
    refresh();
  };

  const toggleActive = async (user: SystemUser) => {
    const { error } = await supabase
      .from('system_users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id);
    if (error) {
      toast('שגיאה: ' + error.message, 'error');
      return;
    }
    fetchUsers();
    refresh();
  };

  const hasFilters = search || roleFilter;
  const clearFilters = () => {
    setSearch('');
    setRoleFilter('');
  };

  if (!canManageUsers) {
    return (
      <div className="card text-center py-16">
        <Lock className="w-12 h-12 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-600 text-sm">אין הרשאה לניהול משתמשי מערכת</p>
        <p className="text-slate-500 text-xs mt-2">דרושה הרשאת מנהל מערכת</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="card p-4 bg-white/40 border-slate-300/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-brigade-500/10 border border-brigade-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-brigade-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">ניהול משתמשי מערכת והרשאות</h3>
            <p className="text-xs text-slate-500 mt-1">
              מודול זה מנהל פרופילי התחברות והרשאות למערכת בלבד לפי 3 רמות הרשאה מוגדרות.
            </p>
          </div>
        </div>
      </div>

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
              placeholder="חיפוש לפי שם או אימייל..."
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'ring-2 ring-blue-500/40' : ''}`}
          >
            <span>סינון</span>
            {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-400" />}
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            <span>הוסף משתמש</span>
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-300/60 animate-slideDown">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field flex-1 min-w-[140px]"
            >
              <option value="">כל התפקידים</option>
              {ALL_SYSTEM_ROLES.map((r) => (
                <option key={r} value={r}>{SYSTEM_ROLE_LABELS[r]}</option>
              ))}
            </select>
            {hasFilters && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-1.5 text-sm">
                <X className="w-3.5 h-3.5" />
                <span>נקה</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-slate-600 px-1 flex-wrap">
        <span><strong className="text-slate-800">{filteredUsers.length}</strong> משתמשים</span>
        {hasFilters && <span className="text-slate-500">מתוך {users.length} בסה"כ</span>}
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {users.filter((u) => u.is_active).length} פעילים
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-600" />
          {users.filter((u) => !u.is_active).length} לא פעילים
        </span>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/60 text-slate-600 text-xs uppercase border-b border-slate-300/60">
                <th className="text-right px-4 py-3 font-medium">שם מלא</th>
                <th className="text-right px-4 py-3 font-medium">אימייל</th>
                <th className="text-right px-4 py-3 font-medium">תפקיד</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">יחידה מוקצית</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">סטטוס</th>
                <th className="text-center px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-200/40">
                    <SkeletonRow columns={6} />
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-500">
                    <UsersIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>{hasFilters ? 'לא נמצאו תוצאות' : 'אין משתמשי מערכת'}</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, idx) => {
                  const roleKey = (user.role as SystemRole) in ROLE_ICONS ? (user.role as SystemRole) : 'VIEWER';
                  const RoleIcon = ROLE_ICONS[roleKey];
                  const assignedUnit = units.find((u) => u.id === user.assigned_unit_id);
                  return (
                    <tr
                      key={user.id}
                      className={`border-b border-slate-200/40 hover:bg-slate-100/30 transition-colors animate-fadeIn ${
                        idx % 2 === 0 ? '' : 'bg-white/20'
                      } ${!user.is_active ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {user.full_name.charAt(0)}
                          </div>
                          <span className="text-slate-800 font-medium">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-slate-600 text-xs">
                          <Mail className="w-3 h-3" />
                          {user.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[11px] inline-flex items-center gap-1 ${SYSTEM_ROLE_COLORS[roleKey] || ''}`}>
                          <RoleIcon className="w-3 h-3" />
                          {SYSTEM_ROLE_LABELS[roleKey] || roleKey}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {assignedUnit ? (
                          <span className="text-slate-600 text-xs">{assignedUnit.name}</span>
                        ) : user.role === 'ADMIN' ? (
                          <span className="text-brigade-400 text-xs font-medium">כל החטיבה</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <button
                          onClick={() => toggleActive(user)}
                          className={`badge text-[11px] inline-flex items-center gap-1 transition-all ${
                            user.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-700/40 text-slate-600 border border-slate-600/40'
                          }`}
                        >
                          {user.is_active ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                          {user.is_active ? 'פעיל' : 'חסום'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-100 rounded-lg transition-all"
                            title="ערוך"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-100 rounded-lg transition-all"
                            title="מחק"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editUser ? `עריכת ${editUser.full_name}` : 'הוספת משתמש מערכת'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">אימייל <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
              placeholder="user@brigade189.idf"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">שם מלא <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="input-field"
              placeholder="ישראל ישראלי"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1.5">
              {editUser ? 'איפוס סיסמה' : 'סיסמה'} {!editUser && <span className="text-red-400">*</span>}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
              placeholder={editUser ? 'השאר ריק לשמירת הסיסמה הנוכחית' : '••••••••'}
              dir="ltr"
            />
            {editUser && (
              <p className="text-[11px] text-slate-500 mt-1">הזן סיסמה חדשה לאיפוס, או השאר ריק לשמירת הסיסמה הקיימת</p>
            )}
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-2">תפקיד מערכת</label>
            {/* מבנה של 3 כפתורים לבחירת תפקיד */}
            <div className="grid grid-cols-3 gap-2">
              {ALL_SYSTEM_ROLES.map((role) => {
                const RoleIcon = ROLE_ICONS[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role })}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 ${
                      form.role === role
                        ? SYSTEM_ROLE_COLORS[role] + ' ring-1 ring-offset-0'
                        : 'bg-white/40 text-slate-600 border-slate-300/40 hover:border-slate-600'
                    }`}
                  >
                    <RoleIcon className="w-4 h-4 flex-shrink-0" />
                    <span className="text-right truncate">{SYSTEM_ROLE_LABELS[role]}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">{SYSTEM_ROLE_DESCRIPTIONS[form.role]}</p>
          </div>
          {form.role !== 'ADMIN' && (
            <div>
              <label className="block text-sm text-slate-600 mb-1.5">יחידה מוקצית <span className="text-red-400">*</span></label>
              <select
                value={form.assigned_unit_id}
                onChange={(e) => setForm({ ...form, assigned_unit_id: e.target.value })}
                className="input-field"
              >
                <option value="">בחר יחידה...</option>
                {scopedUnitOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">המשתמש יוכל לצפות ולנהל רק את היחידה שנבחרה ואת תת-היחידות שלה</p>
            </div>
          )}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="w-4 h-4 rounded border-slate-600 bg-slate-100 text-brigade-500 focus:ring-brigade-500/30"
              />
              <span className="text-sm text-slate-600">משתמש פעיל (יכול להתחבר למערכת)</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 pt-4 mt-4 border-t border-slate-300/60">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'שומר...' : editUser ? 'עדכן' : 'הוסף'}
          </button>
          <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1">
            ביטול
          </button>
        </div>
      </Modal>
    </div>
  );
}