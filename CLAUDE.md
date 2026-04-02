# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MySQL Explorer — personal Electron desktop app for browsing and editing MySQL databases. Built with Electron Forge + React + TypeScript.

## Architecture

Electron main process handles all MySQL connections (mysql2), SSH tunnels (ssh2), config persistence, and SQL file storage. React renderer communicates via IPC invoke/handle. State managed with React context + useReducer.

- `src/main/` — Electron main process: ConnectionManager, SchemaBrowser, QueryExecutor, FileManager, IPC handlers
- `src/preload/` — contextBridge exposing typed IPC API to renderer
- `src/renderer/` — React UI: components, context, hooks
- `src/shared/types.ts` — TypeScript types shared between main and renderer

## Commands

- `npm start` — launch the app in development mode
- `npm test` — run all tests with Vitest
- `npm test -- tests/main/file-manager.test.ts` — run a single test file
- `npm run make` — build distributable packages

## Key Libraries

- **TanStack Table** for data grids (DataGrid.tsx, ResultTable.tsx)
- **CodeMirror 6** with @codemirror/lang-sql for the SQL editor (SqlConsole.tsx)
- **mysql2/promise** for MySQL connections (connection-manager.ts)
- **ssh2** for SSH tunneling (connection-manager.ts)

## Connection configs stored in Electron's userData directory as connections.json. SQL console files persisted as {connectionId}.sql in the same location.
