import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'ml_manager_theme';

/** 'light' | 'dark' | 'system' */
const ThemeContext = createContext({
  mode: 'system',
  isDark: false,
  isSystem: true,
  setMode: () => {},
  toggleTheme: () => {},
  setLightMode: () => {},
  setDarkMode: () => {},
  cycleTheme: () => {},
});

function readStoredMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    // Legacy values written by earlier versions.
    if (saved === 'true') return 'dark';
    if (saved === 'false') return 'light';
  } catch (e) {
    /* storage unavailable (private mode) — fall through */
  }
  return 'system';
}

function systemPrefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow the operating system while the user keeps the "system" preference.
  useEffect(() => {
    let media;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch (e) {
      return undefined;
    }
    const onChange = (event) => setSystemDark(event.matches);
    if (media.addEventListener) media.addEventListener('change', onChange);
    else media.addListener(onChange);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) {
      /* ignore */
    }
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
    document.body?.classList.toggle('dark', isDark);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#080c16' : '#f2f5fb');
  }, [isDark]);

  const setMode = useCallback((next) => setModeState(next), []);
  const setLightMode = useCallback(() => setModeState('light'), []);
  const setDarkMode = useCallback(() => setModeState('dark'), []);
  const toggleTheme = useCallback(() => setModeState(isDark ? 'light' : 'dark'), [isDark]);
  const cycleTheme = useCallback(
    () => setModeState((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light')),
    [],
  );

  const value = useMemo(
    () => ({
      mode,
      isDark,
      isSystem: mode === 'system',
      setMode,
      setLightMode,
      setDarkMode,
      toggleTheme,
      cycleTheme,
    }),
    [mode, isDark, setMode, setLightMode, setDarkMode, toggleTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
