import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#ffffff', color: '#2b2b2b' },
    '.cm-content': { caretColor: '#2b2b2b' },
    '.cm-cursor': { borderLeftColor: '#2b2b2b' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#d7e4f2' },
    '.cm-activeLine': { backgroundColor: '#f0f4f8' },
    '.cm-gutters': { backgroundColor: '#f5f5f5', color: '#999', borderRight: '1px solid #d0d0d0' },
    '.cm-activeLineGutter': { backgroundColor: '#e8ecf0' },
  }, { dark: false });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#0033b3' },
    { tag: tags.comment, color: '#8c8c8c', fontStyle: 'italic' },
    { tag: tags.string, color: '#067d17' },
    { tag: tags.number, color: '#1750eb' },
    { tag: tags.operator, color: '#2b2b2b' },
    { tag: tags.typeName, color: '#7a2e8a' },
    { tag: tags.function(tags.variableName), color: '#00627a' },
    { tag: tags.definition(tags.variableName), color: '#00627a' },
    { tag: tags.bool, color: '#0033b3' },
    { tag: tags.null, color: '#0033b3' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const light: ThemeDefinition = {
  id: 'light',
  name: 'Light',
  isDark: false,
  colors: {
    bgPrimary: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgInput: '#e8e8e8',
    bgHover: '#4b6eaf1a',
    textPrimary: '#2b2b2b',
    textMuted: '#666666',
    textDisabled: '#999999',
    border: '#d0d0d0',
    borderLight: '#e0e0e0',
    accent: '#4b6eaf',
    accentHover: '#3a5d9e',
    accentBg: '#d7e4f2',
    danger: '#dc3545',
    dangerBg: '#fdeaea',
    dangerText: '#c62828',
    success: '#28a745',
    successBg: '#e6f4ea',
    warning: '#ffc107',
    warningBg: '#fff8e1',
    scrollbar: '#c0c0c0',
    scrollbarHover: '#a0a0a0',
    treeActive: '#d7e4f2',
    rowEven: '#f8f8f8',
    rowHover: '#eef2f8',
    rowSelected: '#d7e4f2',
    cellModified: '#e6f4ea',
    cellModifiedText: '#1b7a2b',
    rowNumBg: '#f0f0f0',
    tabActiveBg: '#ffffff',
    noPkBg: '#fff8e1',
    noPkText: '#e65100',
    draftBorder: '#28a745',
    affectedCount: '#e65100',
  },
  codemirrorTheme,
};

export default light;
