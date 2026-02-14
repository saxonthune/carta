import { forwardRef } from 'react';

type SelectSize = 'sm' | 'md';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize;
}

const baseClasses = 'w-full border border-subtle bg-surface text-sm text-content rounded-md focus:outline-none focus:ring-1 focus:ring-accent';

const sizeClasses: Record<SelectSize, string> = {
  sm: 'px-2.5 py-1.5',
  md: 'px-3 py-2',
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ size = 'md', className, children, ...props }, ref) => {
    const classes = [baseClasses, sizeClasses[size], className].filter(Boolean).join(' ');
    return <select ref={ref} className={classes} {...props}>{children}</select>;
  }
);

Select.displayName = 'Select';

export default Select;
