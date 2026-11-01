export type UnitType =
  | 'BRIGADE'
  | 'BATTALION'
  | 'HEADQUARTERS'
  | 'FORWARD_HQ'
  | 'OPS_STAFF'
  | 'LOGISTICS'
  | 'FRAMEWORK'
  | 'COMPANY'
  | 'PLATOON'
  | 'SQUAD';

export interface Unit {
  id: string;
  name: string;
  unit_type: UnitType;
  parent_unit_id: string | null;
  created_at?: string;
}

export interface Position {
  id: string;
  unit_id: string | null;
  title: string;
  code: string | null;
  rank_required: string | null;
  is_active: boolean;
  is_key_position: boolean;
  created_at?: string;
  // Joined fields
  units?: Unit | null;
}

export interface Person {
  id: string;
  personal_id: string;
  first_name: string;
  last_name: string;
  rank: string | null;
  service_status: 'סדיר' | 'קבע' | 'מילואים' | null;
  phone_number: string | null;
  birth_date: string | null;
  unit_id: string | null;
  position_id: string | null;
  created_at?: string;
  // Joined fields
  units?: Unit | null;
  positions?: Position | null;
}

export type AssignmentType = 'PERMANENT' | 'ACTING' | 'TEMPORARY';

export interface Assignment {
  id: string;
  position_id: string;
  person_id: string;
  assignment_type: AssignmentType;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at?: string;
  // Joined fields
  persons?: Person | null;
  positions?: Position | null;
}

export interface Qualification {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  created_at?: string;
}

export interface PositionRequirement {
  id: string;
  position_id: string;
  qualification_id: string;
  created_at?: string;
  // Joined fields
  qualifications?: Qualification | null;
}

export interface PersonQualification {
  id: string;
  person_id: string;
  qualification_id: string;
  acquired_date: string | null;
  expiration_date: string | null;
  created_at?: string;
  // Joined fields
  qualifications?: Qualification | null;
}

export interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at?: string;
}

// ===================== System Users & RBAC =====================

export type SystemRole = 'ADMIN' | 'BATTALION_ADMIN' | 'COMPANY_ADMIN' | 'VIEWER';

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: SystemRole;
  assigned_unit_id: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  units?: Unit | null;
}

export const SYSTEM_ROLE_LABELS: Record<SystemRole, string> = {
  ADMIN: 'מנהל מערכת',
  BATTALION_ADMIN: 'מנהל גדוד',
  COMPANY_ADMIN: 'מנהל פלוגה',
  VIEWER: 'צפייה בלבד',
};

export const SYSTEM_ROLE_COLORS: Record<SystemRole, string> = {
  ADMIN: 'bg-brigade-500/15 text-brigade-300 border border-brigade-500/30',
  BATTALION_ADMIN: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  COMPANY_ADMIN: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  VIEWER: 'bg-slate-500/15 text-slate-600 border border-slate-500/30',
};

export const SYSTEM_ROLE_DESCRIPTIONS: Record<SystemRole, string> = {
  ADMIN: 'גישה מלאה לכל היחידות והנתונים בחטיבה',
  BATTALION_ADMIN: 'גישה לגדוד שהוקצה ולכל תת-היחידות שלו',
  COMPANY_ADMIN: 'גישה לפלוגה שהוקצתה ולתת-היחידות שלה',
  VIEWER: 'גישת קריאה בלבד ליחידה שהוקצתה',
};

export const ALL_SYSTEM_ROLES: SystemRole[] = ['ADMIN', 'BATTALION_ADMIN', 'COMPANY_ADMIN', 'VIEWER'];

// ===================== Position Readiness Status =====================

export type PositionStatus =
  | 'SHORTAGE' // לא מאויש — 0 active assignments (quantitative manning gap)
  | 'ACTING' // ממלא מקום — has ACTING/TEMPORARY assignment
  | 'OVERSTAFFED' // איוש יתר — more than 1 active assignment
  | 'UNQUALIFIED' // מאויש - חסר הסמכה — 1 active assignment but person lacks required qualifications
  | 'READY'; // מאויש וכשיר — 1 active permanent assignment, person meets all requirements

export const POSITION_STATUS_CONFIG: Record<
  PositionStatus,
  { label: string; color: string; dotColor: string; description: string }
> = {
  SHORTAGE: {
    label: 'לא מאויש',
    color: 'bg-red-500/15 text-red-300 border border-red-500/30',
    dotColor: 'bg-red-500',
    description: 'אין איוש פעיל לתקן זה (חוסר איוש כמותי)',
  },
  ACTING: {
    label: 'ממלא מקום',
    color: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    dotColor: 'bg-amber-500',
    description: 'מאויש בממלא מקום (ACTING / TEMPORARY)',
  },
  OVERSTAFFED: {
    label: 'איוש יתר',
    color: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    dotColor: 'bg-blue-500',
    description: 'יותר משיוך פעיל אחד לתקן זה',
  },
  UNQUALIFIED: {
    label: 'מאויש - חסר הסמכה',
    color: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
    dotColor: 'bg-orange-500',
    description: 'מאויש אך חסרות הסמכות נדרשות',
  },
  READY: {
    label: 'מאויש וכשיר',
    color: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    description: 'מאויש בשיוך קבוע וכל ההסמכות תקינות',
  },
};

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  PERMANENT: 'קבע',
  ACTING: 'ממלא מקום',
  TEMPORARY: 'זמני',
};

export const ASSIGNMENT_TYPE_COLORS: Record<AssignmentType, string> = {
  PERMANENT: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  ACTING: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  TEMPORARY: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
};

// ===================== Unit Type Config =====================

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  BRIGADE: 'חטיבה',
  BATTALION: 'גדוד',
  HEADQUARTERS: 'מפקדה',
  FORWARD_HQ: 'חפ"ק',
  OPS_STAFF: 'אג"ם',
  LOGISTICS: 'פלס"ם',
  FRAMEWORK: 'מסגרת',
  COMPANY: 'פלוגה',
  PLATOON: 'מחלקה',
  SQUAD: 'כיתה',
};

export const UNIT_TYPE_ORDER: UnitType[] = [
  'BRIGADE',
  'BATTALION',
  'HEADQUARTERS',
  'FORWARD_HQ',
  'OPS_STAFF',
  'LOGISTICS',
  'FRAMEWORK',
  'COMPANY',
  'PLATOON',
  'SQUAD',
];

export const UNIT_TYPE_ICONS: Record<UnitType, string> = {
  BRIGADE: 'Building2',
  BATTALION: 'Shield',
  HEADQUARTERS: 'Building',
  FORWARD_HQ: 'Map',
  OPS_STAFF: 'ClipboardList',
  LOGISTICS: 'Truck',
  FRAMEWORK: 'Layers',
  COMPANY: 'Users',
  PLATOON: 'User',
  SQUAD: 'CircleUser',
};

export const MILITARY_RANKS = [
  'טוראי',
  'טוראי ראשון',
  'רב-טוראי',
  'רב-טוראי מתקדם',
  'סמל',
  'סמל ראשון',
  'רס"ל',
  'רס"ר',
  'רס"מ',
  'רנ"ס',
  'קצין',
  'סגן',
  'סרן',
  'רב-סרן',
  'סא"ל',
  'אל"מ',
  'תא"ל',
  'אלוף',
];

export const SERVICE_STATUSES = ['סדיר', 'קבע', 'מילואים'] as const;

export const SERVICE_STATUS_COLORS: Record<string, string> = {
  'סדיר': 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  'קבע': 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  'מילואים': 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

export const UNIT_TYPE_COLORS: Record<UnitType, string> = {
  BRIGADE: 'bg-brigade-500/15 text-brigade-300 border border-brigade-500/30',
  BATTALION: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  HEADQUARTERS: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  FORWARD_HQ: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
  OPS_STAFF: 'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  LOGISTICS: 'bg-lime-500/15 text-lime-300 border border-lime-500/30',
  FRAMEWORK: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  COMPANY: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  PLATOON: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  SQUAD: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

// ===================== Helper Functions =====================

export function getUnitTypeLabel(type: UnitType): string {
  return UNIT_TYPE_LABELS[type] || type;
}

export function getUnitTypeColor(type: UnitType): string {
  return UNIT_TYPE_COLORS[type] || 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
}

export function getFullName(person: Pick<Person, 'first_name' | 'last_name'>): string {
  return `${person.first_name} ${person.last_name}`.trim();
}

/**
 * Calculate age from a birth_date string (ISO format: YYYY-MM-DD).
 * Returns the age in completed years as of today's date.
 * Returns null if birth_date is null/empty or invalid.
 */
export function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

/**
 * Categorize an age into a bucket for aggregate dashboards.
 * Returns '18-21', '22-25', '26+', or null if age is null.
 */
export function getAgeGroup(age: number | null): string | null {
  if (age === null) return null;
  if (age <= 21) return '18-21';
  if (age <= 25) return '22-25';
  return '26+';
}

export function getServiceStatusColor(status: string | null): string {
  if (!status) return 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
  return SERVICE_STATUS_COLORS[status] || 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
}

export function getAssignmentTypeLabel(type: AssignmentType): string {
  return ASSIGNMENT_TYPE_LABELS[type] || type;
}

export function getAssignmentTypeColor(type: AssignmentType): string {
  return ASSIGNMENT_TYPE_COLORS[type] || 'bg-slate-500/15 text-slate-600 border border-slate-500/30';
}

// ===================== Medical Readiness =====================

/**
 * Hebrew keywords that identify medical positions and qualifications.
 * Any position or qualification whose title/name contains one of these
 * substrings is considered medical. This is dynamic — new medical roles
 * or certs added to the system with these keywords automatically appear
 * in the medical dashboard with no code changes.
 */
export const MEDICAL_KEYWORDS: string[] = [
  'רופא',
  'פרמדיק',
  'חוג"ד',
  'חופ"ל',
  'חובש',
  'רופאה',
  'אחות',
  'מד"ר',
  'קצין רפואה',
  'רפואי',
  'רפואה',
  'medic',
  'medical',
  'paramedic',
];

/** Check if a position title is a medical role based on keyword matching. */
export function isMedicalPosition(position: { title: string }): boolean {
  const title = position.title.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => title.includes(kw.toLowerCase()));
}

/** Check if a qualification name is a medical certification based on keyword matching. */
export function isMedicalQualification(qual: { name: string }): boolean {
  const name = qual.name.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));
}

// ===================== Driving / License Readiness =====================

/**
 * Hebrew keywords that identify driver positions and driving license/permit
 * qualifications. Any position whose title contains one of these substrings
 * is considered a driver position. Any qualification whose name contains one
 * of these is considered a driving license/permit.
 *
 * This is dynamic — new driver roles or permit types added to the system
 * with these keywords automatically appear in the driver dashboard.
 */
export const DRIVING_KEYWORDS: string[] = [
  'נהג',
  'נהיגה',
  'היתר נהיגה',
  'רישיון',
  'היתר דוד',
  'היתר נגמ"ש',
  'היתר אמבולנס',
  'היתר משאית',
  'רישיון ג',
  'רישיון ד',
  'דוד',
  'נגמ"ש',
  'משאית',
  'אמבולנס',
  'driver',
  'driving',
  'license',
  'permit',
];

/** Check if a position title is a driver role based on keyword matching. */
export function isDriverPosition(position: { title: string }): boolean {
  const title = position.title.toLowerCase();
  return DRIVING_KEYWORDS.some((kw) => title.includes(kw.toLowerCase()));
}

/** Check if a qualification name is a driving license/permit based on keyword matching. */
export function isDrivingQualification(qual: { name: string }): boolean {
  const name = qual.name.toLowerCase();
  return DRIVING_KEYWORDS.some((kw) => name.includes(kw.toLowerCase()));
}

// ===================== Qualification Validity =====================

export type QualificationValidity = 'valid' | 'expiring' | 'expired' | 'no_expiry';

export const QUALIFICATION_VALIDITY_CONFIG: Record<
  QualificationValidity,
  { label: string; color: string; dotColor: string; icon: string }
> = {
  valid: {
    label: 'בתוקף',
    color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    icon: 'CheckCircle2',
  },
  expiring: {
    label: 'פג תוקף בקרוב',
    color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dotColor: 'bg-amber-500',
    icon: 'Clock',
  },
  expired: {
    label: 'פג תוקף',
    color: 'bg-red-500/10 text-red-400 border border-red-500/20',
    dotColor: 'bg-red-500',
    icon: 'XCircle',
  },
  no_expiry: {
    label: 'ללא תפוגה',
    color: 'bg-slate-500/10 text-slate-600 border border-slate-500/20',
    dotColor: 'bg-slate-500',
    icon: 'Infinity',
  },
};

/** Days before expiration to start warning about expiring soon. */
export const EXPIRY_WARNING_DAYS = 90;

/**
 * Determine the validity status of a certification based on its expiration date.
 * - 'expired' — expiration date has passed.
 * - 'expiring' — expiration date is within EXPIRY_WARNING_DAYS days from now.
 * - 'valid' — expiration date is more than EXPIRY_WARNING_DAYS days away.
 * - 'no_expiry' — no expiration date set (permanent qualification).
 */
export function getQualificationValidity(expirationDate: string | null): QualificationValidity {
  if (!expirationDate) return 'no_expiry';
  const expiry = new Date(expirationDate);
  if (isNaN(expiry.getTime())) return 'no_expiry';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= EXPIRY_WARNING_DAYS) return 'expiring';
  return 'valid';
}

/** Return the number of days until expiration (negative = already expired). */
export function daysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const expiry = new Date(expirationDate);
  if (isNaN(expiry.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/** Known qualification categories with display labels. */
export const QUALIFICATION_CATEGORIES = [
  'פיקוד',
  'רפואי',
  'נהיגה',
  'נשק',
  'חי"ר',
  'טכני',
  'כללי',
] as const;

export function getCategoryColor(category: string | null): string {
  if (!category) return 'bg-slate-500/10 text-slate-600 border border-slate-500/20';
  const map: Record<string, string> = {
    'פיקוד': 'bg-brigade-500/10 text-brigade-300 border border-brigade-500/20',
    'רפואי': 'bg-rose-500/10 text-rose-300 border border-rose-500/20',
    'נהיגה': 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20',
    'נשק': 'bg-orange-500/10 text-orange-300 border border-orange-500/20',
    'חי"ר': 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20',
    'טכני': 'bg-blue-500/10 text-blue-300 border border-blue-500/20',
    'כללי': 'bg-slate-500/10 text-slate-600 border border-slate-500/20',
  };
  return map[category] || 'bg-slate-500/10 text-slate-600 border border-slate-500/20';
}

// ===================== Status Calculation =====================

/**
 * Calculate position readiness status based on active assignments,
 * assignment types, and qualification matching.
 *
 * Priority order:
 * 1. OVERSTAFFED — more than 1 active assignment
 * 2. SHORTAGE — 0 active assignments
 * 3. ACTING — has an ACTING assignment (and exactly 1 active)
 * 4. UNQUALIFIED — 1 active assignment, but person lacks required qualifications
 * 5. READY — 1 active permanent assignment and person meets all requirements
 */
export function calculatePositionStatus(
  activeAssignments: Assignment[],
  requiredQualificationIds: Set<string>,
  personQualificationIds: Set<string>,
): PositionStatus {
  const count = activeAssignments.length;

  if (count > 1) return 'OVERSTAFFED';
  if (count === 0) return 'SHORTAGE';

  const assignment = activeAssignments[0];

  if (assignment.assignment_type === 'ACTING' || assignment.assignment_type === 'TEMPORARY') return 'ACTING';

  // Check qualifications
  if (requiredQualificationIds.size > 0) {
    const hasAll = Array.from(requiredQualificationIds).every((qId) =>
      personQualificationIds.has(qId),
    );
    if (!hasAll) return 'UNQUALIFIED';
  }

  return 'READY';
}

/**
 * Returns the set of qualification IDs that the assigned person is missing
 * for the given position. Returns empty if no assignment or no missing quals.
 */
export function getMissingQualificationIds(
  requiredQualificationIds: Set<string>,
  personQualificationIds: Set<string>,
): string[] {
  return Array.from(requiredQualificationIds).filter(
    (qId) => !personQualificationIds.has(qId),
  );
}
