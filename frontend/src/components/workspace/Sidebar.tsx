import * as React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, UploadCloud, FolderOpen, LogOut } from 'lucide-react';
import { useAuth } from '@/services/authContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/applications', label: 'Applications', icon: FileText },
  { to: '/dashboard/documents', label: 'Document upload', icon: UploadCloud },
  { to: '/dashboard/vault', label: 'S3 document vault', icon: FolderOpen },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
      <div className="border-b border-border px-6 py-6 text-xl font-extrabold text-primary-700">
        LoanFlow
        <span className="mt-1 block text-[11px] font-medium text-muted-foreground">
          Corporate lending
        </span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        {navItems.map(({ to, label, icon: Icon }) => {
          const active =
            location.pathname === to ||
            (to !== '/dashboard' && location.pathname.startsWith(to));
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="m-4 rounded-xl bg-primary-800 p-4 text-xs leading-relaxed text-primary-100">
        <b>Need help?</b>
        <br />
        Your relationship manager can help with document requirements.
      </div>

      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{user?.email}</p>
          <p className="text-xs text-muted-foreground">Borrower workspace</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => { logout(); onNavigate?.(); }} aria-label="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
