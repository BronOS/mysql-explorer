import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { TabInfo, ConnectionConfig, SchemaTree } from '../../shared/types';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MAX_TABS = 10;

function loadPersistedTabs(): { tabs: TabInfo[]; activeTabId: string | null } {
  try {
    const data = typeof localStorage !== 'undefined' ? localStorage.getItem('tabState') : null;
    if (data) return JSON.parse(data);
  } catch {}
  return { tabs: [], activeTabId: null };
}

function persistTabs(tabs: TabInfo[], activeTabId: string | null): void {
  try { localStorage.setItem('tabState', JSON.stringify({ tabs, activeTabId })); } catch {}
}

interface StatusMessage {
  text: string;
  type: 'info' | 'error' | 'success';
  timestamp: number;
}

interface AppState {
  connections: ConnectionConfig[];
  tabs: TabInfo[];
  activeTabId: string | null;
  schema: SchemaTree;
  status: StatusMessage | null;
}

type Action =
  | { type: 'SET_STATUS'; status: StatusMessage | null }
  | { type: 'SET_CONNECTIONS'; connections: ConnectionConfig[] }
  | { type: 'OPEN_TAB'; tab: TabInfo }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'REORDER_TABS'; fromIndex: number; toIndex: number }
  | { type: 'SET_SCHEMA'; connectionId: string; databases: SchemaTree[string]['databases']; loaded: boolean }
  | { type: 'SET_COLUMNS'; connectionId: string; database: string; columns: { [tableName: string]: string[] } }
  | { type: 'SET_TABLES'; connectionId: string; database: string; tables: string[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };

    case 'SET_CONNECTIONS':
      return { ...state, connections: action.connections };

    case 'OPEN_TAB': {
      const newTabs = [...state.tabs];
      if (newTabs.length >= MAX_TABS) {
        const oldest = newTabs.reduce((min, t) => t.lastAccessed < min.lastAccessed ? t : min);
        const idx = newTabs.indexOf(oldest);
        newTabs.splice(idx, 1);
      }
      newTabs.push(action.tab);
      const s1 = { ...state, tabs: newTabs, activeTabId: action.tab.id };
      persistTabs(s1.tabs, s1.activeTabId);
      return s1;
    }

    case 'CLOSE_TAB': {
      const newTabs = state.tabs.filter(t => t.id !== action.tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      const s2 = { ...state, tabs: newTabs, activeTabId: newActiveId };
      persistTabs(s2.tabs, s2.activeTabId);
      return s2;
    }

    case 'REORDER_TABS': {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(action.fromIndex, 1);
      newTabs.splice(action.toIndex, 0, moved);
      const s3 = { ...state, tabs: newTabs };
      persistTabs(s3.tabs, s3.activeTabId);
      return s3;
    }

    case 'SET_ACTIVE_TAB': {
      const tabs = state.tabs.map(t =>
        t.id === action.tabId ? { ...t, lastAccessed: Date.now() } : t
      );
      const s4 = { ...state, tabs, activeTabId: action.tabId };
      persistTabs(s4.tabs, s4.activeTabId);
      return s4;
    }

    case 'SET_SCHEMA': {
      return {
        ...state,
        schema: {
          ...state.schema,
          [action.connectionId]: { databases: action.databases, loaded: action.loaded },
        },
      };
    }

    case 'SET_TABLES': {
      const connSchema = state.schema[action.connectionId];
      if (!connSchema) return state;
      const databases = connSchema.databases.map(db =>
        db.name === action.database ? { ...db, tables: action.tables, loaded: true } : db
      );
      return {
        ...state,
        schema: { ...state.schema, [action.connectionId]: { ...connSchema, databases } },
      };
    }

    case 'SET_COLUMNS': {
      const connSchema = state.schema[action.connectionId];
      if (!connSchema) return state;
      const databases = connSchema.databases.map(db =>
        db.name === action.database ? { ...db, columns: { ...db.columns, ...action.columns } } : db
      );
      return {
        ...state,
        schema: { ...state.schema, [action.connectionId]: { ...connSchema, databases } },
      };
    }

    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<Action>;
  openTab: (opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  setStatus: (text: string, type?: 'info' | 'error' | 'success') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const persisted = loadPersistedTabs();
  const [state, dispatch] = useReducer(reducer, {
    connections: [],
    tabs: persisted.tabs,
    activeTabId: persisted.activeTabId,
    schema: {},
    status: null,
  });

  // Tab persistence is handled directly in the reducer actions (OPEN_TAB, CLOSE_TAB, etc.)

  const openTab = useCallback((opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => {
    const existing = state.tabs.find(t =>
      t.connectionId === opts.connectionId &&
      t.type === opts.type &&
      t.database === opts.database &&
      t.table === opts.table
    );
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id });
      return;
    }
    const tab: TabInfo = { ...opts, id: randomId(), lastAccessed: Date.now() };
    dispatch({ type: 'OPEN_TAB', tab });
  }, [state.tabs]);

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', tabId });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tabId });
  }, []);

  const setStatus = useCallback((text: string, type: 'info' | 'error' | 'success' = 'info') => {
    dispatch({ type: 'SET_STATUS', status: { text, type, timestamp: Date.now() } });
  }, []);

  return (
    <AppContext.Provider value={{ ...state, dispatch, openTab, closeTab, setActiveTab, setStatus }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
