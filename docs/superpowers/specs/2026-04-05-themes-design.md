# Theme System Design

10 built-in themes with CSS custom properties, matching CodeMirror themes, status bar switcher, and persistence.

## Themes

1. **Dark** (current, default) — IntelliJ-inspired, #2b2b2b background
2. **Light** — clean white/light gray
3. **Monokai** — dark with warm accents
4. **Solarized Dark** — blue-tinted dark
5. **Solarized Light** — warm cream background
6. **Dracula** — purple-tinted dark
7. **Catppuccin Latte** — light, warm
8. **Catppuccin Frappe** — medium dark
9. **Catppuccin Macchiato** — darker
10. **Catppuccin Mocha** — darkest

## Architecture

### Theme Definition

Each theme is a TypeScript object:

```typescript
interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  colors: {
    bgPrimary: string;       // main background (#2b2b2b)
    bgSecondary: string;     // panels, modals (#3c3f41)
    bgInput: string;         // input fields (#45494a)
    bgHover: string;         // hover states
    textPrimary: string;     // main text (#a9b7c6)
    textMuted: string;       // labels (#888)
    textDisabled: string;    // disabled (#666)
    border: string;          // borders (#515151)
    accent: string;          // active/selected (#4b6eaf)
    accentHover: string;     // accent hover (#5a7dbf)
    danger: string;          // red actions (#ef4444)
    dangerBg: string;        // error backgrounds (#2a0000)
    dangerText: string;      // error text (#c75450)
    success: string;         // success (#4ade80)
    warning: string;         // warning (#f59e0b)
    warningBg: string;       // warning background (#2a2000)
    scrollbar: string;       // scrollbar thumb
    scrollbarHover: string;  // scrollbar thumb hover
    treeActive: string;      // active tree node background
  };
  codemirrorTheme: Extension;
}
```

### File Structure

```
src/renderer/themes/
  types.ts          — ThemeDefinition interface
  dark.ts           — Dark theme (current colors extracted)
  light.ts          — Light theme
  monokai.ts        — Monokai theme
  solarized-dark.ts — Solarized Dark
  solarized-light.ts — Solarized Light
  dracula.ts        — Dracula
  catppuccin-latte.ts    — Catppuccin Latte
  catppuccin-frappe.ts   — Catppuccin Frappe
  catppuccin-macchiato.ts — Catppuccin Macchiato
  catppuccin-mocha.ts    — Catppuccin Mocha
  index.ts          — Registry: exports themes array, getTheme(id), default theme
```

### CSS Variables

Refactor `app.css` to replace all hardcoded colors with CSS custom properties:

```css
:root {
  --bg-primary: #2b2b2b;
  --bg-secondary: #3c3f41;
  --bg-input: #45494a;
  --bg-hover: #4b6eaf;
  --text-primary: #a9b7c6;
  --text-muted: #888;
  --text-disabled: #666;
  --border: #515151;
  --accent: #4b6eaf;
  --accent-hover: #5a7dbf;
  --danger: #ef4444;
  --danger-bg: #2a0000;
  --danger-text: #c75450;
  --success: #4ade80;
  --warning: #f59e0b;
  --warning-bg: #2a2000;
  --scrollbar: #555;
  --scrollbar-hover: #777;
  --tree-active: rgba(75, 110, 175, 0.2);
}
```

Then all CSS rules use `var(--bg-primary)` etc. instead of hardcoded values.

### Theme Application

A `useTheme` hook or function that:
1. Takes a theme ID
2. Looks up the ThemeDefinition
3. Sets all CSS custom properties on `document.documentElement.style`
4. Returns the CodeMirror Extension for use in editors

Called from App.tsx on mount (loading saved theme) and on theme change.

### CodeMirror Integration

Each theme provides a CodeMirror `Extension` (using `@codemirror/theme-one-dark` pattern or `EditorView.theme()`). The SQL Console and SchemaObjectTab pass the active CodeMirror theme as a prop/extension.

For the built-in dark theme, keep `oneDark`. For light themes, use a light CodeMirror theme. For others, create custom CodeMirror themes matching the app colors using `EditorView.theme()` + `HighlightStyle.define()`.

## Theme Switcher

Dropdown in the status bar (bottom-right). Shows the current theme name. On click, opens an upward-expanding dropdown list of all 10 themes. Selecting a theme applies it immediately.

The StatusBar in App.tsx already renders in the bottom bar. Add a theme dropdown to the right side.

## Persistence

Theme ID saved to UI state via `setUiState('theme', themeId)`. Loaded on app startup via `loadUiStateAsync()`. Default: `'dark'`.

## Inline Styles

Components that use inline `style={{ color: '#ef4444' }}` etc. need to be updated to use CSS variables. This includes:
- Context menu danger items → `var(--danger)`
- Error displays → `var(--danger-bg)`, `var(--danger-text)`
- Success messages → `var(--success)`
- Modal backgrounds → `var(--bg-secondary)`
- Input styling → `var(--bg-input)`
- All hardcoded colors in component inline styles

This is the largest part of the refactor — every component with inline color values needs updating.
