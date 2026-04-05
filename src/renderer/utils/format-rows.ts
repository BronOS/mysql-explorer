export function cellToString(val: unknown): string {
  return val === null || val === undefined ? 'NULL' : String(val);
}

export function rowsToTsv(rows: Record<string, unknown>[], colNames: string[]): string {
  return colNames.join('\t') + '\n' + rows.map(r => colNames.map(c => cellToString(r[c])).join('\t')).join('\n');
}

export function rowsToCsv(rows: Record<string, unknown>[], colNames: string[]): string {
  const esc = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  return colNames.map(esc).join(',') + '\n' + rows.map(r => colNames.map(c => esc(cellToString(r[c]))).join(',')).join('\n');
}

export function rowsToMarkdown(rows: Record<string, unknown>[], colNames: string[]): string {
  return '| ' + colNames.join(' | ') + ' |\n| ' + colNames.map(() => '---').join(' | ') + ' |\n' +
    rows.map(r => '| ' + colNames.map(c => cellToString(r[c])).join(' | ') + ' |').join('\n');
}

export function rowsToJson(rows: Record<string, unknown>[], colNames: string[]): string {
  return JSON.stringify(rows.map(r => { const o: any = {}; colNames.forEach(c => o[c] = r[c]); return o; }), null, 2);
}

export function rowsToSqlInsert(rows: Record<string, unknown>[], colNames: string[], tableName: string): string {
  return rows.map(r => {
    const vals = colNames.map(c => { const v = r[c]; return v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`; }).join(', ');
    return `INSERT INTO \`${tableName}\` (${colNames.map(c => '`' + c + '`').join(', ')}) VALUES (${vals});`;
  }).join('\n');
}

export function rowsToHtml(rows: Record<string, unknown>[], colNames: string[]): string {
  return `<table>\n<thead>\n<tr>${colNames.map(c => `<th>${c}</th>`).join('')}</tr>\n</thead>\n<tbody>\n` +
    rows.map(r => '<tr>' + colNames.map(c => `<td>${cellToString(r[c])}</td>`).join('') + '</tr>').join('\n') +
    '\n</tbody>\n</table>';
}

export type ExportFormat = 'csv' | 'tsv' | 'json' | 'sql' | 'markdown' | 'html';

export const FORMAT_LABELS: Record<ExportFormat, string> = {
  sql: 'SQL', csv: 'CSV', json: 'JSON', markdown: 'Markdown', tsv: 'TSV', html: 'HTML Table',
};

export const FORMAT_EXT: Record<ExportFormat, string> = {
  sql: 'sql', csv: 'csv', json: 'json', markdown: 'md', tsv: 'tsv', html: 'html',
};

export function formatRows(rows: Record<string, unknown>[], colNames: string[], format: ExportFormat, tableName: string): string {
  switch (format) {
    case 'tsv': return rowsToTsv(rows, colNames);
    case 'csv': return rowsToCsv(rows, colNames);
    case 'markdown': return rowsToMarkdown(rows, colNames);
    case 'json': return rowsToJson(rows, colNames);
    case 'sql': return rowsToSqlInsert(rows, colNames, tableName);
    case 'html': return rowsToHtml(rows, colNames);
  }
}
