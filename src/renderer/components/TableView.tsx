import { useState, useEffect, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { ColumnMeta, TabInfo } from '../../shared/types';
import FilterTopbar from './FilterTopbar';
import DataGrid from './DataGrid';
import Pagination from './Pagination';

interface Props {
  tab: TabInfo;
}

const PAGE_SIZE = 1000;

export default function TableView({ tab }: Props) {
  const ipc = useIpc();
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [where, setWhere] = useState('');
  const [saveMode, setSaveMode] = useState<'auto' | 'bulk'>('auto');
  const [pendingChanges, setPendingChanges] = useState<Map<string, unknown>>(new Map());
  const [loading, setLoading] = useState(true);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);

  const loadData = useCallback(async (pageNum: number, whereClause: string) => {
    setLoading(true);
    try {
      if (columns.length === 0) {
        const cols = await ipc.schemaDescribe(tab.connectionId, tab.database!, tab.table!);
        setColumns(cols);
        const pk = cols.find((c: ColumnMeta) => c.key === 'PRI');
        setPrimaryKey(pk ? pk.name : null);
      }

      const data = await ipc.queryPaginate(tab.connectionId, tab.database!, tab.table!, {
        page: pageNum,
        pageSize: PAGE_SIZE,
        where: whereClause || undefined,
      });

      setRows(data.rows);
      setTotalCount(data.totalCount);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  }, [tab.connectionId, tab.database, tab.table, columns.length]);

  useEffect(() => {
    loadData(1, '');
  }, [tab.connectionId, tab.database, tab.table]);

  const handlePageChange = (newPage: number) => {
    loadData(newPage, where);
  };

  const handleFilterChange = (newWhere: string) => {
    setWhere(newWhere);
    loadData(1, newWhere);
  };

  const handleRefresh = () => {
    loadData(page, where);
  };

  const handleCellSave = async (pkValue: unknown, column: string, value: unknown) => {
    if (saveMode === 'auto') {
      await ipc.queryUpdate(tab.connectionId, tab.database!, tab.table!, column, value, primaryKey!, pkValue);
      handleRefresh();
    } else {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(`${pkValue}:${column}`, value);
        return next;
      });
    }
  };

  const handleBulkCommit = async () => {
    if (!primaryKey || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.entries()).map(([key, value]) => {
      const separatorIdx = key.indexOf(':');
      const pkValue = key.slice(0, separatorIdx);
      const column = key.slice(separatorIdx + 1);
      return { pkValue, column, value };
    });
    await ipc.queryBulkUpdate(tab.connectionId, tab.database!, tab.table!, primaryKey, changes);
    setPendingChanges(new Map());
    handleRefresh();
  };

  return (
    <div className="table-view">
      <FilterTopbar
        columns={columns}
        onFilterChange={handleFilterChange}
        saveMode={saveMode}
        onSaveModeChange={setSaveMode}
        onRefresh={handleRefresh}
      />
      {saveMode === 'bulk' && pendingChanges.size > 0 && (
        <div className="bulk-commit-bar">
          <span>{pendingChanges.size} pending change(s)</span>
          <button className="btn btn-primary" onClick={handleBulkCommit}>Commit</button>
          <button className="btn btn-secondary" onClick={() => setPendingChanges(new Map())}>Discard</button>
        </div>
      )}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          primaryKey={primaryKey}
          saveMode={saveMode}
          onCellSave={handleCellSave}
          pendingChanges={pendingChanges}
        />
      )}
      {!loading && totalCount > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
