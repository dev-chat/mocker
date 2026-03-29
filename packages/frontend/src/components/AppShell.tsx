import { useState } from 'react';
import { Home, Search, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { HomePage } from '@/pages/HomePage';
import { MessageSearchPage } from '@/pages/MessageSearchPage';
import type { Page, NavItemProps, AppShellProps } from '@/components/AppShell.model';

function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}

export function AppShell({ onLogout }: AppShellProps) {
  const [currentPage, setCurrentPage] = useState<Page>('message-search');

  return (
    <div className="flex h-screen bg-background">
      {/* Left sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex h-14 items-center px-4 border-b">
          <span className="font-bold text-base tracking-tight">muzzle.lol</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavItem icon={Home} label="Home" active={currentPage === 'home'} onClick={() => setCurrentPage('home')} />
          <NavItem
            icon={Search}
            label="Message Search"
            active={currentPage === 'message-search'}
            onClick={() => setCurrentPage('message-search')}
          />
        </nav>

        <Separator />
        <div className="p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => onLogout()}>
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'home' ? <HomePage /> : <MessageSearchPage onLogout={onLogout} />}
      </main>
    </div>
  );
}
