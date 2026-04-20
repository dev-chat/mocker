import { useState } from 'react';
import { Home, Search, Brain, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { HomePage } from '@/pages/HomePage';
import { MessageSearchPage } from '@/pages/MessageSearchPage';
import { PersonalContextPage } from '@/pages/PersonalContextPage';
import type { Page, NavItemProps, AppShellProps } from '@/components/AppShell.model';

function NavItem({ icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`flex items-center justify-center rounded-md p-2 transition-colors ${
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
    </button>
  );
}

export function AppShell({ onLogout }: AppShellProps) {
  const [currentPage, setCurrentPage] = useState<Page>('home');

  return (
    <div className="flex h-screen bg-background">
      {/* Left sidebar */}
      <aside className="flex w-14 shrink-0 flex-col items-center border-r">
        <div className="flex h-14 items-center justify-center border-b w-full">
          <span className="font-bold text-sm tracking-tight">M</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 flex flex-col items-center space-y-1 w-full px-2">
          <NavItem icon={Home} label="Home" active={currentPage === 'home'} onClick={() => setCurrentPage('home')} />
          <NavItem
            icon={Search}
            label="Message Search"
            active={currentPage === 'message-search'}
            onClick={() => setCurrentPage('message-search')}
          />
          <NavItem
            icon={Brain}
            label="Memories + Traits"
            active={currentPage === 'personal-context'}
            onClick={() => setCurrentPage('personal-context')}
          />
        </nav>

        <Separator />
        <div className="py-3 flex justify-center w-full">
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => onLogout()}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {currentPage === 'home' && <HomePage onLogout={onLogout} />}
        {currentPage === 'message-search' && <MessageSearchPage onLogout={onLogout} />}
        {currentPage === 'personal-context' && <PersonalContextPage onLogout={onLogout} />}
      </main>
    </div>
  );
}
