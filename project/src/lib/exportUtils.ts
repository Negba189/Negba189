/**
 * Utility functions for exporting data to CSV and triggering print.
 */

/**
 * Convert an array of objects to CSV format.
 * Handles Hebrew text, commas, quotes, and newlines within cell values.
 *
 * @param rows - Array of objects to export
 * @param headers - Optional ordered list of {key, label} pairs. If omitted, all object keys are used as headers.
 * @returns CSV string with BOM for Hebrew/Excel compatibility
 */
export function toCSV<T>(
  rows: T[],
  headers?: { key: keyof T; label: string }[],
): string {
  if (rows.length === 0 && !headers) return '';

  const keys: (keyof T)[] = headers
    ? headers.map((h) => h.key)
    : Object.keys(rows[0] as Record<string, unknown>) as (keyof T)[];

  const headerLabels = headers ? headers.map((h) => h.label) : (keys as string[]).map(String);

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [headerLabels.map(escapeCell).join(',')];
  rows.forEach((row) => {
    const values = keys.map((key) => escapeCell((row as Record<string, unknown>)[key as string]));
    lines.push(values.join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * Trigger a browser download of a CSV file.
 */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export an array of objects as a CSV file download.
 */
export function exportToCSV<T>(
  rows: T[],
  filename: string,
  headers?: { key: keyof T; label: string }[],
): void {
  const csv = toCSV(rows, headers);
  downloadCSV(csv, filename);
}

/**
 * Trigger the browser print dialog.
 */
export function printReport(): void {
  window.print();
}

/**
 * Generate a timestamp string for filenames (YYYY-MM-DD_HHmm).
 */
export function timestampForFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
}
