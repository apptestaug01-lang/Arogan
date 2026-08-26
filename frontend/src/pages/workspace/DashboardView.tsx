import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/services/authContext';
import { MetricCard } from '@/components/workspace/MetricCard';
import { SectionRow } from '@/components/workspace/SectionRow';
import { StatusTag } from '@/components/workspace/StatusTag';
import { applications, dashboardMetrics } from '@/mock/workspace';

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
          <SectionRow
            title={`${activeApp.id} · ${activeApp.company}`}
            description="Upload the remaining tax return to send this application for review."
          >
            <StatusTag status="Reviewing" />
          </SectionRow>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
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
    </div>
  );
}
