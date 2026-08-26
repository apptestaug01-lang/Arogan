import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/services/authContext';
import { MetricCard } from '@/components/workspace/MetricCard';
import { StatusTag } from '@/components/workspace/StatusTag';
import { applications, documents, dashboardMetrics } from '@/mock/workspace';

export default function DashboardView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const activeApp = applications[0];
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const t = window.setTimeout(() => setProgress(72), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace</p>
        <h1 className="page-title">
          Good morning{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="page-sub">
          Here is a clear view of your loan application activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} />
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {activeApp.id} · {activeApp.company}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the remaining tax return to send this application for review.
              </p>
            </div>
            <StatusTag status="Reviewing" />
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Application completion</span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary-600 transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <Button className="mt-4" onClick={() => navigate('/dashboard/documents')}>
            Upload documents
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent applications
              </h2>
              <button
                type="button"
                onClick={() => navigate('/dashboard/applications')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                View all
              </button>
            </div>
            <ul className="scrollbar-thin mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {applications.map((app) => (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{app.company}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.id} · {app.product} · {app.amount}
                    </p>
                  </div>
                  <StatusTag status={app.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Recent documents
              </h2>
              <button
                type="button"
                onClick={() => navigate('/dashboard/vault')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                View all
              </button>
            </div>
            <ul className="scrollbar-thin mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{doc.meta}</p>
                    </div>
                  </div>
                  <StatusTag status={doc.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
