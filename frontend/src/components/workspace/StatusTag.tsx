import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, Clock, FileEdit, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
  {
    variants: {
      status: {
        Reviewing: 'bg-amber-50 text-amber-700',
        Draft: 'bg-slate-100 text-slate-600',
        Verified: 'bg-emerald-50 text-emerald-700',
        Uploaded: 'bg-blue-50 text-blue-700',
      },
    },
    defaultVariants: { status: 'Draft' },
  },
);

const statusIcons = {
  Reviewing: Clock,
  Draft: FileEdit,
  Verified: CheckCircle2,
  Uploaded: UploadCloud,
} as const;

export interface StatusTagProps extends VariantProps<typeof statusVariants> {
  status: 'Reviewing' | 'Draft' | 'Verified' | 'Uploaded';
  className?: string;
}

export function StatusTag({ status, className }: StatusTagProps) {
  const Icon = statusIcons[status];
  return (
    <span className={cn(statusVariants({ status }), className)}>
      <Icon className="h-3.5 w-3.5" />
      {status}
    </span>
  );
}
