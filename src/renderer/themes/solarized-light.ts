import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#fdf6e3', color: '#657b83' },
    '.cm-content': { caretColor: '#657b83' },
    '.cm-cursor': { borderLeftColor: '#657b83' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#eee8d5' },
    '.cm-activeLine': { backgroundColor: '#eee8d5' },
    '.cm-gutters': { backgroundColor: '#eee8d5', color: '#93a1a1', borderRight: '1px solid #e0dcc7' },
    '.cm-activeLineGutter': { backgroundColor: '#e0dcc7' },
  }, { dark: false });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#859900' },
    { tag: tags.comment, color: '#93a1a1', fontStyle: 'italic' },
    { tag: tags.string, color: '#2aa198' },
    { tag: tags.number, color: '#d33682' },
    { tag: tags.operator, color: '#586e75' },
    { tag: tags.typeName, color: '#cb4b16' },
    { tag: tags.function(tags.variableName), color: '#268bd2' },
    { tag: tags.definition(tags.variableName), color: '#268bd2' },
    { tag: tags.bool, color: '#b58900' },
    { tag: tags.null, color: '#b58900' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const solarizedLight: ThemeDefinition = {
  id: 'solarized-light',
  name: 'Solarized Light',
  isDark: false,
  colors: {
    bgPrimary: '#fdf6e3',
    bgSecondary: '#eee8d5',
    bgInput: '#e0dcc7',
    bgHover: '#268bd21a',
    textPrimary: '#657b83',
    textMuted: '#93a1a1',
    textDisabled: '#b0b8b8',
    border: '#d3cbab',
    borderLight: '#e0dcc7',
    accent: '#268bd2',
    accentHover: '#1a7bc2',
    accentBg: '#d5e8f5',
    danger: '#dc322f',
    dangerBg: '#fce8e8',
    dangerText: '#c62020',
    success: '#859900',
    successBg: '#eef3d5',
    warning: '#b58900',
    warningBg: '#f8f0d0',
    scrollbar: '#c0b890',
    scrollbarHover: '#a09878',
    treeActive: '#d5e8f5',
    rowEven: '#f5efd8',
    rowHover: '#eee8d5',
    rowSelected: '#d5e8f5',
    cellModified: '#e5f0d0',
    cellModifiedText: '#5a7000',
    rowNumBg: '#eee8d5',
    tabActiveBg: '#fdf6e3',
    noPkBg: '#f8f0d0',
    noPkText: '#cb4b16',
    draftBorder: '#859900',
    affectedCount: '#cb4b16',
  },
  codemirrorTheme,
};

export default solarizedLight;
