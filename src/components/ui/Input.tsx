import { forwardRef } from 'react';

type InputSize = 'sm' | 'md';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
}

const baseClasses = 'w-full border border-subtle bg-surface text-sm text-content rounded-md focus:outline-none focus:ring-1 focus:ring-accent';

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-2.5 py-1.5',
  md: 'px-3 py-2',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', className, ...props }, ref) => {
    const classes = [baseClasses, sizeClasses[size], className].filter(Boolean).join(' ');
    return <input ref={ref} className={classes} {...props} />;
  }
);

Input.displayName = 'Input';

export default Input;
