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
  const [draftRows, setDraftRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);

  const loadData = useCallback(async (pageNum: number, whereClause: string, sort?: { column: string; direction: 'ASC' | 'DESC' } | null) => {
    const isInitial = rows.length === 0 && columns.length === 0;
    if (isInitial) setLoading(true);
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
  }, [tab.connectionId, tab.database, tab.table, columns.length, rows.length]);

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
        newSort = null;
      }
    } else {
      newSort = { column, direction: 'ASC' };
    }
    setOrderBy(newSort);
    loadData(1, where, newSort);
  };

  const handleCellSave = async (pkValue: unknown, column: string, value: unknown) => {
    // Check if this is a draft row edit
    const draftIdx = draftRows.findIndex(r => r.__draftId === pkValue);
    if (draftIdx >= 0) {
      setDraftRows(prev => prev.map(r => r.__draftId === pkValue ? { ...r, [column]: value } : r));
      return;
    }

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
    // Commit pending changes (updates)
    if (primaryKey && pendingChanges.size > 0) {
      const changes = Array.from(pendingChanges.entries()).map(([key, value]) => {
        const separatorIdx = key.indexOf(':');
        const pkValue = key.slice(0, separatorIdx);
        const column = key.slice(separatorIdx + 1);
        return { pkValue, column, value };
      });
      await ipc.queryBulkUpdate(tab.connectionId, tab.database!, tab.table!, primaryKey, changes);
      setPendingChanges(new Map());
    }

    // Commit draft rows (inserts)
    if (draftRows.length > 0) {
      const rowsToInsert = draftRows.map(r => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          // Skip auto-increment if user didn't change it from default
          if (col.extra === 'auto_increment' && (r[col.name] === '(auto)' || r[col.name] === undefined)) continue;
          if (r[col.name] !== undefined && r[col.name] !== null) {
            row[col.name] = r[col.name];
          }
        }
        return row;
      });
      await ipc.queryInsertRows(tab.connectionId, tab.database!, tab.table!, rowsToInsert);
      setDraftRows([]);
      setStatus(`${rowsToInsert.length} row(s) inserted`, 'success');
    }

    handleRefresh();
  };

  const handleAddRow = () => {
    const newRow: Record<string, unknown> = { __draftId: `draft_${Date.now()}_${Math.random()}` };
    for (const col of columns) {
      if (col.extra === 'auto_increment') {
        newRow[col.name] = '(auto)';
      } else if (col.defaultValue !== null) {
        newRow[col.name] = col.defaultValue;
      } else {
        newRow[col.name] = null;
      }
    }
    setDraftRows(prev => [...prev, newRow]);
  };

  const handleDuplicateRow = (row: Record<string, unknown>) => {
    const newRow: Record<string, unknown> = { __draftId: `draft_${Date.now()}_${Math.random()}` };
    for (const col of columns) {
      if (col.extra === 'auto_increment') {
        newRow[col.name] = '(auto)';
      } else {
        newRow[col.name] = row[col.name];
      }
    }
    setDraftRows(prev => [...prev, newRow]);
  };

  const handleDeleteRow = async (pkValue: unknown) => {
    if (!primaryKey) return;
    await ipc.queryDeleteRow(tab.connectionId, tab.database!, tab.table!, primaryKey, pkValue);
    setStatus('Row deleted', 'success');
    handleRefresh();
  };

  const handleDeleteDraftRow = (draftId: string) => {
    setDraftRows(prev => prev.filter(r => r.__draftId !== draftId));
  };

  const handleDiscardDrafts = () => {
    setDraftRows([]);
    setPendingChanges(new Map());
  };

  const hasPending = pendingChanges.size > 0 || draftRows.length > 0;

  return (
    <div className="table-view">
      <FilterTopbar
        columns={columns}
        onFilterChange={handleFilterChange}
        saveMode={saveMode}
        onSaveModeChange={(mode) => { setSaveMode(mode); localStorage.setItem('saveMode', mode); }}
        onRefresh={handleRefresh}
        onAddRow={handleAddRow}
      />
      {hasPending && (
        <div className="bulk-commit-bar">
          <span>
            {draftRows.length > 0 && `${draftRows.length} new row(s)`}
            {draftRows.length > 0 && pendingChanges.size > 0 && ', '}
            {pendingChanges.size > 0 && `${pendingChanges.size} change(s)`}
          </span>
          <button className="btn btn-primary" onClick={handleBulkCommit}>Commit</button>
          <button className="btn btn-secondary" onClick={handleDiscardDrafts}>Discard</button>
        </div>
      )}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          draftRows={draftRows}
          primaryKey={primaryKey}
          saveMode={saveMode}
          onCellSave={handleCellSave}
          pendingChanges={pendingChanges}
          orderBy={orderBy}
          onSort={handleSort}
          onDuplicateRow={handleDuplicateRow}
          onDeleteRow={handleDeleteRow}
          onDeleteDraftRow={handleDeleteDraftRow}
        />
      )}
      {!loading && totalCount > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
