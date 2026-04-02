import { useState, useEffect, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
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
  const { setStatus } = useAppContext();
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [where, setWhere] = useState('');
  const [orderBy, setOrderBy] = useState<{ column: string; direction: 'ASC' | 'DESC' } | null>(null);
  const [saveMode, setSaveMode] = useState<'auto' | 'bulk'>(() => (localStorage.getItem('saveMode') as 'auto' | 'bulk') || 'auto');
  const [pendingChanges, setPendingChanges] = useState<Map<string, unknown>>(new Map());
  const [loading, setLoading] = useState(true);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);

  const loadData = useCallback(async (pageNum: number, whereClause: string, sort?: { column: string; direction: 'ASC' | 'DESC' } | null) => {
    setLoading(true);
    setStatus(`Loading ${tab.database}.${tab.table}...`, 'info');
    try {
      if (columns.length === 0) {
        const cols = await ipc.schemaDescribe(tab.connectionId, tab.database!, tab.table!);
        setColumns(cols);
        const pk = cols.find((c: ColumnMeta) => c.key === 'PRI');
        setPrimaryKey(pk ? pk.name : null);
      }

      const sortClause = sort ? `\`${sort.column}\` ${sort.direction}` : undefined;
      const data = await ipc.queryPaginate(tab.connectionId, tab.database!, tab.table!, {
        page: pageNum,
        pageSize: PAGE_SIZE,
        where: whereClause || undefined,
        orderBy: sortClause,
      });

      setRows(data.rows);
      setTotalCount(data.totalCount);
      setPage(pageNum);
      setStatus(`${data.totalCount.toLocaleString()} rows in ${tab.database}.${tab.table}`, 'success');
    } finally {
      setLoading(false);
    }
  }, [tab.connectionId, tab.database, tab.table, columns.length]);

  useEffect(() => {
    loadData(1, '', null);
  }, [tab.connectionId, tab.database, tab.table]);

  const handlePageChange = (newPage: number) => {
    loadData(newPage, where, orderBy);
  };

  const handleFilterChange = (newWhere: string) => {
    setWhere(newWhere);
    loadData(1, newWhere, orderBy);
  };

  const handleRefresh = () => {
    loadData(page, where, orderBy);
  };

  const handleSort = (column: string) => {
    let newSort: { column: string; direction: 'ASC' | 'DESC' } | null;
    if (orderBy?.column === column) {
      if (orderBy.direction === 'ASC') {
        newSort = { column, direction: 'DESC' };
      } else {
        newSort = null; // third click removes sort
      }
    } else {
      newSort = { column, direction: 'ASC' };
    }
    setOrderBy(newSort);
    loadData(1, where, newSort);
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
        onSaveModeChange={(mode) => { setSaveMode(mode); localStorage.setItem('saveMode', mode); }}
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
          orderBy={orderBy}
          onSort={handleSort}
        />
      )}
      {!loading && totalCount > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
