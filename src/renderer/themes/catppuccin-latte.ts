import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#eff1f5', color: '#4c4f69' },
    '.cm-content': { caretColor: '#4c4f69' },
    '.cm-cursor': { borderLeftColor: '#4c4f69' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#dce0e8' },
    '.cm-activeLine': { backgroundColor: '#e6e9ef' },
    '.cm-gutters': { backgroundColor: '#e6e9ef', color: '#6c6f85', borderRight: '1px solid #ccd0da' },
    '.cm-activeLineGutter': { backgroundColor: '#dce0e8' },
  }, { dark: false });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#8839ef' },
    { tag: tags.comment, color: '#9ca0b0', fontStyle: 'italic' },
    { tag: tags.string, color: '#40a02b' },
    { tag: tags.number, color: '#fe640b' },
    { tag: tags.operator, color: '#04a5e5' },
    { tag: tags.typeName, color: '#df8e1d' },
    { tag: tags.function(tags.variableName), color: '#1e66f5' },
    { tag: tags.definition(tags.variableName), color: '#1e66f5' },
    { tag: tags.bool, color: '#fe640b' },
    { tag: tags.null, color: '#fe640b' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const catppuccinLatte: ThemeDefinition = {
  id: 'catppuccin-latte',
  name: 'Catppuccin Latte',
  isDark: false,
  colors: {
    bgPrimary: '#eff1f5',
    bgSecondary: '#e6e9ef',
    bgInput: '#dce0e8',
    bgHover: '#1e66f51a',
    textPrimary: '#4c4f69',
    textMuted: '#6c6f85',
    textDisabled: '#9ca0b0',
    border: '#ccd0da',
    borderLight: '#dce0e8',
    accent: '#1e66f5',
    accentHover: '#1555d4',
    accentBg: '#d0dffb',
    danger: '#d20f39',
    dangerBg: '#fce4e9',
    dangerText: '#b50d30',
    success: '#40a02b',
    successBg: '#e2f4dd',
    warning: '#df8e1d',
    warningBg: '#faf0db',
    scrollbar: '#bcc0cc',
    scrollbarHover: '#9ca0b0',
    treeActive: '#d0dffb',
    rowEven: '#e9ecf1',
    rowHover: '#e6e9ef',
    rowSelected: '#d0dffb',
    cellModified: '#ddf0d8',
    cellModifiedText: '#2e8a18',
    rowNumBg: '#e6e9ef',
    tabActiveBg: '#eff1f5',
    noPkBg: '#faf0db',
    noPkText: '#df8e1d',
    draftBorder: '#40a02b',
    affectedCount: '#fe640b',
    btnSecondary: '#ccd0da',
    btnSecondaryHover: '#bcc0cc',
  },
  codemirrorTheme,
};

export default catppuccinLatte;
