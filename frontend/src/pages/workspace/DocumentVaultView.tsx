import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SectionRow } from '@/components/workspace/SectionRow';
import { StatusTag } from '@/components/workspace/StatusTag';
import { documents } from '@/mock/workspace';

export default function DocumentVaultView() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / S3 document vault</p>
        <h1 className="page-title">S3 document vault</h1>
        <p className="page-sub">
          Track every document stored for this application.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>LAP-2026-0184 documents</CardTitle>
            <CardDescription>Last synced Aug 24, 2026 at 14:32 IST</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {documents.map((d) => (
              <SectionRow key={d.id} title={d.name} description={d.meta}>
                <StatusTag status={d.status} />
              </SectionRow>
            ))}
          </CardContent>
        </Card>

        <aside className="h-fit rounded-xl border border-border bg-white p-5 text-sm text-muted-foreground">
          <b className="text-foreground">🛡 Protected storage</b>
          <br />
          <br />
          Only display files after the backend confirms the S3 upload. Do not expose bucket
          names, object keys, or AWS credentials to users.
        </aside>
      </div>
    </div>
  );
}
