import * as React from 'react';
import { DocumentExplorer } from '@/components/workspace/DocumentExplorer';

export default function DocumentVaultView() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / S3 document vault</p>
        <h1 className="page-title">S3 document vault</h1>
        <p className="page-sub">
          Browse every document stored for your applications, organized by application.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <DocumentExplorer />

        <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
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
