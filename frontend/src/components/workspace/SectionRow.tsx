import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionRowProps {
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function SectionRow({ title, description, children, className }: SectionRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-border py-4 last:border-0',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}
