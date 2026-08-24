import * as React from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  onComplete: (code: string) => void;
  length?: number;
  error?: string;
  disabled?: boolean;
}

export const OtpInput = React.forwardRef<(HTMLInputElement | null)[], OtpInputProps>(
  ({ value, onChange, onComplete, length = 6, error, disabled }, ref) => {
    const localRefs = React.useRef<(HTMLInputElement | null)[]>([]);
    const completeCalled = React.useRef(false);

    React.useImperativeHandle(ref, () => localRefs.current);

    const handleComplete = React.useCallback(
      (code: string) => {
        if (completeCalled.current || disabled) return;
        completeCalled.current = true;
        onComplete(code);
      },
      [onComplete, disabled],
    );

    React.useEffect(() => {
      if (!disabled) {
        completeCalled.current = false;
      }
    }, [value, disabled]);

    const handleChange = (index: number, val: string) => {
      if (disabled) return;
      const newValue = [...value];
      newValue[index] = val.slice(-1);
      onChange(newValue);

      if (val && index < length - 1) {
        localRefs.current[index + 1]?.focus();
      }

      if (newValue.every((v) => v !== '') && val) {
        handleComplete(newValue.join(''));
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        localRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      if (disabled) return;
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').slice(0, length);
      const newValue = [...value];
      pasted.split('').forEach((char, i) => {
        newValue[i] = char;
      });
      onChange(newValue);
      if (newValue.every((v) => v !== '')) {
        handleComplete(newValue.join(''));
      }
    };

    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2" onPaste={handlePaste}>
          {Array.from({ length }).map((_, i) => (
            <input
              key={i}
              ref={(el) => {
                localRefs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={value[i] || ''}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                'w-12 h-12 text-center text-2xl font-semibold',
                'border rounded-lg focus:outline-none focus:ring-2',
                'focus:ring-primary-500 transition-all',
                error
                  ? 'border-danger-500 focus:ring-danger-500'
                  : 'border-gray-300',
              )}
            />
          ))}
        </div>
        {error && <span className="text-xs text-danger-500">{error}</span>}
      </div>
    );
  },
);

OtpInput.displayName = 'OtpInput';
