import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionRow } from '@/components/workspace/SectionRow';
import { FileDropzone } from '@/components/workspace/FileDropzone';
import { requiredDocs } from '@/mock/workspace';

export default function DocumentUploadView() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="page-eyebrow">Loan workspace / Document upload</p>
        <h1 className="page-title">Document upload</h1>
        <p className="page-sub">
          Add files securely to LAP-2026-0184.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader>
            <CardTitle>Upload to LAP-2026-0184</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileDropzone />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Required documents</h3>
              <div className="divide-y divide-border">
                {requiredDocs.map((d) => (
                  <SectionRow key={d.id} title={d.name}>
                    <span
                      className={
                        d.status === 'Complete'
                          ? 'text-xs font-medium text-emerald-600'
                          : 'text-xs font-medium text-muted-foreground'
                      }
                    >
                      {d.status}
                    </span>
                  </SectionRow>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <aside className="h-fit rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <b className="text-foreground">☁ Storage safeguards</b>
          <br />
          <br />
          Use short-lived pre-signed upload URLs. Show upload, malware scan, and document
          verification as separate states. Keep version, uploader, time, and application ID
          in the audit trail.
        </aside>
      </div>
    </div>
  );
}
