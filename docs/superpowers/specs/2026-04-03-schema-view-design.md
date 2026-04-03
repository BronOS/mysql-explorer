# Schema View — Design Spec

Table schema viewer/editor for MySQL Explorer, opened as a dedicated tab per table.

## Opening

Right-click a table in sidebar → "View Schema" opens a new tab with icon `🔧` and title `Schema: tablename`. Uses the same tab system (max 10, connection badge, closeable, draggable).

Tab type: `'schema'` added to `TabInfo.type` union. `TabInfo` carries `connectionId`, `database`, and `table` same as table tabs.

## Layout

Three vertically stacked zones with resizable dividers between them.

## Zone 1: Columns Grid

Editable grid showing all column metadata. **Bulk commit only** — no auto-save.

### Data Source

`SHOW FULL COLUMNS FROM \`database\`.\`table\`` — returns Field, Type, Collation, Null, Key, Default, Extra, Privileges, Comment.

### Grid Columns

| Column | Source | Editor | Notes |
|---|---|---|---|
| Field | Field | text input | Column name |
| Type | parsed from Type | dropdown (INT, VARCHAR, TEXT, MEDIUMTEXT, LONGTEXT, ENUM, DATETIME, TIMESTAMP, TINYINT, BIGINT, DECIMAL, FLOAT, DOUBLE, DATE, BLOB, etc.) | Base type without length |
| Length | parsed from Type | text input | e.g. 255 from varchar(255), 11 from int(11) |
| Unsigned | parsed from Type | checkbox | Contains "unsigned" |
| Zerofill | parsed from Type | checkbox | Contains "zerofill" |
| Binary | parsed from Type | checkbox | Contains "binary" |
| Allow Null | Null | checkbox | YES/NO |
| Key | Key | read-only | PRI, MUL, UNI, or empty |
| Default | Default | text input | Default value |
| Encoding | parsed from Collation | dropdown | Character set (utf8mb4, latin1, etc.) |
| Extra | Extra | dropdown (None, auto_increment, on update current_timestamp, etc.) | |
| Collation | Collation | dropdown | e.g. utf8mb4_unicode_ci |
| Comment | Comment | text input | |

### Toolbar

- **+ Add Column** — appends a draft row at bottom with defaults: Type=VARCHAR, Length=255, Allow Null=checked, rest empty
- **Refresh** — re-fetches column data
- **Commit** — shown when changes pending. Generates and executes ALTER TABLE statements
- **Discard** — shown when changes pending. Reverts all edits and draft rows

### Editing

- Double-click to edit text fields
- Single click toggles checkboxes
- Modified cells visually highlighted (green background)
- Draft rows have green left border (same style as table view)

### Commit Logic

For each modified existing column:
```sql
ALTER TABLE `db`.`table` MODIFY COLUMN `name` type(length) [UNSIGNED] [ZEROFILL] [BINARY] [NOT NULL | NULL] [DEFAULT value] [Extra] [COMMENT 'comment'] [CHARACTER SET charset] [COLLATE collation];
```

For each new (draft) column:
```sql
ALTER TABLE `db`.`table` ADD COLUMN `name` type(length) [UNSIGNED] [ZEROFILL] [BINARY] [NOT NULL | NULL] [DEFAULT value] [Extra] [COMMENT 'comment'] [CHARACTER SET charset] [COLLATE collation];
```

### Drop Column

- "Drop" action per row
- Immediate execution with confirm dialog: "Drop column `name` from `table`?"
- Executes: `ALTER TABLE \`db\`.\`table\` DROP COLUMN \`name\``
- Refreshes all three zones after

## Zone 2: Indexes Grid

Grid showing all table indexes. Add/edit via dialog, drop with confirmation.

### Data Source

`SHOW INDEX FROM \`database\`.\`table\`` — returns Table, Non_unique, Key_name, Seq_in_index, Column_name, Collation, Cardinality, Sub_part, Packed, Null, Index_type, Comment.

Grouped by Key_name (multi-column indexes appear as multiple rows in SHOW INDEX, we group them into one row in the grid).

### Grid Columns

| Column | Source | Notes |
|---|---|---|
| Name | Key_name | Index name |
| Type | Index_type | BTREE, HASH, FULLTEXT |
| Columns | Column_name (grouped) | Comma-separated list |
| Unique | Non_unique = 0 | YES/NO |
| Actions | — | Edit, Drop buttons |

### Toolbar

- **+ Add Index** — opens index dialog
- **Refresh** — re-fetches index data

### Index Dialog

Modal dialog with:
- **Name** — text input (auto-generated suggestion like `idx_colname`)
- **Type** — dropdown: INDEX, UNIQUE, FULLTEXT
- **Columns** — list of all table columns with checkboxes + order drag or up/down buttons
- **Save** button

Used for both Add and Edit. When editing, pre-filled with current values.

### Add Index SQL

```sql
ALTER TABLE `db`.`table` ADD [UNIQUE|FULLTEXT] INDEX `name` (`col1`, `col2`);
```

### Edit Index SQL

```sql
ALTER TABLE `db`.`table` DROP INDEX `old_name`, ADD [UNIQUE|FULLTEXT] INDEX `new_name` (`col1`, `col2`);
```

### Drop Index

- "Drop" action per row
- Immediate execution with confirm dialog: "Drop index `name` from `table`?"
- Executes: `ALTER TABLE \`db\`.\`table\` DROP INDEX \`name\`` (or `DROP PRIMARY KEY` for primary)
- Refreshes all three zones after

## Zone 3: CREATE TABLE DDL

Read-only display of the full table DDL.

### Data Source

`SHOW CREATE TABLE \`database\`.\`table\`` — returns the complete CREATE TABLE statement.

### Display

- SQL syntax highlighted (keywords in orange, types in blue, strings in green — matching Darcula theme)
- Monospace font
- Selectable text for manual copy
- Toolbar with **Copy** button (copies raw DDL text to clipboard)

### Auto-Refresh

Refreshes after any successful commit, column drop, or index add/edit/drop.

## IPC Additions

| Channel | Purpose |
|---|---|
| `schema:full-columns` | Run `SHOW FULL COLUMNS FROM` |
| `schema:indexes` | Run `SHOW INDEX FROM` |
| `schema:create-table` | Run `SHOW CREATE TABLE` |
| `schema:alter-table` | Run arbitrary ALTER TABLE SQL |

## New Components

| Component | Purpose |
|---|---|
| `SchemaView.tsx` | Container: three zones with resizable dividers |
| `SchemaColumns.tsx` | Zone 1: columns grid with toolbar |
| `SchemaIndexes.tsx` | Zone 2: indexes grid with toolbar |
| `SchemaDDL.tsx` | Zone 3: DDL display |
| `IndexDialog.tsx` | Modal for add/edit index |
