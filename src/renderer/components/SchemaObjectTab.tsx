import { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, MySQL } from '@codemirror/lang-sql';
import { useTheme } from '../hooks/use-theme';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { TabInfo } from '../../shared/types';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

type ObjectType = 'view' | 'procedure' | 'function' | 'trigger' | 'event';

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  view: 'View',
  procedure: 'Procedure',
  function: 'Function',
  trigger: 'Trigger',
  event: 'Event',
};

const OBJECT_TYPE_DDL_KEYWORD: Record<ObjectType, string> = {
  view: 'VIEW',
  procedure: 'PROCEDURE',
  function: 'FUNCTION',
  trigger: 'TRIGGER',
  event: 'EVENT',
};

const NEW_OBJECT_TEMPLATES: Record<ObjectType, string> = {
  view: 'CREATE VIEW `new_view` AS\nSELECT * FROM `table_name`;',
  procedure: 'CREATE PROCEDURE `new_procedure`()\nBEGIN\n  \nEND',
  function: 'CREATE FUNCTION `new_function`() RETURNS INT\nBEGIN\n  RETURN 0;\nEND',
  trigger: 'CREATE TRIGGER `new_trigger`\nBEFORE INSERT ON `table_name`\nFOR EACH ROW\nBEGIN\n  \nEND',
  event: 'CREATE EVENT `new_event`\nON SCHEDULE EVERY 1 DAY\nDO\nBEGIN\n  \nEND',
};

async function fetchDdl(
  ipc: ReturnType<typeof useIpc>,
  connectionId: string,
  database: string,
  objectType: ObjectType,
  name: string
): Promise<string> {
  switch (objectType) {
    case 'view':      return ipc.schemaCreateView(connectionId, database, name);
    case 'procedure': return ipc.schemaCreateProcedure(connectionId, database, name);
    case 'function':  return ipc.schemaCreateFunction(connectionId, database, name);
    case 'trigger':   return ipc.schemaCreateTrigger(connectionId, database, name);
    case 'event':     return ipc.schemaCreateEvent(connectionId, database, name);
  }
}

export default function SchemaObjectTab({ tab, isActive }: Props) {
  const { cmExtension } = useTheme();
  const ipc = useIpc();
  const { setStatus, dispatch, closeTab, openTab } = useAppContext();

  const objectType = (tab.objectType ?? 'view') as ObjectType;
  const objectName = tab.objectName;
  const database = tab.database ?? '';
  const [currentName, setCurrentName] = useState(objectName);
  const isNew = !currentName;

  const [savedDdl, setSavedDdl] = useState<string>('');
  const [editCode, setEditCode] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState<boolean>(isNew);
  const [loading, setLoading] = useState<boolean>(!isNew);
  const [saving, setSaving] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const loaded = useState<boolean>(false);
  const hasLoaded = loaded[0];
  const setHasLoaded = loaded[1];

  // Load DDL on first activation
  useEffect(() => {
    if (!isActive && !hasLoaded) return;
    if (hasLoaded) return;
    setHasLoaded(true);

    if (isNew) {
      const template = NEW_OBJECT_TEMPLATES[objectType];
      setSavedDdl('');
      setEditCode(template);
      setIsEditMode(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchDdl(ipc, tab.connectionId, database, objectType, objectName!)
      .then((ddl) => {
        setSavedDdl(ddl);
        setEditCode(ddl);
        setIsEditMode(false);
      })
      .catch(() => {
        setSavedDdl('-- Failed to load DDL');
        setEditCode('-- Failed to load DDL');
        setIsEditMode(false);
      })
      .finally(() => setLoading(false));
  }, [isActive, hasLoaded]);

  const handleEdit = () => {
    setEditCode(savedDdl);
    setIsEditMode(true);
  };

  const handleDiscard = () => {
    setEditCode(savedDdl);
    setIsEditMode(false);
  };

  const handleSaveClick = () => {
    setShowConfirm(true);
  };

  const dropSql = (!isNew && currentName)
    ? `DROP ${OBJECT_TYPE_DDL_KEYWORD[objectType]} \`${database}\`.\`${currentName}\``
    : '';

  const confirmSql = dropSql
    ? `${dropSql};\n\n${editCode.trim()}`
    : editCode.trim();

  const handleExecute = async () => {
    setShowConfirm(false);
    setSaving(true);
    setStatus('Executing DDL...', 'info');
    try {
      // Execute DROP and CREATE as separate statements
      if (dropSql) {
        await ipc.schemaDropObject(tab.connectionId, database, OBJECT_TYPE_DDL_KEYWORD[objectType], currentName);
      }
      await ipc.schemaExecuteDdl(tab.connectionId, database, editCode.trim());
      // Extract the new name from the CREATE statement
      const nameMatch = editCode.match(/\b(?:VIEW|PROCEDURE|FUNCTION|TRIGGER|EVENT)\s+`([^`]+)`/i);
      const newName = nameMatch?.[1] || currentName;

      // Refresh sidebar object list
      const pluralMap: Record<string, 'views' | 'procedures' | 'functions' | 'triggers' | 'events'> = {
        view: 'views', procedure: 'procedures', function: 'functions', trigger: 'triggers', event: 'events',
      };
      const fetcherMap: Record<string, string> = {
        view: 'schemaViews', procedure: 'schemaProcedures', function: 'schemaFunctions', trigger: 'schemaTriggers', event: 'schemaEvents',
      };
      try {
        const items: string[] = await (ipc as any)[fetcherMap[objectType]](tab.connectionId, database);
        dispatch({ type: 'SET_OBJECTS', connectionId: tab.connectionId, database, objectType: pluralMap[objectType], items });
      } catch {}

      // If name changed, close this tab and open a new one with the new name
      if (newName && newName !== currentName) {
        closeTab(tab.id);
        openTab({ connectionId: tab.connectionId, connectionName: tab.connectionName, connectionColor: tab.connectionColor, type: 'object', database, objectType, objectName: newName });
      } else {
        setCurrentName(newName);
        setSavedDdl(editCode.trim());
        setIsEditMode(false);
      }
      setStatus(`${OBJECT_TYPE_LABELS[objectType]} saved successfully`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Error: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const typeLabel = OBJECT_TYPE_LABELS[objectType];
  const titleLabel = currentName ? `${typeLabel}: ${currentName}` : `${typeLabel}: (new)`;

  const extensions = useMemo(() => [
    sql({ dialect: MySQL }),
  ], []);

  const displayDdl = isEditMode ? editCode : savedDdl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="sql-toolbar">
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{titleLabel}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!isEditMode && !loading && (
            <button className="btn btn-secondary" onClick={handleEdit}>
              Edit
            </button>
          )}
          {isEditMode && (
            <>
              <button
                className="btn btn-primary"
                onClick={handleSaveClick}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              {!isNew && (
                <button
                  className="btn btn-secondary"
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  Discard
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div className="empty-state">Loading DDL...</div>
        ) : (
          <div className="sql-codemirror" style={{ flex: 1 }}>
            <CodeMirror
              value={displayDdl}
              onChange={isEditMode ? setEditCode : undefined}
              extensions={extensions}
              theme={cmExtension}
              readOnly={!isEditMode}
              height="100%"
              basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: isEditMode }}
            />
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 680, width: '90%' }}>
            <div className="modal-title">Confirm DDL Execution</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              The following SQL will be executed:
            </p>
            <pre style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: 'var(--text-primary)',
              maxHeight: 320,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: 20,
            }}>
              {confirmSql}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExecute}
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
