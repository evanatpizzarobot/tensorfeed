'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type ViewMode = 'human' | 'agent';

const ViewModeContext = createContext<{
  viewMode: ViewMode;
  toggleViewMode: () => void;
  mounted: boolean;
}>({ viewMode: 'human', toggleViewMode: () => {}, mounted: false });

export function useViewMode() {
  return useContext(ViewModeContext);
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export default function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('human');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getCookie('view-mode');
    const resolved: ViewMode = stored === 'agent' ? 'agent' : 'human';
    setViewMode(resolved);
    document.documentElement.setAttribute('data-view-mode', resolved);
    setMounted(true);
  }, []);

  const toggleViewMode = () => {
    const next: ViewMode = viewMode === 'agent' ? 'human' : 'agent';
    setViewMode(next);
    setCookie('view-mode', next);
    document.documentElement.setAttribute('data-view-mode', next);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, toggleViewMode, mounted }}>
      {children}
    </ViewModeContext.Provider>
  );
}
