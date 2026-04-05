import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#282a36', color: '#f8f8f2' },
    '.cm-content': { caretColor: '#f8f8f0' },
    '.cm-cursor': { borderLeftColor: '#f8f8f0' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#44475a' },
    '.cm-activeLine': { backgroundColor: '#383a4a' },
    '.cm-gutters': { backgroundColor: '#282a36', color: '#6272a4', borderRight: '1px solid #44475a' },
    '.cm-activeLineGutter': { backgroundColor: '#383a4a' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#ff79c6' },
    { tag: tags.comment, color: '#6272a4', fontStyle: 'italic' },
    { tag: tags.string, color: '#f1fa8c' },
    { tag: tags.number, color: '#bd93f9' },
    { tag: tags.operator, color: '#ff79c6' },
    { tag: tags.typeName, color: '#8be9fd', fontStyle: 'italic' },
    { tag: tags.function(tags.variableName), color: '#50fa7b' },
    { tag: tags.definition(tags.variableName), color: '#50fa7b' },
    { tag: tags.bool, color: '#bd93f9' },
    { tag: tags.null, color: '#bd93f9' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const dracula: ThemeDefinition = {
  id: 'dracula',
  name: 'Dracula',
  isDark: true,
  colors: {
    bgPrimary: '#282a36',
    bgSecondary: '#44475a',
    bgInput: '#383a4a',
    bgHover: '#bd93f933',
    textPrimary: '#f8f8f2',
    textMuted: '#6272a4',
    textDisabled: '#4a5068',
    border: '#44475a',
    borderLight: '#383a4a',
    accent: '#bd93f9',
    accentHover: '#caa4fa',
    accentBg: '#3a2a5a',
    danger: '#ff5555',
    dangerBg: '#3a1515',
    dangerText: '#ff5555',
    success: '#50fa7b',
    successBg: '#153a1f',
    warning: '#f1fa8c',
    warningBg: '#3a3a15',
    scrollbar: '#555570',
    scrollbarHover: '#6272a4',
    treeActive: '#3a2a5a',
    rowEven: '#2c2e3a',
    rowHover: '#383a4a',
    rowSelected: '#3a2a5a',
    cellModified: '#1a3a2a',
    cellModifiedText: '#50fa7b',
    rowNumBg: '#2e3040',
    tabActiveBg: '#282a36',
    noPkBg: '#3a3a15',
    noPkText: '#ffb86c',
    draftBorder: '#50fa7b',
    affectedCount: '#ffb86c',
    btnSecondary: '#44475a',
    btnSecondaryHover: '#515470',
  },
  codemirrorTheme,
};

export default dracula;
