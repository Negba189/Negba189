import { useState, useMemo } from 'react';
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, UserX, Award, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { type Unit, type Position, type Person } from '@/types';
import { useUnitScope } from '@/context/UnitScopeContext';
import { buildDescendantMaps } from '@/lib/unitHierarchy';

interface ExportRow {
  'רמה 1 (חטיבה/מפקדה)': string;
  'רמה 2 (גדוד/מטה)': string;
  'רמה 3 (פלוגה/ענף)': string;
  'רמה 4 (מחלקה/מדור)': string;
  'רמה 5 (כיתה/צוות)': string;
  'מזהה תקן': string;
  'שם התקן/תפקיד': string;
  'סטטוס תקן': string;
  'הסמכות נדרשות לתקן': string;
  'מספר אישי': string;
  'שם פרטי': string;
  'שם משפחה': string;
  'דרגה': string;
  'מקצוע': string;
  'הסמכות החייל בפועל': string;
  'סטטוס כשירות': string;
  'הסמכות חסרות לחייל': string;
}


interface UnassignedExportRow {
  'רמה 1 (חטיבה/מפקדה)': string;
  'רמה 2 (גדוד/מטה)': string;
  'רמה 3 (פלוגה/ענף)': string;
  'רמה 4 (מחלקה/מדור)': string;
  'רמה 5 (כיתה/צוות)': string;
  'מספר אישי': string;
  'שם פרטי': string;
  'שם משפחה': string;
  'דרגה': string;
  'מקצוע': string;
  'סטטוס שיבוץ': string;
  'הסמכות החייל בפועל': string;
}

interface PersonQualsReportRow {
  'מספר אישי': string;
  'שם פרטי': string;
  'שם משפחה': string;
  'פונקציות דוד': string;
  'הסמכות פיקוד': string;
  'הסמכות נשק וחי"ר': string;
  'הסמכות רפואי': string;
  'הסמכות נהיגה': string;
  'מסגרת - רמה 2': string;
  'מסגרת - רמה 3': string;
  'מסגרת - רמה 4': string;
  'מסגרת - רמה 5': string;
  'מסגרת - רמה 6': string;
  'מזהה תקן משויך': string;
}

export default function PositionsExport() {
  // שליפת היחידה הנבחרת מהסינון הראשי שבראש העמוד
  const { selectedScopeUnitId } = useUnitScope();

  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [loadingPersonQuals, setLoadingPersonQuals] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeScopeName, setActiveScopeName] = useState<string | null>(null);

  const fetchAllData = async () => {
    const step = 1000;

    // 1. שליפת כל היחידות
    const { data: unitsData } = await supabase.from('units').select('*');
    const units: Unit[] = unitsData || [];

    // 2. שליפת כל התקנים
    let allPositions: Position[] = [];
    let pFrom = 0;
    let keepPositions = true;
    while (keepPositions) {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .range(pFrom, pFrom + step - 1);
      if (error || !data || data.length === 0) {
        keepPositions = false;
      } else {
        allPositions = [...allPositions, ...data];
        if (data.length < step) keepPositions = false;
        else pFrom += step;
      }
    }

    // 3. שליפת דרישות הסמכה לתקנים (position_requirements)
    let allRequirements: any[] = [];
    let reqFrom = 0;
    let keepReqs = true;
    while (keepReqs) {
      const { data, error } = await supabase
        .from('position_requirements')
        .select('*, qualifications(*)')
        .range(reqFrom, reqFrom + step - 1);
      if (error || !data || data.length === 0) {
        keepReqs = false;
      } else {
        allRequirements = [...allRequirements, ...data];
        if (data.length < step) keepReqs = false;
        else reqFrom += step;
      }
    }

    // 4. שליפת הסמכות של אנשים (person_qualifications)
    let allPersonQuals: any[] = [];
    let pqFrom = 0;
    let keepPq = true;
    while (keepPq) {
      const { data, error } = await supabase
        .from('person_qualifications')
        .select('*, qualifications(*)')
        .range(pqFrom, pqFrom + step - 1);
      if (error || !data || data.length === 0) {
        keepPq = false;
      } else {
        allPersonQuals = [...allPersonQuals, ...data];
        if (data.length < step) keepPq = false;
        else pqFrom += step;
      }
    }

    // 5. שליפת כל השיבוצים האקטיביים בלולאה ללא הגבלת 1,000 שורות
    let allAssignments: any[] = [];
    let aFrom = 0;
    let keepAssignments = true;
    while (keepAssignments) {
      const { data, error } = await supabase
        .from('assignments')
        .select('*, persons(*)')
        .eq('is_active', true)
        .range(aFrom, aFrom + step - 1);

      if (error || !data || data.length === 0) {
        keepAssignments = false;
      } else {
        allAssignments = [...allAssignments, ...data];
        if (data.length < step) keepAssignments = false;
        else aFrom += step;
      }
    }

    // 6. שליפת כל האנשים במערכת
    let allPersons: Person[] = [];
    let perFrom = 0;
    let keepPersons = true;
    while (keepPersons) {
      const { data, error } = await supabase
        .from('persons')
        .select('*')
        .range(perFrom, perFrom + step - 1);
      if (error || !data || data.length === 0) {
        keepPersons = false;
      } else {
        allPersons = [...allPersons, ...data];
        if (data.length < step) keepPersons = false;
        else perFrom += step;
      }
    }

    // חישוב קבוצת היחידות הרלוונטיות לפי הסינון הראשי
    let allowedUnitIds: Set<string> | null = null;
    let scopeUnitName = '';

    if (selectedScopeUnitId) {
      const descendantMaps = buildDescendantMaps(units);
      allowedUnitIds = new Set<string>([String(selectedScopeUnitId)]);
      const descSet = descendantMaps[selectedScopeUnitId];
      if (descSet) {
        descSet.forEach((id) => allowedUnitIds!.add(String(id)));
      }
      const targetUnit = units.find((u) => String(u.id) === String(selectedScopeUnitId));
      if (targetUnit) {
        scopeUnitName = targetUnit.name;
        setActiveScopeName(targetUnit.name);
      }
    } else {
      setActiveScopeName(null);
    }

    return {
      units,
      positions: allPositions,
      requirements: allRequirements,
      personQuals: allPersonQuals,
      assignments: allAssignments,
      persons: allPersons,
      allowedUnitIds,
      scopeUnitName,
    };
  };

  const getUnitHierarchyPath = (unitId: string | null | undefined, unitsMap: Map<string, Unit>): Unit[] => {
    if (!unitId) return [];
    const path: Unit[] = [];
    let current = unitsMap.get(String(unitId));
    const visited = new Set<string>();

    while (current && !visited.has(String(current.id))) {
      visited.add(String(current.id));
      path.unshift(current);
      if (current.parent_unit_id) {
        current = unitsMap.get(String(current.parent_unit_id));
      } else {
        break;
      }
    }
    return path;
  };

  // פונקציית עזר לניקוי שם היחידה לשימוש בשם הקובץ
  const sanitizeFileName = (name: string) => {
    return name ? `_${name.replace(/[^a-zA-Z0-9א-ת_-]/g, '_')}` : '';
  };

  // 1. ייצוא מטריצת תקנים, שיבוצים והסמכות (מסונן לפי הסינון הראשי)
  const handleExportToExcel = async () => {
    try {
      setLoadingPositions(true);
      setSuccessMsg(null);

      const {
        units,
        positions,
        requirements,
        personQuals,
        assignments,
        persons,
        allowedUnitIds,
        scopeUnitName,
      } = await fetchAllData();

      // סינון התקנים לפי היחידה הנבחרת ותתי-היחידות שלה
      const filteredPositions = allowedUnitIds
        ? positions.filter((pos) => pos.unit_id && allowedUnitIds.has(String(pos.unit_id)))
        : positions;

      const unitsMap = new Map<string, Unit>();
      units.forEach((u) => unitsMap.set(String(u.id), u));

      const positionReqsMap = new Map<string, Array<{ id?: string; name: string }>>();
      requirements.forEach((req: any) => {
        const posId = String(req.position_id);
        const qName = req.qualifications?.name || req.qualification_name;
        const qId = req.qualification_id ? String(req.qualification_id) : undefined;
        if (qName) {
          if (!positionReqsMap.has(posId)) positionReqsMap.set(posId, []);
          positionReqsMap.get(posId)!.push({ id: qId, name: qName });
        }
      });

      const personQualsMap = new Map<string, string[]>();
      const personQualIdsMap = new Map<string, string[]>();
      personQuals.forEach((pq: any) => {
        const pId = String(pq.person_id);
        const qName = pq.qualifications?.name || pq.qualification_name;
        if (qName) {
          if (!personQualsMap.has(pId)) personQualsMap.set(pId, []);
          personQualsMap.get(pId)!.push(qName);
        }
        if (pq.qualification_id) {
          if (!personQualIdsMap.has(pId)) personQualIdsMap.set(pId, []);
          personQualIdsMap.get(pId)!.push(String(pq.qualification_id));
        }
      });

      const positionAssignmentsMap = new Map<string, Person[]>();
      assignments.forEach((a: any) => {
        const posId = String(a.position_id);
        let pObj = a.persons || a.person;
        if (Array.isArray(pObj)) pObj = pObj[0];
        if (!pObj && a.person_id) {
          pObj = persons.find((p) => String(p.id) === String(a.person_id));
        }

        if (pObj) {
          if (!positionAssignmentsMap.has(posId)) {
            positionAssignmentsMap.set(posId, []);
          }
          positionAssignmentsMap.get(posId)!.push(pObj);
        }
      });

      const rows: ExportRow[] = [];

      filteredPositions.forEach((pos) => {
        const hierarchyPath = getUnitHierarchyPath(pos.unit_id, unitsMap);

        const level1 = hierarchyPath[0]?.name || '';
        const level2 = hierarchyPath[1]?.name || '';
        const level3 = hierarchyPath[2]?.name || '';
        const level4 = hierarchyPath[3]?.name || '';
        const level5 = hierarchyPath[4]?.name || (hierarchyPath.length > 5 ? hierarchyPath.slice(4).map(u => u.name).join(' > ') : '');

        const posIdStr = String(pos.id);
        const reqsList = positionReqsMap.get(posIdStr) || [];
        const reqsStr = reqsList.map((r) => r.name).join(', ');

        const assignedPersons = positionAssignmentsMap.get(posIdStr) || [];

        if (assignedPersons.length === 0) {
          rows.push({
            'רמה 1 (חטיבה/מפקדה)': level1,
            'רמה 2 (גדוד/מטה)': level2,
            'רמה 3 (פלוגה/ענף)': level3,
            'רמה 4 (מחלקה/מדור)': level4,
            'רמה 5 (כיתה/צוות)': level5,
            'מזהה תקן': posIdStr,
            'שם התקן/תפקיד': pos.title,
            'סטטוס תקן': 'פער (לא מאויש)',
            'הסמכות נדרשות לתקן': reqsStr,
            'מספר אישי': '',
            'שם פרטי': '',
            'שם משפחה': '',
            'דרגה': '',
            'מקצוע': '',
            'הסמכות החייל בפועל': '',
            'סטטוס כשירות': 'לא רלוונטי (פער)',
            'הסמכות חסרות לחייל': '',
          });
        } else {
          assignedPersons.forEach((person) => {
            const pIdStr = String(person.id);
            const pQuals = personQualsMap.get(pIdStr) || [];
            const pQualIds = personQualIdsMap.get(pIdStr) || [];

            const missingQuals: string[] = [];
            reqsList.forEach((req) => {
              let hasIt = false;
              if (req.id && pQualIds.includes(req.id)) {
                hasIt = true;
              } else {
                const reqNameLower = req.name.toLowerCase();
                hasIt = pQuals.some((q) => q.toLowerCase().includes(reqNameLower));
              }

              if (!hasIt) {
                missingQuals.push(req.name);
              }
            });

            const isQualified = missingQuals.length === 0;

            rows.push({
              'רמה 1 (חטיבה/מפקדה)': level1,
              'רמה 2 (גדוד/מטה)': level2,
              'רמה 3 (פלוגה/ענף)': level3,
              'רמה 4 (מחלקה/מדור)': level4,
              'רמה 5 (כיתה/צוות)': level5,
              'מזהה תקן': posIdStr,
              'שם התקן/תפקיד': pos.title,
              'סטטוס תקן': assignedPersons.length > 1 ? 'מאויש (איוש יתר)' : 'מאויש',
              'הסמכות נדרשות לתקן': reqsStr,
              'מספר אישי': person.personal_id || '',
              'שם פרטי': person.first_name || '',
              'שם משפחה': person.last_name || '',
              'דרגה': person.rank || '',
              'מקצוע': person.profession || '',
              'הסמכות החייל בפועל': pQuals.join(', '),
              'סטטוס כשירות': isQualified ? 'כשיר' : 'לא מוסמך',
              'הסמכות חסרות לחייל': missingQuals.join(', '),
            });
          });
        }
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      if (!worksheet['!views']) worksheet['!views'] = [];
      worksheet['!views'].push({ RTL: true });

      worksheet['!cols'] = [
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 25 }, { wch: 12 },
        { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 28 },
        { wch: 18 }, { wch: 28 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'מטריצת תקנים והסמכות');

      const dateStr = new Date().toISOString().slice(0, 10);
      const scopeSuffix = sanitizeFileName(scopeUnitName);
      XLSX.writeFile(workbook, `מטריצת_תקנים_והסמכות${scopeSuffix}_${dateStr}.xlsx`);

      setSuccessMsg(`מטריצת התקנים ${scopeUnitName ? `עבור ${scopeUnitName} ` : ''}הורדה בהצלחה!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error exporting positions & quals to Excel:', err);
      alert('אירעה שגיאה בייצוא הנתונים לאקסל');
    } finally {
      setLoadingPositions(false);
    }
  };

  // 2. ייצוא דוח אנשים לא משובצים (מסונן לפי הסינון הראשי)
  const handleExportUnassignedToExcel = async () => {
    try {
      setLoadingUnassigned(true);
      setSuccessMsg(null);

      const {
        units,
        personQuals,
        assignments,
        persons,
        allowedUnitIds,
        scopeUnitName,
      } = await fetchAllData();

      const unitsMap = new Map<string, Unit>();
      units.forEach((u) => unitsMap.set(String(u.id), u));

      const assignedPersonIdsSet = new Set<string>();
      assignments.forEach((a: any) => {
        if (a.person_id) assignedPersonIdsSet.add(String(a.person_id));
        if (a.persons && a.persons.id) assignedPersonIdsSet.add(String(a.persons.id));
      });

      const personQualsMap = new Map<string, string[]>();
      personQuals.forEach((pq: any) => {
        const pId = String(pq.person_id);
        const qName = pq.qualifications?.name || pq.qualification_name;
        if (qName) {
          if (!personQualsMap.has(pId)) personQualsMap.set(pId, []);
          personQualsMap.get(pId)!.push(qName);
        }
      });

      // סינון לא משובצים, ובנוסף סינון לפי היחידה הנבחרת בראש העמוד
      const unassignedPersons = persons.filter((p) => {
        const isUnassigned = !assignedPersonIdsSet.has(String(p.id));
        if (!isUnassigned) return false;
        if (allowedUnitIds) {
          return p.unit_id && allowedUnitIds.has(String(p.unit_id));
        }
        return true;
      });

      const rows: UnassignedExportRow[] = unassignedPersons.map((person) => {
        const hierarchyPath = getUnitHierarchyPath(person.unit_id, unitsMap);

        const level1 = hierarchyPath[0]?.name || '';
        const level2 = hierarchyPath[1]?.name || '';
        const level3 = hierarchyPath[2]?.name || '';
        const level4 = hierarchyPath[3]?.name || '';
        const level5 = hierarchyPath[4]?.name || (hierarchyPath.length > 5 ? hierarchyPath.slice(4).map(u => u.name).join(' > ') : '');

        const pQuals = personQualsMap.get(String(person.id)) || [];

        return {
          'רמה 1 (חטיבה/מפקדה)': level1,
          'רמה 2 (גדוד/מטה)': level2,
          'רמה 3 (פלוגה/ענף)': level3,
          'רמה 4 (מחלקה/מדור)': level4,
          'רמה 5 (כיתה/צוות)': level5,
          'מספר אישי': person.personal_id || '',
          'שם פרטי': person.first_name || '',
          'שם משפחה': person.last_name || '',
          'דרגה': person.rank || '',
          'מקצוע': person.profession || '',
          'סטטוס שיבוץ': 'לא משובץ לתקן',
          'הסמכות החייל בפועל': pQuals.join(', '),
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      if (!worksheet['!views']) worksheet['!views'] = [];
      worksheet['!views'].push({ RTL: true });

      worksheet['!cols'] = [
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 },
        { wch: 16 }, { wch: 30 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'חיילים לא משובצים');

      const dateStr = new Date().toISOString().slice(0, 10);
      const scopeSuffix = sanitizeFileName(scopeUnitName);
      XLSX.writeFile(workbook, `חיילים_לא_משובצים${scopeSuffix}_${dateStr}.xlsx`);

      setSuccessMsg(`דוח לא משובצים ${scopeUnitName ? `עבור ${scopeUnitName} ` : ''}הורד בהצלחה!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error exporting unassigned persons to Excel:', err);
      alert('אירעה שגיאה בייצוא דוח הבלתי משובצים לאקסל');
    } finally {
      setLoadingUnassigned(false);
    }
  };

  // 3. הדוח החדש: הסמכות חיילים מחולקות לקטגוריות + 5 רמות מסגרת + תקן משויך (מסונן לפי הסינון הראשי)
  const handleExportPersonQualsReport = async () => {
    try {
      setLoadingPersonQuals(true);
      setSuccessMsg(null);

      const {
        units,
        positions,
        personQuals,
        assignments,
        persons,
        allowedUnitIds,
        scopeUnitName,
      } = await fetchAllData();

      const unitsMap = new Map<string, Unit>();
      units.forEach((u) => unitsMap.set(String(u.id), u));

      // מיפוי תקנים לפי מזהה תקן (כדי לבדוק לאיזו יחידה התקן שייך)
      const positionUnitMap = new Map<string, string>();
      positions.forEach((pos) => {
        if (pos.unit_id) positionUnitMap.set(String(pos.id), String(pos.unit_id));
      });

      // מיפוי שיבוצים אקטיביים: מזהה חייל -> מזהה תקן (אם קיים)
      const personAssignmentMap = new Map<string, string>();
      assignments.forEach((a: any) => {
        let pId = a.person_id ? String(a.person_id) : undefined;
        if (!pId && a.persons) {
          const pObj = Array.isArray(a.persons) ? a.persons[0] : a.persons;
          if (pObj && pObj.id) pId = String(pObj.id);
        }
        if (pId && a.position_id) {
          personAssignmentMap.set(pId, String(a.position_id));
        }
      });

      // סינון החיילים לפי היחידה הנבחרת בראש העמוד (לפי שיוך החייל או לפי שיוך התקן שלו)
      const filteredPersons = allowedUnitIds
        ? persons.filter((person) => {
            const pUnitMatch = person.unit_id && allowedUnitIds.has(String(person.unit_id));
            const assignedPosId = personAssignmentMap.get(String(person.id));
            const posUnitId = assignedPosId ? positionUnitMap.get(assignedPosId) : undefined;
            const posUnitMatch = posUnitId && allowedUnitIds.has(posUnitId);
            return pUnitMatch || posUnitMatch;
          })
        : persons;

      // מיפוי הסמכות של כל חייל לפי 5 הקטגוריות
      const personQualsCategorizedMap = new Map<
        string,
        {
          general: string[];  // פונקציות דוד / כללי
          command: string[];  // הסמכות פיקוד
          weapon: string[];   // הסמכות נשק וחי"ר
          medical: string[];  // הסמכות רפואי
          driving: string[];  // הסמכות נהיגה
        }
      >();

      personQuals.forEach((pq: any) => {
        const pId = String(pq.person_id);
        const qName = pq.qualifications?.name || pq.qualification_name;
        const qCategory = (pq.qualifications?.category || pq.category || '').toLowerCase().trim();

        if (qName) {
          if (!personQualsCategorizedMap.has(pId)) {
            personQualsCategorizedMap.set(pId, {
              general: [],
              command: [],
              weapon: [],
              medical: [],
              driving: [],
            });
          }

          const catObj = personQualsCategorizedMap.get(pId)!;

          if (qCategory === 'פיקוד' || qCategory === 'command') {
            catObj.command.push(qName);
          } else if (qCategory === 'נשק' || qCategory === 'חי"ר' || qCategory === 'חיר' || qCategory === 'weapon' || qCategory === 'infantry') {
            catObj.weapon.push(qName);
          } else if (qCategory === 'רפואי' || qCategory === 'medical') {
            catObj.medical.push(qName);
          } else if (qCategory === 'נהיגה' || qCategory === 'driving') {
            catObj.driving.push(qName);
          } else {
            catObj.general.push(qName);
          }
        }
      });

      // בנאי השורות לדוח
      const rows: PersonQualsReportRow[] = filteredPersons.map((person) => {
        const pIdStr = String(person.id);

        // שליפת נתיב היררכיה מלא
        const hierarchyPath = getUnitHierarchyPath(person.unit_id, unitsMap);
        
        // מדלגים על רמה 1 (הראשונה), ולוקחים את 5 הרמות שמתחתיה (רמות 2 עד 6 במסלול המקורי)
        const level2 = hierarchyPath[1]?.name || '';
        const level3 = hierarchyPath[2]?.name || '';
        const level4 = hierarchyPath[3]?.name || '';
        const level5 = hierarchyPath[4]?.name || '';
        const level6 = hierarchyPath[5]?.name || (hierarchyPath.length > 6 ? hierarchyPath.slice(5).map(u => u.name).join(' > ') : '');

        // שליפת הקטגוריות
        const qualsCat = personQualsCategorizedMap.get(pIdStr) || {
          general: [],
          command: [],
          weapon: [],
          medical: [],
          driving: [],
        };

        // שליפת מזהה התקן (אם משובץ)
        const assignedPosId = personAssignmentMap.get(pIdStr) || '';

        return {
          'מספר אישי': person.personal_id || '',
          'שם פרטי': person.first_name || '',
          'שם משפחה': person.last_name || '',
          'פונקציות דוד': qualsCat.general.join(', '),
          'הסמכות פיקוד': qualsCat.command.join(', '),
          'הסמכות נשק וחי"ר': qualsCat.weapon.join(', '),
          'הסמכות רפואי': qualsCat.medical.join(', '),
          'הסמכות נהיגה': qualsCat.driving.join(', '),
          'מסגרת - רמה 2': level2,
          'מסגרת - רמה 3': level3,
          'מסגרת - רמה 4': level4,
          'מסגרת - רמה 5': level5,
          'מסגרת - רמה 6': level6,
          'מזהה תקן משויך': assignedPosId,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      if (!worksheet['!views']) worksheet['!views'] = [];
      worksheet['!views'].push({ RTL: true });

      worksheet['!cols'] = [
        { wch: 12 }, // מ.א.
        { wch: 14 }, // שם פרטי
        { wch: 14 }, // שם משפחה
        { wch: 22 }, // פונקציות דוד
        { wch: 22 }, // הסמכות פיקוד
        { wch: 22 }, // הסמכות נשק וחי"ר
        { wch: 22 }, // הסמכות רפואי
        { wch: 22 }, // הסמכות נהיגה
        { wch: 18 }, // מסגרת - רמה 2
        { wch: 18 }, // מסגרת - רמה 3
        { wch: 18 }, // מסגרת - רמה 4
        { wch: 18 }, // מסגרת - רמה 5
        { wch: 18 }, // מסגרת - רמה 6
        { wch: 14 }, // מזהה תקן משויך
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'דוח הסמכות ומסגרות');

      const dateStr = new Date().toISOString().slice(0, 10);
      const scopeSuffix = sanitizeFileName(scopeUnitName);
      XLSX.writeFile(workbook, `דוח_הסמכות_ומסגרות${scopeSuffix}_${dateStr}.xlsx`);

      setSuccessMsg(`דוח הסמכות ומסגרות ${scopeUnitName ? `עבור ${scopeUnitName} ` : ''}הורד בהצלחה!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error exporting person quals report:', err);
      alert('אירעה שגיאה בייצוא דוח ההסמכות והמסגרות');
    } finally {
      setLoadingPersonQuals(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">ייצוא דוחות אקסל - תקנים, שיבוצים ומשאבי אנוש</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                הורדת דוחות אקסל מפורטים של מצבת התקנים, החיילים המשובצים והסמכות לפי עץ יחידות מלא (5 רמות מתחת לרמה הראשונה).
              </p>
            </div>
          </div>

          {/* אינדיקציה למצב הסינון הראשי */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>
              {selectedScopeUnitId
                ? `מסונן לפי בחירה ראשית${activeScopeName ? `: ${activeScopeName}` : ''}`
                : 'כלל המערכת (ללא סינון)'}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs text-slate-600 space-y-2">
          <span className="font-bold text-slate-800 block">אפשרויות ייצוא זמינות (מתעדכנות אוטומטית לפי הסינון בראש העמוד):</span>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 list-disc list-inside text-slate-600">
            <li><strong>מטריצת תקנים מלאה:</strong> 5 רמות היררכיה, סטטוס תקן, חיילים משובצים, הסמכות ופערים.</li>
            <li><strong>דוח לא משובצים:</strong> חיילים המשויכים למסגרות אך אינם משובצים לתקן אקטיבי.</li>
            <li><strong>דוח הסמכות ומסגרות:</strong> הסמכות בחלוקה ל-5 קטגוריות, מסגרות (החל מרמה 2) ותקנים משויכים.</li>
          </ul>
        </div>

        {/* הודעת הצלחה */}
        {successMsg && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* כפתורי הפקת הדוחות */}
        <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* כפתור 1 - מטריצה מלאה */}
          <button
            type="button"
            onClick={handleExportToExcel}
            disabled={loadingPositions || loadingUnassigned || loadingPersonQuals}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {loadingPositions ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>מייצא מטריצה...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>דוח תקנים מלא</span>
              </>
            )}
          </button>

          {/* כפתור 2 - לא משובצים */}
          <button
            type="button"
            onClick={handleExportUnassignedToExcel}
            disabled={loadingPositions || loadingUnassigned || loadingPersonQuals}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {loadingUnassigned ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>מייצא לא משובצים...</span>
              </>
            ) : (
              <>
                <UserX className="w-4 h-4" />
                <span>דוח לא משובצים</span>
              </>
            )}
          </button>

          {/* כפתור 3 - דוח הסמכות ומסגרות */}
          <button
            type="button"
            onClick={handleExportPersonQualsReport}
            disabled={loadingPositions || loadingUnassigned || loadingPersonQuals}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            {loadingPersonQuals ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>מייצא הסמכות...</span>
              </>
            ) : (
              <>
                <Award className="w-4 h-4" />
                <span>דוח הסמכות ומסגרות</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
