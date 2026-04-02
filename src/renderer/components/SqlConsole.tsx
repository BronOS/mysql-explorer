import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { sql, MySQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap, Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { Prec, StateField } from '@codemirror/state';
import { useIpc } from '../hooks/use-ipc';
import { useDebounce } from '../hooks/use-debounce';
import { useAppContext } from '../context/app-context';
import { TabInfo, QueryResult } from '../../shared/types';
import ResultTable from './ResultTable';
import Pagination from './Pagination';

interface Props {
  tab: TabInfo;
}

const PAGE_SIZE = 1000;

/**
 * Find the query block the cursor is in.
 * Scans backwards and forwards from cursor to find surrounding semicolons,
 * then returns the trimmed content between them.
 */
function findQueryAtCursor(code: string, cursorPos: number): { from: number; to: number; text: string } {
  if (!code.trim()) return { from: 0, to: code.length, text: '' };

  // Find the start: scan backwards from cursor for ';' or start of string
  let start = 0;
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (code[i] === ';') {
      start = i + 1;
      break;
    }
  }

  // Find the end: scan forwards from cursor for ';' or end of string
  let end = code.length;
  for (let i = cursorPos; i < code.length; i++) {
    if (code[i] === ';') {
      end = i;
      break;
    }
  }

  const raw = code.slice(start, end);
  const trimmed = raw.trim();
  if (!trimmed) return { from: start, to: end, text: '' };

  // Compute actual content boundaries for highlighting
  const contentStart = start + raw.indexOf(trimmed);
  const contentEnd = contentStart + trimmed.length;

  return { from: contentStart, to: contentEnd, text: trimmed };
}

// Highlight the active query block — pure StateField, no effects/dispatch
const activeQueryMark = Decoration.line({ class: 'cm-active-query' });

const activeQueryHighlight = StateField.define<DecorationSet>({
  create(state) {
    return computeActiveDecorations(state);
  },
  update(deco, tr) {
    if (tr.docChanged || tr.selectionSet) {
      return computeActiveDecorations(tr.state);
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

function computeActiveDecorations(state: any): DecorationSet {
  const sel = state.selection.main;
  if (!sel.empty) return Decoration.none;

  const doc = state.doc.toString();
  if (!doc.trim()) return Decoration.none;

  const query = findQueryAtCursor(doc, sel.head);
  if (!query.text) return Decoration.none;

  const decorations: any[] = [];
  const from = Math.max(0, query.from);
  const to = Math.min(query.to, state.doc.length);
  const startLine = state.doc.lineAt(from).number;
  const endLine = state.doc.lineAt(to).number;
  for (let line = startLine; line <= endLine; line++) {
    decorations.push(activeQueryMark.range(state.doc.line(line).from));
  }
  return Decoration.set(decorations, true);
}

export default function SqlConsole({ tab }: Props) {
  const ipc = useIpc();
  const { schema } = useAppContext();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [selectedDb, setSelectedDb] = useState(() => localStorage.getItem(`consoleDb:${tab.connectionId}`) || '');
  const [dividerY, setDividerY] = useState(250);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Load persisted SQL
  useEffect(() => {
    ipc.sqlFileLoad(tab.connectionId).then((content: string) => {
      if (content) setCode(content);
    });
  }, [tab.connectionId]);

  // Debounced save
  const debouncedSave = useDebounce((content: string) => {
    ipc.sqlFileSave(tab.connectionId, content);
  }, 1000);

  const handleCodeChange = (value: string) => {
    setCode(value);
    debouncedSave(value);
  };

  const handleDbChange = async (db: string) => {
    setSelectedDb(db);
    localStorage.setItem(`consoleDb:${tab.connectionId}`, db);
    if (db) await ipc.queryUseDatabase(tab.connectionId, db);
  };

  // Restore selected database on mount
  useEffect(() => {
    if (selectedDb) {
      ipc.queryUseDatabase(tab.connectionId, selectedDb).catch(() => {});
    }
  }, [tab.connectionId]);

  /**
   * Get the SQL to run:
   * 1. If there's a selection → run the selected text
   * 2. If no selection → find the query at cursor position
   */
  const getQueryToRun = (): string | null => {
    const view = editorRef.current?.view;
    if (!view) return code.trim() || null;

    const state = view.state;
    const selection = state.selection.main;

    // If there's a selection, use it
    if (!selection.empty) {
      return state.sliceDoc(selection.from, selection.to).trim() || null;
    }

    // No selection — find query at cursor
    const cursorPos = selection.head;
    const query = findQueryAtCursor(state.doc.toString(), cursorPos);
    return query.text || null;
  };

  const handleRun = async () => {
    const queryToRun = getQueryToRun();
    if (!queryToRun) return;
    setRunning(true);
    setResult(null);
    if (selectedDb) {
      await ipc.queryUseDatabase(tab.connectionId, selectedDb).catch(() => {});
    }
    const res = await ipc.queryExecute(tab.connectionId, queryToRun);
    setResult(res);
    setResultPage(1);
    setRunning(false);
  };

  // Build autocomplete schema from sidebar data
  const completionSchema = useCallback(() => {
    const connSchema = schema[tab.connectionId];
    if (!connSchema) return {};
    const tables: Record<string, string[]> = {};
    for (const db of connSchema.databases) {
      tables[db.name] = db.tables;
      for (const table of db.tables) {
        tables[table] = [];
      }
    }
    return tables;
  }, [schema, tab.connectionId]);

  const databases = schema[tab.connectionId]?.databases.map(d => d.name) || [];

  // Cmd/Ctrl+Enter keymap for CodeMirror
  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;
  const runKeymap = useMemo(() => Prec.highest(keymap.of([{
    key: 'Mod-Enter',
    run: () => { handleRunRef.current(); return true; },
  }])), []);

  const schemaObj = completionSchema();
  const extensions = useMemo(() => [
    runKeymap,
    activeQueryHighlight,
    sql({ dialect: MySQL, schema: schemaObj }),
  ], [runKeymap, schemaObj]);

  // Resizer
  const handleMouseDown = () => { dragging.current = true; };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setDividerY(Math.max(100, Math.min(y, rect.height - 100)));
    };
    const handleMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Paginated result rows
  const resultRows = result?.rows || [];
  const totalResultCount = result?.totalCount || 0;
  const pagedRows = resultRows.slice((resultPage - 1) * PAGE_SIZE, resultPage * PAGE_SIZE);
  const resultColumns = pagedRows.length > 0 ? Object.keys(pagedRows[0]) : [];

  return (
    <div className="sql-console" ref={containerRef}>
      {/* Editor area */}
      <div className="sql-editor" style={{ height: dividerY }}>
        <div className="sql-toolbar">
          <button className="btn btn-primary" onClick={handleRun} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run'}
          </button>
          <span className="sql-shortcut">⌘+Enter</span>
          <select
            className="select"
            value={selectedDb}
            onChange={e => handleDbChange(e.target.value)}
            style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11 }}
          >
            <option value="">-- Select Database --</option>
            {databases.map(db => <option key={db} value={db}>{db}</option>)}
          </select>
        </div>
        <div className="sql-codemirror">
          <CodeMirror
            ref={editorRef}
            value={code}
            onChange={handleCodeChange}
            extensions={extensions}
            theme={oneDark}
            height={`${dividerY - 36}px`}
            basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
          />
        </div>
      </div>

      {/* Resizer */}
      <div className="sql-resizer" onMouseDown={handleMouseDown}>
        <span>⋯⋯⋯</span>
      </div>

      {/* Result area */}
      <div className="sql-result">
        {!result && !running && (
          <div className="empty-state">Run a query to see results</div>
        )}

        {result?.error && (
          <div className="sql-error">
            <div className="sql-error-title">Error</div>
            <div>{result.error}</div>
          </div>
        )}

        {result && !result.error && result.type === 'rows' && (
          <>
            <div className="sql-result-header">
              <span style={{ color: '#4ade80' }}>✓ {totalResultCount.toLocaleString()} rows returned</span>
              <span style={{ color: '#555', marginLeft: 12 }}>in {(result.executionTimeMs / 1000).toFixed(3)}s</span>
              <span style={{ marginLeft: 'auto', color: '#555' }}>Read-only result</span>
            </div>
            <ResultTable columns={resultColumns} rows={pagedRows} />
            {totalResultCount > PAGE_SIZE && (
              <Pagination page={resultPage} pageSize={PAGE_SIZE} totalCount={totalResultCount} onPageChange={setResultPage} />
            )}
          </>
        )}

        {result && !result.error && result.type === 'affected' && (
          <div className="sql-affected">
            <div className="sql-affected-count">{result.affectedRows}</div>
            <div className="sql-affected-label">rows affected</div>
            <div className="sql-affected-time">in {(result.executionTimeMs / 1000).toFixed(3)}s</div>
          </div>
        )}
      </div>
    </div>
  );
}
