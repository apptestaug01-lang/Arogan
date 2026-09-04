import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload, Eye, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/services/authContext';
import { MetricCard } from '@/components/workspace/MetricCard';
import { listApplications, type ApplicationSummary } from '@/services/applications';
import { listDocuments, type DocumentSummary } from '@/services/documents';

const APP_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function statusLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

function ApplicationStatusTag({ status }: { status: string }) {
  const cls = APP_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

function documentStatusLabel(s: string | undefined): string {
  if (!s) return 'Uploaded';
  if (['Reviewing', 'Draft', 'Verified', 'Uploaded'].includes(s)) return s;
  return s;
}

function metricFromList(apps: ApplicationSummary[]) {
  const submitted = apps.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
  const approved = apps.filter((a) => a.status === 'APPROVED').length;
  const drafts = apps.filter((a) => a.status === 'DRAFT').length;
  return [
    { label: 'Total applications', value: apps.length, hint: 'all time' },
    { label: 'In review', value: submitted, hint: 'submitted or under review' },
    { label: 'Approved', value: approved, hint: 'cleared for disbursement' },
    { label: 'Drafts', value: drafts, hint: 'work in progress' },
  ];
}

export default function DashboardView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [apps, setApps] = React.useState<ApplicationSummary[] | null>(null);
  const [docs, setDocs] = React.useState<DocumentSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ applications }, documents] = await Promise.all([
          listApplications(),
          listDocuments().catch(() => [] as DocumentSummary[]),
        ]);
        if (cancelled) return;
        setApps(applications || []);
        setDocs(documents || []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load applications');
        setApps([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loading = apps === null;
  const activeApp: ApplicationSummary | undefined = apps && apps.length > 0 ? apps[0] : undefined;
  const metrics = React.useMemo(() => metricFromList(apps || []), [apps]);

  const openApp = (app: ApplicationSummary) => {
    // Existing user with a submitted app: opens the wizard in read-only mode
    // (no ?editing=true) so the form pre-fills from the saved data and the
    // user can click "Edit & re-submit" to make changes.
    navigate(`/dashboard/applications/new?applicationId=${app.applicationId}`);
  };

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
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} />
        ))}
      </div>

      {error && (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {activeApp && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground" data-testid="active-app-id">
                  {activeApp.applicationId}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeApp.status === 'SUBMITTED'
                    ? 'Application submitted. Open it to review or make changes.'
                    : activeApp.status === 'DRAFT'
                    ? 'This application is a draft. Continue to fill in the remaining details.'
                    : `Application is ${statusLabel(activeApp.status)}.`}
                  {typeof activeApp.version === 'number' && activeApp.version > 0
                    ? ` · v${activeApp.version}`
                    : ''}
                </p>
              </div>
              <ApplicationStatusTag status={activeApp.status} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={() => openApp(activeApp)} data-testid="active-app-view">
                <Eye className="h-4 w-4" />
                View application
              </Button>
              {activeApp.status === 'DRAFT' && (
                <Button variant="outline" onClick={() => openApp(activeApp)} data-testid="active-app-continue">
                  <Pencil className="h-4 w-4" />
                  Continue editing
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeApp && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-base font-semibold text-foreground">No applications yet</p>
            <p className="text-sm text-muted-foreground">
              Start a new application to upload your documents and apply for a loan.
            </p>
            <Button
              onClick={() => navigate('/dashboard/applications/new')}
              data-testid="dashboard-new-application"
            >
              Start a new application
            </Button>
          </CardContent>
        </Card>
      )}

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
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            ) : (apps?.length || 0) === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No applications yet.</p>
            ) : (
              <ul className="scrollbar-thin mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {apps!.slice(0, 5).map((app) => (
                  <li
                    key={app.applicationId}
                    data-testid={`dashboard-app-row-${app.applicationId}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {app.applicationId}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {app.status === 'SUBMITTED' || app.status === 'UNDER_REVIEW' || app.status === 'APPROVED' || app.status === 'REJECTED'
                          ? `submitted${app.submittedAt ? ' ' + new Date(app.submittedAt).toLocaleDateString() : ''}`
                          : 'draft'}
                        {typeof app.version === 'number' && app.version > 0 ? ` · v${app.version}` : ''}
                      </p>
                    </div>
                    <ApplicationStatusTag status={app.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openApp(app)}
                      data-testid={`dashboard-view-${app.applicationId}`}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
                onClick={() => navigate('/dashboard/documents')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                View all
              </button>
            </div>
            {docs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="scrollbar-thin mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {docs.slice(0, 5).map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.originalName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {documentStatusLabel(doc.status)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/dashboard/documents?applicationId=${doc.applicationId || ''}`)}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
