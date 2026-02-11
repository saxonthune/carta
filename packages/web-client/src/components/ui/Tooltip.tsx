import { useRef, useState, useCallback, useEffect, cloneElement, isValidElement } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Tooltip text content */
  content: string;
  /** Delay in ms before showing (default: 150) */
  delay?: number;
  /** Preferred placement — will flip if clipped by viewport */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** The single child element to wrap */
  children: React.ReactElement;
}

interface Position {
  top: number;
  left: number;
}

// Helper: compute initial position based on trigger rect and placement
function computePosition(triggerRect: DOMRect, placement: 'top' | 'bottom' | 'left' | 'right'): Position {
  const gap = 8;

  switch (placement) {
    case 'top':
      return {
        top: triggerRect.top - gap,
        left: triggerRect.left + triggerRect.width / 2,
      };
    case 'bottom':
      return {
        top: triggerRect.bottom + gap,
        left: triggerRect.left + triggerRect.width / 2,
      };
    case 'left':
      return {
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.left - gap,
      };
    case 'right':
      return {
        top: triggerRect.top + triggerRect.height / 2,
        left: triggerRect.right + gap,
      };
  }
}

// Helper: adjust position for viewport clamping and flipping
function adjustForViewport(
  triggerRect: DOMRect,
  tipRect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right'
): Position {
  const gap = 8;
  const margin = 8;
  let pos: Position;
  let effectivePlacement = placement;

  // Try to flip if the preferred placement would overflow
  if (placement === 'top' && triggerRect.top - tipRect.height - gap < margin) {
    // Try bottom instead
    if (triggerRect.bottom + tipRect.height + gap < window.innerHeight - margin) {
      effectivePlacement = 'bottom';
    }
  } else if (placement === 'bottom' && triggerRect.bottom + tipRect.height + gap > window.innerHeight - margin) {
    // Try top instead
    if (triggerRect.top - tipRect.height - gap > margin) {
      effectivePlacement = 'top';
    }
  } else if (placement === 'left' && triggerRect.left - tipRect.width - gap < margin) {
    // Try right instead
    if (triggerRect.right + tipRect.width + gap < window.innerWidth - margin) {
      effectivePlacement = 'right';
    }
  } else if (placement === 'right' && triggerRect.right + tipRect.width + gap > window.innerWidth - margin) {
    // Try left instead
    if (triggerRect.left - tipRect.width - gap > margin) {
      effectivePlacement = 'left';
    }
  }

  // Compute position based on effective placement
  switch (effectivePlacement) {
    case 'top':
      pos = {
        top: triggerRect.top - tipRect.height - gap,
        left: triggerRect.left + triggerRect.width / 2 - tipRect.width / 2,
      };
      break;
    case 'bottom':
      pos = {
        top: triggerRect.bottom + gap,
        left: triggerRect.left + triggerRect.width / 2 - tipRect.width / 2,
      };
      break;
    case 'left':
      pos = {
        top: triggerRect.top + triggerRect.height / 2 - tipRect.height / 2,
        left: triggerRect.left - tipRect.width - gap,
      };
      break;
    case 'right':
      pos = {
        top: triggerRect.top + triggerRect.height / 2 - tipRect.height / 2,
        left: triggerRect.right + gap,
      };
      break;
  }

  // Clamp to viewport bounds
  pos.top = Math.max(margin, Math.min(pos.top, window.innerHeight - tipRect.height - margin));
  pos.left = Math.max(margin, Math.min(pos.left, window.innerWidth - tipRect.width - margin));

  return pos;
}

// Helper: clone element with ref and event handlers merged
function cloneElementWithRef(
  child: React.ReactElement,
  props: {
    ref: React.MutableRefObject<HTMLElement | null>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  }
): React.ReactElement {
  if (!isValidElement(child)) {
    return child;
  }

  const childProps = child.props as any;

  // Compose refs
  const composedRef = (el: HTMLElement | null) => {
    props.ref.current = el;
    if (typeof childProps.ref === 'function') {
      childProps.ref(el);
    } else if (childProps.ref) {
      (childProps.ref as React.MutableRefObject<HTMLElement | null>).current = el;
    }
  };

  // Merge event handlers
  const mergedProps = {
    ref: composedRef,
    onMouseEnter: (e: React.MouseEvent) => {
      props.onMouseEnter();
      childProps.onMouseEnter?.(e);
    },
    onMouseLeave: (e: React.MouseEvent) => {
      props.onMouseLeave();
      childProps.onMouseLeave?.(e);
    },
    onFocus: (e: React.FocusEvent) => {
      props.onFocus();
      childProps.onFocus?.(e);
    },
    onBlur: (e: React.FocusEvent) => {
      props.onBlur();
      childProps.onBlur?.(e);
    },
  };

  return cloneElement(child, mergedProps);
}

export default function Tooltip({ content, delay = 150, placement = 'top', children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = window.setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      // Initial position based on placement — will be adjusted after render
      setPosition(computePosition(rect, placement));
      setVisible(true);
    }, delay);
  }, [delay, placement]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
    setPosition(null);
  }, []);

  // Adjust position after tooltip renders to handle viewport clamping
  useEffect(() => {
    if (!visible || !tooltipRef.current || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    setPosition(adjustForViewport(triggerRect, tipRect, placement));
  }, [visible, placement]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!content) return children;

  return (
    <>
      {cloneElementWithRef(children, {
        ref: triggerRef,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })}
      {visible && position && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className="fixed z-[999] px-2 py-1 text-2xs rounded bg-surface-elevated text-content border border-subtle shadow-md pointer-events-none whitespace-nowrap"
          style={{ top: position.top, left: position.left }}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}
