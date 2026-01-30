import { forwardRef } from 'react';

type TextareaSize = 'sm' | 'md';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  size?: TextareaSize;
}

const baseClasses = 'w-full border border-subtle bg-surface text-sm text-content rounded-md focus:outline-none focus:ring-1 focus:ring-accent resize-none';

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'px-2.5 py-1.5',
  md: 'px-3 py-2',
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ size = 'md', className, ...props }, ref) => {
    const classes = [baseClasses, sizeClasses[size], className].filter(Boolean).join(' ');
    return <textarea ref={ref} className={classes} {...props} />;
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;
