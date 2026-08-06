import type { ElementType } from 'react';

export type Page = 'home' | 'message-search' | 'calendar';

export interface NavItemProps {
  icon: ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}

export interface AppShellProps {
  onLogout: () => void;
}
