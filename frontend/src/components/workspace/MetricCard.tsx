import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string | number;
  hint: string;
  className?: string;
}

export function MetricCard({ label, value, hint, className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <CardContent className="p-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="metric-value mt-2">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
