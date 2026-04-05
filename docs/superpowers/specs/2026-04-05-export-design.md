# Export Feature Design

Two separate dialogs for exporting table data and database dumps.

## Export Table Dialog

**Entry point:** Table context menu in sidebar ("Export Table")

**Fields:**

- **Format:** SQL (default) | CSV | JSON | Markdown | TSV | HTML Table
- **File:** Folder picker button + editable filename. Default: `{database}.{table}.{ext}`
- **CREATE TABLE statement** checkbox (default ON). Only visible when format is SQL.
  - **IF NOT EXISTS** checkbox (default ON). Only visible when CREATE TABLE is ON.
- **Export Data** checkbox (default ON). Always visible for SQL format. For other formats: enabled and locked (cannot be unchecked).
- **Field list:** Checkboxes for each column + "Select All" toggle. All selected by default. Disabled or hidden when Export Data is OFF.

**Behavior by format:**

- **SQL:** Generates `CREATE TABLE` DDL (using existing `SHOW CREATE TABLE`) followed by `INSERT INTO` statements. Respects CREATE TABLE, IF NOT EXISTS, Export Data, and field list options.
- **CSV/TSV/JSON/Markdown/HTML Table:** Exports data only. Export Data is always ON (locked). CREATE TABLE options hidden. Field list controls which columns appear in output.

**Data fetching:** Fetches all rows from the table (no pagination limit) via a dedicated IPC call. Simple "Exporting..." button state during export.

## Export Database Dialog

**Entry point:** Database context menu in sidebar ("Export Database")

**Format:** SQL only (no format picker).

**Fields:**

- **File:** Folder picker button + editable filename. Default: `{database}.sql`
- **CREATE DATABASE** checkbox (default ON).
  - **IF NOT EXISTS** checkbox (default ON). Only visible when CREATE DATABASE is ON.
- **CREATE TABLE** checkbox (default ON).
  - **IF NOT EXISTS** checkbox (default ON). Only visible when CREATE TABLE is ON.
- **Export Data** checkbox (default ON).
- **Table list:** Checkboxes for each table in the database + "Select All" toggle. All selected by default.

**SQL output order:**

1. `CREATE DATABASE` statement (if enabled)
2. `USE {database};`
3. For each selected table:
   a. `CREATE TABLE` DDL (if enabled), with IF NOT EXISTS injected if that option is ON
   b. `INSERT INTO` statements for all rows (if Export Data is ON)

## Shared Architecture

**Main process (IPC):**

- `export:pick-save-file` — opens native save dialog, returns chosen file path
- `export:write-file` — writes content string to file
- `export:fetch-all-rows` — fetches all rows from a table, optionally filtered to specific columns
- Reuse existing `schema:create-table` IPC for getting CREATE TABLE DDL
- Reuse existing `schema:tables` IPC for listing tables in a database

**Preload:** Expose the new IPC methods to the renderer.

**Components:**

- `ExportTableDialog.tsx` — single-table export modal
- `ExportDatabaseDialog.tsx` — database dump modal

**Formatting:** Reuse the same formatting logic as existing copy-to-clipboard (cellToString, CSV escaping, SQL INSERT generation, etc.), extracted if needed for sharing between DataGrid and export dialogs.

## IF NOT EXISTS Injection

For CREATE TABLE: parse the DDL returned by `SHOW CREATE TABLE` and inject `IF NOT EXISTS` after `CREATE TABLE`.

For CREATE DATABASE: construct `CREATE DATABASE IF NOT EXISTS \`{name}\`` directly.
