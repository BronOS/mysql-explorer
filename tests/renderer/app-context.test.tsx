import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useAppContext } from '../../src/renderer/context/app-context';
import React from 'react';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  describe('tab management', () => {
    it('opens a new tab', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({
          connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff',
          type: 'table', database: 'app_db', table: 'users',
        });
      });
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].table).toBe('users');
      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it('focuses existing tab instead of duplicating', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'app_db', table: 'users' });
      });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'app_db', table: 'users' });
      });
      expect(result.current.tabs).toHaveLength(1);
    });

    it('evicts oldest tab when exceeding 10', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      for (let i = 0; i < 11; i++) {
        act(() => {
          result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'db', table: `table_${i}` });
        });
      }
      expect(result.current.tabs).toHaveLength(10);
      expect(result.current.tabs.find(t => t.table === 'table_0')).toBeUndefined();
    });

    it('closes a tab', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'db', table: 'users' });
      });
      const tabId = result.current.tabs[0].id;
      act(() => { result.current.closeTab(tabId); });
      expect(result.current.tabs).toHaveLength(0);
      expect(result.current.activeTabId).toBeNull();
    });
  });
});
