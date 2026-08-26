import * as React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/workspace/Sidebar';
import { ToastProvider } from '@/components/workspace/ToastProvider';
import { Button } from '@/components/ui/button';

export default function Workspace() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <aside className="hidden w-64 shrink-0 lg:flex">
          <Sidebar />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 animate-fade-in"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-64 animate-fade-in">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between border-b border-border bg-white px-4 sm:px-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="text-sm font-semibold text-muted-foreground">Borrower workspace</span>
            </div>
            <Button onClick={() => navigate('/dashboard/applications/new')}>
              + New application
            </Button>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1120px] animate-fade-in p-4 sm:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
