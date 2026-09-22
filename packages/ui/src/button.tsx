import * as React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-yellow-400 text-black hover:bg-yellow-300',
  secondary: 'bg-neutral-800 text-white hover:bg-neutral-700',
  ghost: 'bg-transparent text-current hover:bg-neutral-100',
};

/** Базова кнопка дизайн-системи VOLTSTAR. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
