import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { TabInfo, ConnectionConfig, SchemaTree } from '../../shared/types';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MAX_TABS = 10;

interface AppState {
  connections: ConnectionConfig[];
  tabs: TabInfo[];
  activeTabId: string | null;
  schema: SchemaTree;
}

type Action =
  | { type: 'SET_CONNECTIONS'; connections: ConnectionConfig[] }
  | { type: 'OPEN_TAB'; tab: TabInfo }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'SET_SCHEMA'; connectionId: string; databases: SchemaTree[string]['databases']; loaded: boolean }
  | { type: 'SET_TABLES'; connectionId: string; database: string; tables: string[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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
      return { ...state, tabs: newTabs, activeTabId: action.tab.id };
    }

    case 'CLOSE_TAB': {
      const newTabs = state.tabs.filter(t => t.id !== action.tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return { ...state, tabs: newTabs, activeTabId: newActiveId };
    }

    case 'SET_ACTIVE_TAB': {
      const tabs = state.tabs.map(t =>
        t.id === action.tabId ? { ...t, lastAccessed: Date.now() } : t
      );
      return { ...state, tabs, activeTabId: action.tabId };
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

    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<Action>;
  openTab: (opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    connections: [],
    tabs: [],
    activeTabId: null,
    schema: {},
  });

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

  return (
    <AppContext.Provider value={{ ...state, dispatch, openTab, closeTab, setActiveTab }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
