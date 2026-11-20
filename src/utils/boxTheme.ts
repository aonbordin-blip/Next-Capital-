import { useEffect, useState } from 'react';

export type BoxThemeMode = 'light' | 'dimensional' | 'dark';

export const BOX_THEME_STORAGE_KEY = 'ncap_box_theme';
const BOX_THEME_EVENT = 'ncap-box-theme-change';

export const BOX_THEME_OPTIONS: Array<{
  id: BoxThemeMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: 'light',
    label: 'สว่าง',
    shortLabel: 'สว่าง',
    description: 'โทนสว่างใส สบายตา',
  },
  {
    id: 'dimensional',
    label: 'มีมิติ',
    shortLabel: 'มีมิติ',
    description: 'เฉดสีลึกขึ้น มีแสงเงา 3 มิติ',
  },
  {
    id: 'dark',
    label: 'โหมดมืด',
    shortLabel: 'มืด',
    description: 'กล่องสีเข้มคมชัด ตัดขอบเรืองแสง',
  },
];

export function isValidBoxTheme(val: unknown): val is BoxThemeMode {
  return val === 'light' || val === 'dimensional' || val === 'dark';
}

export function getStoredBoxTheme(): BoxThemeMode {
  if (typeof window === 'undefined') return 'dimensional';
  try {
    const saved = window.localStorage.getItem(BOX_THEME_STORAGE_KEY);
    if (isValidBoxTheme(saved)) return saved;
  } catch {
    // ignore storage access issues
  }
  return 'dimensional';
}

export function applyBoxThemeToDocument(mode: BoxThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-box-theme', mode);
  root.classList.toggle('dark', mode === 'dark');

  const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', mode === 'dark' ? '#0b1324' : '#0284c7');
  }
}

export function setBoxTheme(mode: BoxThemeMode): void {
  try {
    window.localStorage.setItem(BOX_THEME_STORAGE_KEY, mode);
  } catch {
    // ignore storage access issues
  }
  applyBoxThemeToDocument(mode);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<BoxThemeMode>(BOX_THEME_EVENT, { detail: mode }));
  }
}

export function useBoxTheme(): [BoxThemeMode, (mode: BoxThemeMode) => void] {
  const [theme, setThemeState] = useState<BoxThemeMode>(() => getStoredBoxTheme());

  useEffect(() => {
    applyBoxThemeToDocument(theme);
  }, [theme]);

  useEffect(() => {
    const onThemeEvent = (e: Event) => {
      const next = (e as CustomEvent<BoxThemeMode>).detail;
      if (isValidBoxTheme(next)) {
        setThemeState(next);
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === BOX_THEME_STORAGE_KEY && isValidBoxTheme(e.newValue)) {
        setThemeState(e.newValue);
        applyBoxThemeToDocument(e.newValue);
      }
    };

    window.addEventListener(BOX_THEME_EVENT, onThemeEvent);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BOX_THEME_EVENT, onThemeEvent);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const updateTheme = (mode: BoxThemeMode) => {
    setThemeState(mode);
    setBoxTheme(mode);
  };

  return [theme, updateTheme];
}
