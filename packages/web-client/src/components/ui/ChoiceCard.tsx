import { forwardRef, type ReactNode } from 'react';

interface ChoiceCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}

const ChoiceCard = forwardRef<HTMLButtonElement, ChoiceCardProps>(
  ({ icon, title, description, recommended, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={[
          'p-6 rounded-xl border bg-surface-depth-2 flex items-start gap-4 text-left w-full',
          'transition-all duration-150',
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:bg-surface-depth-3 hover:border-border-strong cursor-pointer',
          recommended && !disabled ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border',
          className,
        ].filter(Boolean).join(' ')}
        {...props}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-surface-depth-1 flex items-center justify-center text-content-muted">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-medium text-content">{title}</h3>
            {recommended && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-content-muted mt-1">{description}</p>
        </div>
      </button>
    );
  }
);

ChoiceCard.displayName = 'ChoiceCard';

export default ChoiceCard;
