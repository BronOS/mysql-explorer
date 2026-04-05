import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#002b36', color: '#839496' },
    '.cm-content': { caretColor: '#839496' },
    '.cm-cursor': { borderLeftColor: '#839496' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#073642' },
    '.cm-activeLine': { backgroundColor: '#073642' },
    '.cm-gutters': { backgroundColor: '#073642', color: '#586e75', borderRight: '1px solid #0a4050' },
    '.cm-activeLineGutter': { backgroundColor: '#0a4050' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#859900' },
    { tag: tags.comment, color: '#586e75', fontStyle: 'italic' },
    { tag: tags.string, color: '#2aa198' },
    { tag: tags.number, color: '#d33682' },
    { tag: tags.operator, color: '#93a1a1' },
    { tag: tags.typeName, color: '#cb4b16' },
    { tag: tags.function(tags.variableName), color: '#268bd2' },
    { tag: tags.definition(tags.variableName), color: '#268bd2' },
    { tag: tags.bool, color: '#b58900' },
    { tag: tags.null, color: '#b58900' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const solarizedDark: ThemeDefinition = {
  id: 'solarized-dark',
  name: 'Solarized Dark',
  isDark: true,
  colors: {
    bgPrimary: '#002b36',
    bgSecondary: '#073642',
    bgInput: '#0a4050',
    bgHover: '#268bd233',
    textPrimary: '#839496',
    textMuted: '#586e75',
    textDisabled: '#4a5a60',
    border: '#0a4050',
    borderLight: '#073642',
    accent: '#268bd2',
    accentHover: '#368cd2',
    accentBg: '#0a3050',
    danger: '#dc322f',
    dangerBg: '#2a0a0a',
    dangerText: '#dc322f',
    success: '#859900',
    successBg: '#1a2a00',
    warning: '#b58900',
    warningBg: '#2a2200',
    scrollbar: '#586e75',
    scrollbarHover: '#839496',
    treeActive: '#0a3050',
    rowEven: '#01303b',
    rowHover: '#073642',
    rowSelected: '#0a3050',
    cellModified: '#0a2a10',
    cellModifiedText: '#859900',
    rowNumBg: '#073642',
    tabActiveBg: '#002b36',
    noPkBg: '#2a2200',
    noPkText: '#b58900',
    draftBorder: '#859900',
    affectedCount: '#cb4b16',
  },
  codemirrorTheme,
};

export default solarizedDark;
