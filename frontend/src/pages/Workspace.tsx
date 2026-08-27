import * as React from 'react';
import { Outlet, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { Menu, X, Search, ChevronRight } from 'lucide-react';
import { Sidebar, NAV_ITEMS } from '@/components/workspace/Sidebar';
import { ToastProvider } from '@/components/workspace/ToastProvider';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function Workspace() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const crumbs = React.useMemo(() => {
    const items = [{ label: 'LoanFlow', to: '/dashboard' as string }];
    if (pathname === '/dashboard') {
      items.push({ label: 'Overview', to: '/dashboard' });
    } else if (pathname.startsWith('/dashboard/overview')) {
      items.push({ label: 'Dashboard', to: '/dashboard/overview' });
    } else if (pathname.startsWith('/dashboard/applications/new')) {
      items.push({ label: 'Applications', to: '/dashboard/applications' });
      items.push({ label: 'New application', to: '' });
    } else if (pathname.startsWith('/dashboard/applications')) {
      items.push({ label: 'Applications', to: '/dashboard/applications' });
    } else if (pathname.startsWith('/dashboard/documents')) {
      items.push({ label: 'Document upload', to: '/dashboard/documents' });
    } else if (pathname.startsWith('/dashboard/vault')) {
      items.push({ label: 'S3 document vault', to: '/dashboard/vault' });
    }
    return items;
  }, [pathname]);

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
          <header className="sticky top-0 z-30 flex h-[70px] items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
                {crumbs.map((c, i) => (
                  <React.Fragment key={`${c.label}-${i}`}>
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    {c.to ? (
                      <NavLink
                        to={c.to}
                        className={cn(
                          'truncate hover:text-foreground',
                          i === crumbs.length - 1
                            ? 'font-semibold text-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {c.label}
                      </NavLink>
                    ) : (
                      <span className="truncate font-semibold text-foreground">{c.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted sm:flex"
              >
                <Search className="h-4 w-4" />
                <span>Search or jump to…</span>
                <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
                  ⌘K
                </kbd>
              </button>
              <Button onClick={() => navigate('/dashboard/applications/new')}>
                + New application
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1120px] animate-fade-in p-4 pb-24 sm:p-8 lg:pb-8">
              <Outlet />
            </div>
          </main>
        </div>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card lg:hidden"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium',
                  isActive ? 'text-primary-600' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span className="truncate px-1">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </ToastProvider>
  );
}
