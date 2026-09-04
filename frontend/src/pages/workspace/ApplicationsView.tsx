import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionRow } from '@/components/workspace/SectionRow';
import { listApplications, type ApplicationSummary } from '@/services/applications';

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

const APP_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function ApplicationStatusTag({ status }: { status: string }) {
  const cls = APP_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function ApplicationsView() {
  const navigate = useNavigate();
  const [apps, setApps] = React.useState<ApplicationSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listApplications()
      .then(({ applications }) => {
        if (!cancelled) setApps(applications);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load applications');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasSubmitted = !!apps?.some((a) => a.status === 'SUBMITTED');
  const isEditable = (s: string) => s === 'DRAFT' || s === 'SUBMITTED';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Applications</p>
        <h1 className="page-title">Applications</h1>
        <p className="page-sub">Create, continue, and follow each financing request.</p>
      </div>

      {hasSubmitted ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You already have a submitted application. Edit it from the list below to make changes.
          Starting a new application is disabled until your submitted one is closed.
        </div>
      ) : (
        <Button onClick={() => navigate('/dashboard/applications/new')}>
          + New application
        </Button>
      )}

      {apps === null && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading applications…
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-danger-500">{error}</CardContent>
        </Card>
      )}

      {apps !== null && apps.length === 0 && !error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">No applications yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start your first loan application to track every financing request here.
              </p>
            </div>
            <Button onClick={() => navigate('/dashboard/applications/new')}>
              + New application
            </Button>
          </CardContent>
        </Card>
      )}

      {apps !== null && apps.length > 0 && (
        <Card>
          <CardContent className="p-0">
            {apps.map((app) => (
              <SectionRow
                key={app.applicationId}
                title={app.applicationId}
                description={
                  <>
                    <span className="capitalize">{statusLabel(app.status)}</span>
                    {typeof app.version === 'number' && app.version > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · v{app.version}
                      </span>
                    )}
                    {app.submittedAt && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · submitted {new Date(app.submittedAt).toLocaleString()}
                      </span>
                    )}
                  </>
                }
              >
                <div className="flex items-center gap-2">
                  <ApplicationStatusTag status={app.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/dashboard/applications/new?applicationId=${app.applicationId}`)}
                    data-testid={`view-${app.applicationId}`}
                  >
                    View application
                  </Button>
                  {isEditable(app.status) && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() =>
                        navigate(
                          `/dashboard/applications/new?applicationId=${app.applicationId}&editing=true`,
                        )
                      }
                      data-testid={`edit-${app.applicationId}`}
                    >
                      {app.status === 'SUBMITTED' ? 'Edit & re-submit' : 'Edit'}
                    </Button>
                  )}
                </div>
              </SectionRow>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
