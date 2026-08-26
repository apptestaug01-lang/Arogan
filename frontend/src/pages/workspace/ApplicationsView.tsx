import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionRow } from '@/components/workspace/SectionRow';
import { StatusTag } from '@/components/workspace/StatusTag';
import { applications } from '@/mock/workspace';

export default function ApplicationsView() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Applications</p>
        <h1 className="page-title">Applications</h1>
        <p className="page-sub">Create, continue, and follow each financing request.</p>
      </div>

      <Button onClick={() => navigate('/dashboard/applications/new')}>
        + New application
      </Button>

      <Card>
        <CardContent className="p-0">
          {applications.map((app) => (
            <SectionRow
              key={app.id}
              title={app.id}
              description={`${app.company} · ${app.product} · ${app.amount}`}
            >
              <StatusTag status={app.status} />
            </SectionRow>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
