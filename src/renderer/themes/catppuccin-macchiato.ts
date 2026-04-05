import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { ThemeDefinition } from './types';

function codemirrorTheme(): Extension {
  const theme = EditorView.theme({
    '&': { backgroundColor: '#24273a', color: '#cad3f5' },
    '.cm-content': { caretColor: '#cad3f5' },
    '.cm-cursor': { borderLeftColor: '#cad3f5' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#363a4f' },
    '.cm-activeLine': { backgroundColor: '#2e3248' },
    '.cm-gutters': { backgroundColor: '#1e2030', color: '#a5adcb', borderRight: '1px solid #363a4f' },
    '.cm-activeLineGutter': { backgroundColor: '#2e3248' },
  }, { dark: true });

  const highlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#c6a0f6' },
    { tag: tags.comment, color: '#6e738d', fontStyle: 'italic' },
    { tag: tags.string, color: '#a6da95' },
    { tag: tags.number, color: '#f5a97f' },
    { tag: tags.operator, color: '#91d7e3' },
    { tag: tags.typeName, color: '#eed49f' },
    { tag: tags.function(tags.variableName), color: '#8aadf4' },
    { tag: tags.definition(tags.variableName), color: '#8aadf4' },
    { tag: tags.bool, color: '#f5a97f' },
    { tag: tags.null, color: '#f5a97f' },
  ]);

  return [theme, syntaxHighlighting(highlighting)];
}

const catppuccinMacchiato: ThemeDefinition = {
  id: 'catppuccin-macchiato',
  name: 'Catppuccin Macchiato',
  isDark: true,
  colors: {
    bgPrimary: '#24273a',
    bgSecondary: '#1e2030',
    bgInput: '#363a4f',
    bgHover: '#8aadf433',
    textPrimary: '#cad3f5',
    textMuted: '#a5adcb',
    textDisabled: '#6e738d',
    border: '#363a4f',
    borderLight: '#2e3248',
    accent: '#8aadf4',
    accentHover: '#9abaf6',
    accentBg: '#243050',
    danger: '#ed8796',
    dangerBg: '#351a20',
    dangerText: '#ed8796',
    success: '#a6da95',
    successBg: '#1a3520',
    warning: '#eed49f',
    warningBg: '#35301a',
    scrollbar: '#494d64',
    scrollbarHover: '#5b6078',
    treeActive: '#243050',
    rowEven: '#272a3e',
    rowHover: '#2e3248',
    rowSelected: '#243050',
    cellModified: '#1a3020',
    cellModifiedText: '#a6da95',
    rowNumBg: '#212435',
    tabActiveBg: '#24273a',
    noPkBg: '#35301a',
    noPkText: '#eed49f',
    draftBorder: '#a6da95',
    affectedCount: '#f5a97f',
    btnSecondary: '#363a4f',
    btnSecondaryHover: '#464a5f',
  },
  codemirrorTheme,
};

export default catppuccinMacchiato;
