# Schema Objects Browser & Editor Design

Browse, view, edit, create, and drop Views, Procedures, Functions, Triggers, and Events from the sidebar and dedicated tabs.

## Sidebar Tree

Five new expandable groups under each database, below Tables:

```
▸ database_name
  ▸ Tables (12)
  ▸ Views (3)
  ▸ Procedures (5)
  ▸ Functions (2)
  ▸ Triggers (1)
  ▸ Events (0)
```

- Always shown, even when empty (dimmed with count 0).
- Each group expands to list object names.
- Groups load lazily when expanded (same pattern as table loading).

## Context Menus

**On a group header** (e.g. right-click "Procedures"):
- "New Procedure" — opens a new tab in edit mode with a DDL template.

**On an individual object** (e.g. right-click "my_procedure"):
- "Open" — opens a tab showing the DDL in view mode.
- "Drop" — red text, confirm dialog (`Drop procedure \`my_procedure\`? This cannot be undone.`), then executes `DROP PROCEDURE \`name\``.

## Tab View

A new tab type `'object'` with a single CodeMirror editor (same SQL config as SqlConsole — syntax highlighting, oneDark theme, lang-sql).

**View mode** (default when opening existing object):
- Read-only CodeMirror displaying the DDL.
- "Edit" button in the toolbar to switch to edit mode.

**Edit mode**:
- Editable CodeMirror with the DDL.
- Toolbar buttons: "Save", "Discard" (returns to view mode with original DDL).
- "Save" shows a confirmation dialog displaying the exact SQL that will be executed (DROP + CREATE), then executes on confirm.
- On successful save, switches back to view mode with the new DDL.

**Toolbar also shows:** object type label and name (e.g. "Procedure: my_procedure").

## New Object

Triggered from group context menu ("New View", "New Procedure", etc.).

Opens a tab in edit mode with a pre-filled DDL template:

- **View:** `CREATE VIEW \`new_view\` AS\nSELECT * FROM \`table_name\`;`
- **Procedure:** `CREATE PROCEDURE \`new_procedure\`()\nBEGIN\n  \nEND`
- **Function:** `CREATE FUNCTION \`new_function\`() RETURNS INT\nBEGIN\n  RETURN 0;\nEND`
- **Trigger:** `CREATE TRIGGER \`new_trigger\`\nBEFORE INSERT ON \`table_name\`\nFOR EACH ROW\nBEGIN\n  \nEND`
- **Event:** `CREATE EVENT \`new_event\`\nON SCHEDULE EVERY 1 DAY\nDO\nBEGIN\n  \nEND`

Saving a new object executes the CREATE statement directly (no DROP needed). On success, refreshes the sidebar group and switches to view mode.

## Save Confirmation Dialog

Modal showing:
- Title: "Execute DDL"
- Body: the SQL statements that will run, displayed in a monospace pre-formatted block. For existing objects: `DROP {TYPE} \`name\`;` followed by the new `CREATE ...` statement. For new objects: just the `CREATE ...` statement.
- Buttons: "Cancel" and "Execute".

## Drop Behavior

For procedures, functions, triggers, and events, the DROP statement is straightforward:
- `DROP VIEW \`name\``
- `DROP PROCEDURE \`name\``
- `DROP FUNCTION \`name\``
- `DROP TRIGGER \`name\``
- `DROP EVENT \`name\``

After dropping, close any open tab for the object and refresh the sidebar group.

## IPC

**Existing (already implemented):**
- `schema:views`, `schema:create-view` — list and get DDL
- `schema:procedures`, `schema:create-procedure`
- `schema:functions`, `schema:create-function`
- `schema:triggers`, `schema:create-trigger`
- `schema:events`, `schema:create-event`

**New:**
- `schema:execute-ddl` — executes one or more raw DDL statements (used for DROP, CREATE, and DROP+CREATE sequences). Takes connectionId and sql string, executes via pool.query.
- `schema:drop-object` — executes `DROP {TYPE} \`database\`.\`name\`` for the given object type. Takes connectionId, database, objectType ('VIEW'|'PROCEDURE'|'FUNCTION'|'TRIGGER'|'EVENT'), and name.

## TabInfo Extension

Add to the TabInfo type:
- `type: 'table' | 'console' | 'schema' | 'object'`
- `objectType?: 'view' | 'procedure' | 'function' | 'trigger' | 'event'`
- `objectName?: string`

## Components

- `SchemaObjectTab.tsx` — the tab component with CodeMirror, view/edit toggle, save/discard, confirmation dialog.
- Sidebar.tsx modifications — new groups in the tree, context menus, lazy loading.

## Schema Tree State Extension

The existing schema tree stores `databases[].tables`. Extend to also store:
- `views: string[]`
- `procedures: string[]`
- `functions: string[]`
- `triggers: string[]`
- `events: string[]`

With corresponding dispatch actions to set them (same pattern as SET_TABLES).
