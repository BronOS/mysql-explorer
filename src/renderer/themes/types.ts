import { Extension } from '@codemirror/state';

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgInput: string;
  bgHover: string;
  textPrimary: string;
  textMuted: string;
  textDisabled: string;
  border: string;
  borderLight: string;
  accent: string;
  accentHover: string;
  accentBg: string;
  danger: string;
  dangerBg: string;
  dangerText: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  scrollbar: string;
  scrollbarHover: string;
  treeActive: string;
  rowEven: string;
  rowHover: string;
  rowSelected: string;
  cellModified: string;
  cellModifiedText: string;
  rowNumBg: string;
  tabActiveBg: string;
  noPkBg: string;
  noPkText: string;
  draftBorder: string;
  affectedCount: string;
  btnSecondary: string;
  btnSecondaryHover: string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  codemirrorTheme: () => Extension;
}
