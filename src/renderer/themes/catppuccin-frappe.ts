import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#303446', color: '#c6d0f5' },
    '.cm-content': { caretColor: '#c6d0f5' },
    '.cm-cursor': { borderLeftColor: '#c6d0f5' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#414559' },
    '.cm-activeLine': { backgroundColor: '#363a4f' },
    '.cm-gutters': { backgroundColor: '#292c3c', color: '#a5adce', borderRight: '1px solid #414559' },
    '.cm-activeLineGutter': { backgroundColor: '#363a4f' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#ca9ee6' },
    { tag: tags.comment, color: '#737994', fontStyle: 'italic' },
    { tag: tags.string, color: '#a6d189' },
    { tag: tags.number, color: '#ef9f76' },
    { tag: tags.operator, color: '#99d1db' },
    { tag: tags.typeName, color: '#e5c890' },
    { tag: tags.function(tags.variableName), color: '#8caaee' },
    { tag: tags.definition(tags.variableName), color: '#8caaee' },
    { tag: tags.bool, color: '#ef9f76' },
    { tag: tags.null, color: '#ef9f76' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const catppuccinFrappe: ThemeDefinition = {
  id: 'catppuccin-frappe',
  name: 'Catppuccin Frappe',
  isDark: true,
  colors: {
    bgPrimary: '#303446',
    bgSecondary: '#292c3c',
    bgInput: '#414559',
    bgHover: '#8caaee33',
    textPrimary: '#c6d0f5',
    textMuted: '#a5adce',
    textDisabled: '#737994',
    border: '#414559',
    borderLight: '#363a4f',
    accent: '#8caaee',
    accentHover: '#9cb8f0',
    accentBg: '#2a3558',
    danger: '#e78284',
    dangerBg: '#3a2020',
    dangerText: '#e78284',
    success: '#a6d189',
    successBg: '#203a20',
    warning: '#e5c890',
    warningBg: '#3a3520',
    scrollbar: '#51576d',
    scrollbarHover: '#626880',
    treeActive: '#2a3558',
    rowEven: '#333748',
    rowHover: '#3a3e50',
    rowSelected: '#2a3558',
    cellModified: '#203520',
    cellModifiedText: '#a6d189',
    rowNumBg: '#2d3040',
    tabActiveBg: '#303446',
    noPkBg: '#3a3520',
    noPkText: '#e5c890',
    draftBorder: '#a6d189',
    affectedCount: '#ef9f76',
  },
  codemirrorTheme,
};

export default catppuccinFrappe;
