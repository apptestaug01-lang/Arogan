import * as React from 'react';
import { cn } from '@/lib/utils';

type ToggleVariant = 'default' | 'outline' | 'ghost' | 'ghost-active' | 'plain';
type ToggleSize = 'sm' | 'default' | 'lg';

interface ToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

const toggleVariants = {
  base: 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  variant: {
    default: 'bg-primary-600 text-white hover:bg-primary-700',
    outline: 'border border-input bg-background hover:bg-accent',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    'ghost-active': 'hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
    plain: 'text-primary-600 underline-offset-4 hover:underline',
  },
  size: {
    sm: 'h-9 px-3',
    default: 'h-10 px-4 py-2',
    lg: 'h-11 px-8',
  },
};

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, variant = 'default', size = 'default', pressed, ...props }, ref) => (
    <button
      type="button"
      ref={ref}
      data-state={pressed !== undefined ? (pressed ? 'on' : 'off') : undefined}
      className={cn(
        toggleVariants.base,
        toggleVariants.variant[variant],
        toggleVariants.size[size],
        pressed && 'bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Toggle.displayName = 'Toggle';

export { Toggle };
