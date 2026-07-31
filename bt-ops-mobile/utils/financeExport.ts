// Excel + PDF export helpers for the Finance module.
//
// Mobile approach differs from web by necessity:
//  • Excel — SheetJS writes a base64 buffer, which we drop into the cache
//    directory and hand to the OS share sheet (there's no "downloads" folder
//    on iOS/Android the way there is in a browser).
//  • PDF — the web uses jsPDF + autotable, which is unreliable under React
//    Native. expo-print renders HTML to a real PDF natively instead, so we
//    build a small styled HTML table and print that.
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

export type Row = Record<string, any>;

/** One named sheet in a workbook. */
export interface Sheet {
  name: string;
  rows: Row[];
}

async function shareFile(uri: string, mimeType: string, dialogTitle: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType, dialogTitle, UTI: mimeType });
}

/**
 * Build an .xlsx from one or more sheets and open the share sheet.
 * `filename` should not include the extension.
 */
export async function exportExcel(filename: string, sheets: Sheet[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    // Excel sheet names are capped at 31 chars and can't contain []:*?/\
    const safe = s.name.replace(/[[\]:*?/\\]/g, '-').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safe);
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const uri = `${FileSystem.cacheDirectory}${filename}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await shareFile(
    uri,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    `Export ${filename}`,
  );
}

const esc = (v: any) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** A titled table block within a PDF. */
export interface PdfTable {
  title?: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * Render one or more tables to a PDF and open the share sheet.
 * `filename` should not include the extension.
 */
export async function exportPdf(filename: string, title: string, tables: PdfTable[]) {
  const tableHtml = tables
    .map(t => `
      ${t.title ? `<h2>${esc(t.title)}</h2>` : ''}
      <table>
        <thead>
          <tr>${t.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${t.rows.length
            ? t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')
            : `<tr><td colspan="${t.columns.length}" class="empty">No data</td></tr>`}
        </tbody>
      </table>`)
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif;
             padding: 24px; color: #111827; }
      h1 { font-size: 20px; margin: 0 0 4px; }
      .sub { font-size: 11px; color: #6b7280; margin-bottom: 18px; }
      h2 { font-size: 13px; margin: 20px 0 6px; color: #374151; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px 8px;
               font-size: 10.5px; text-align: left; }
      th { background: #f3f4f6; font-weight: 700; }
      tr:nth-child(even) td { background: #fafafa; }
      .empty { text-align: center; color: #9ca3af; font-style: italic; }
    </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">Bengaluru Trekkers • generated ${new Date().toLocaleString('en-IN')}</div>
    ${tableHtml}
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, 'application/pdf', `Export ${filename}`);
}
