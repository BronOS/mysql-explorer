import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#272822', color: '#f8f8f2' },
    '.cm-content': { caretColor: '#f8f8f0' },
    '.cm-cursor': { borderLeftColor: '#f8f8f0' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#49483e' },
    '.cm-activeLine': { backgroundColor: '#3e3d32' },
    '.cm-gutters': { backgroundColor: '#2d2e27', color: '#75715e', borderRight: '1px solid #3e3d32' },
    '.cm-activeLineGutter': { backgroundColor: '#3e3d32' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#f92672' },
    { tag: tags.comment, color: '#75715e', fontStyle: 'italic' },
    { tag: tags.string, color: '#e6db74' },
    { tag: tags.number, color: '#ae81ff' },
    { tag: tags.operator, color: '#f92672' },
    { tag: tags.typeName, color: '#66d9ef', fontStyle: 'italic' },
    { tag: tags.function(tags.variableName), color: '#a6e22e' },
    { tag: tags.definition(tags.variableName), color: '#a6e22e' },
    { tag: tags.bool, color: '#ae81ff' },
    { tag: tags.null, color: '#ae81ff' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const monokai: ThemeDefinition = {
  id: 'monokai',
  name: 'Monokai',
  isDark: true,
  colors: {
    bgPrimary: '#272822',
    bgSecondary: '#2d2e27',
    bgInput: '#3e3d32',
    bgHover: '#a6e22e33',
    textPrimary: '#f8f8f2',
    textMuted: '#75715e',
    textDisabled: '#5c5c50',
    border: '#49483e',
    borderLight: '#3e3d32',
    accent: '#a6e22e',
    accentHover: '#b6f23e',
    accentBg: '#3a4a1a',
    danger: '#f92672',
    dangerBg: '#3a0a1a',
    dangerText: '#f92672',
    success: '#a6e22e',
    successBg: '#2a3a0a',
    warning: '#e6db74',
    warningBg: '#3a3520',
    scrollbar: '#555550',
    scrollbarHover: '#75715e',
    treeActive: '#3a4a1a',
    rowEven: '#2a2b24',
    rowHover: '#3e3d32',
    rowSelected: '#3a4a1a',
    cellModified: '#2d3b1d',
    cellModifiedText: '#a6e22e',
    rowNumBg: '#2d2e27',
    tabActiveBg: '#272822',
    noPkBg: '#3a3520',
    noPkText: '#e6db74',
    draftBorder: '#a6e22e',
    affectedCount: '#fd971f',
    btnSecondary: '#4e4e3e',
    btnSecondaryHover: '#5e5e4e',
  },
  codemirrorTheme,
};

export default monokai;
