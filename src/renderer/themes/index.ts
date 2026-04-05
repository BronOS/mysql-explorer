import { ThemeDefinition, ThemeColors } from './types';
import dark from './dark';
import light from './light';
import monokai from './monokai';
import solarizedDark from './solarized-dark';
import solarizedLight from './solarized-light';
import dracula from './dracula';
import catppuccinLatte from './catppuccin-latte';
import catppuccinFrappe from './catppuccin-frappe';
import catppuccinMacchiato from './catppuccin-macchiato';
import catppuccinMocha from './catppuccin-mocha';

const themes: ThemeDefinition[] = [
  dark,
  light,
  monokai,
  solarizedDark,
  solarizedLight,
  dracula,
  catppuccinLatte,
  catppuccinFrappe,
  catppuccinMacchiato,
  catppuccinMocha,
];

export function getTheme(id: string): ThemeDefinition {
  return themes.find(t => t.id === id) || dark;
}

export function getAllThemes(): ThemeDefinition[] {
  return themes;
}

export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement.style;
  root.setProperty('--bg-primary', colors.bgPrimary);
  root.setProperty('--bg-secondary', colors.bgSecondary);
  root.setProperty('--bg-input', colors.bgInput);
  root.setProperty('--bg-hover', colors.bgHover);
  root.setProperty('--text-primary', colors.textPrimary);
  root.setProperty('--text-muted', colors.textMuted);
  root.setProperty('--text-disabled', colors.textDisabled);
  root.setProperty('--border', colors.border);
  root.setProperty('--border-light', colors.borderLight);
  root.setProperty('--accent', colors.accent);
  root.setProperty('--accent-hover', colors.accentHover);
  root.setProperty('--accent-bg', colors.accentBg);
  root.setProperty('--danger', colors.danger);
  root.setProperty('--danger-bg', colors.dangerBg);
  root.setProperty('--danger-text', colors.dangerText);
  root.setProperty('--success', colors.success);
  root.setProperty('--success-bg', colors.successBg);
  root.setProperty('--warning', colors.warning);
  root.setProperty('--warning-bg', colors.warningBg);
  root.setProperty('--scrollbar', colors.scrollbar);
  root.setProperty('--scrollbar-hover', colors.scrollbarHover);
  root.setProperty('--tree-active', colors.treeActive);
  root.setProperty('--row-even', colors.rowEven);
  root.setProperty('--row-hover', colors.rowHover);
  root.setProperty('--row-selected', colors.rowSelected);
  root.setProperty('--cell-modified', colors.cellModified);
  root.setProperty('--cell-modified-text', colors.cellModifiedText);
  root.setProperty('--row-num-bg', colors.rowNumBg);
  root.setProperty('--tab-active-bg', colors.tabActiveBg);
  root.setProperty('--no-pk-bg', colors.noPkBg);
  root.setProperty('--no-pk-text', colors.noPkText);
  root.setProperty('--draft-border', colors.draftBorder);
  root.setProperty('--affected-count', colors.affectedCount);
  root.setProperty('--btn-secondary', colors.btnSecondary);
  root.setProperty('--btn-secondary-hover', colors.btnSecondaryHover);
}

export { type ThemeDefinition, type ThemeColors } from './types';
