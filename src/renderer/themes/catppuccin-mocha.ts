import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#1e1e2e', color: '#cdd6f4' },
    '.cm-content': { caretColor: '#cdd6f4' },
    '.cm-cursor': { borderLeftColor: '#cdd6f4' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#313244' },
    '.cm-activeLine': { backgroundColor: '#28283a' },
    '.cm-gutters': { backgroundColor: '#181825', color: '#a6adc8', borderRight: '1px solid #313244' },
    '.cm-activeLineGutter': { backgroundColor: '#28283a' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#cba6f7' },
    { tag: tags.comment, color: '#6c7086', fontStyle: 'italic' },
    { tag: tags.string, color: '#a6e3a1' },
    { tag: tags.number, color: '#fab387' },
    { tag: tags.operator, color: '#89dceb' },
    { tag: tags.typeName, color: '#f9e2af' },
    { tag: tags.function(tags.variableName), color: '#89b4fa' },
    { tag: tags.definition(tags.variableName), color: '#89b4fa' },
    { tag: tags.bool, color: '#fab387' },
    { tag: tags.null, color: '#fab387' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const catppuccinMocha: ThemeDefinition = {
  id: 'catppuccin-mocha',
  name: 'Catppuccin Mocha',
  isDark: true,
  colors: {
    bgPrimary: '#1e1e2e',
    bgSecondary: '#181825',
    bgInput: '#313244',
    bgHover: '#89b4fa33',
    textPrimary: '#cdd6f4',
    textMuted: '#a6adc8',
    textDisabled: '#6c7086',
    border: '#313244',
    borderLight: '#28283a',
    accent: '#89b4fa',
    accentHover: '#99c2fb',
    accentBg: '#1e2d4a',
    danger: '#f38ba8',
    dangerBg: '#301520',
    dangerText: '#f38ba8',
    success: '#a6e3a1',
    successBg: '#152e1a',
    warning: '#f9e2af',
    warningBg: '#302a15',
    scrollbar: '#45475a',
    scrollbarHover: '#585b70',
    treeActive: '#1e2d4a',
    rowEven: '#212132',
    rowHover: '#28283a',
    rowSelected: '#1e2d4a',
    cellModified: '#152a1a',
    cellModifiedText: '#a6e3a1',
    rowNumBg: '#1b1b2a',
    tabActiveBg: '#1e1e2e',
    noPkBg: '#302a15',
    noPkText: '#f9e2af',
    draftBorder: '#a6e3a1',
    affectedCount: '#fab387',
  },
  codemirrorTheme,
};

export default catppuccinMocha;
