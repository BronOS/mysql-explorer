import { useState, useEffect, useMemo } from 'react';
import { Extension } from '@codemirror/state';
import { getTheme, applyThemeColors, getAllThemes, ThemeDefinition } from '../themes';
import { loadUiStateAsync, setUiState } from './use-ui-state';

let currentThemeId = 'dark';

export function useTheme() {
  const [themeId, setThemeId] = useState(currentThemeId);

  useEffect(() => {
    loadUiStateAsync().then(s => {
      if (s.theme) {
        setThemeId(s.theme);
        currentThemeId = s.theme;
        applyThemeColors(getTheme(s.theme).colors);
      }
    });
  }, []);

  const theme = useMemo(() => getTheme(themeId), [themeId]);
  const cmExtension: Extension = useMemo(() => theme.codemirrorTheme(), [theme]);

  const setTheme = (id: string) => {
    const t = getTheme(id);
    applyThemeColors(t.colors);
    setThemeId(id);
    currentThemeId = id;
    setUiState('theme', id);
  };

  return {
    theme,
    themeId,
    setTheme,
    cmExtension,
    allThemes: getAllThemes(),
  };
}
