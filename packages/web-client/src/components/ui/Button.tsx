import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'icon';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const baseClasses = 'transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-medium text-sm';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-emerald-500 text-white hover:bg-emerald-600 rounded-md border-none',
  accent: 'bg-accent text-white hover:bg-accent/90 rounded-md border-none',
  secondary: 'bg-surface text-content hover:bg-surface-alt border border-subtle rounded-md',
  outline: 'bg-transparent text-content-muted border border-border rounded-md hover:bg-border hover:text-content',
  danger: 'bg-danger text-white hover:bg-danger/80 rounded-md border-none',
  ghost: 'text-content-muted hover:text-content hover:bg-surface rounded border-none',
  icon: 'w-9 h-9 bg-transparent text-content-subtle hover:bg-surface-alt hover:text-content rounded-md flex items-center justify-center border-none',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, ...props }, ref) => {
    const isIcon = variant === 'icon';
    const classes = [
      baseClasses,
      variantClasses[variant],
      !isIcon && sizeClasses[size],
      className,
    ].filter(Boolean).join(' ');

    return <button ref={ref} className={classes} {...props} />;
  }
);

Button.displayName = 'Button';

export default Button;
