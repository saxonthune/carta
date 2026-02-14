/**
 * Shared icon components for consistent use across the app
 */

import {
  PushPin,
  CornersOut as CornersOutIcon,
  X,
  CaretDown,
  CaretUp,
  Eye,
  EyeSlash,
} from '@phosphor-icons/react';

interface IconProps {
  className?: string;
  size?: number;
  filled?: boolean;
}

export function PinIcon({ className = '', size = 20, filled = false }: IconProps) {
  return <PushPin weight={filled ? 'fill' : 'regular'} size={size} className={className} />;
}

export function WindowIcon({ className = '', size = 20 }: IconProps) {
  return <CornersOutIcon weight="regular" size={size} className={className} />;
}

export function CloseIcon({ className = '', size = 20 }: IconProps) {
  return <X weight="regular" size={size} className={className} />;
}

export function ExpandIcon({ className = '', size = 20 }: IconProps) {
  return <CaretDown weight="bold" size={size} className={className} />;
}

export function CollapseIcon({ className = '', size = 20 }: IconProps) {
  return <CaretUp weight="bold" size={size} className={className} />;
}

export function EyeIcon({ className = '', size = 20 }: IconProps) {
  return <Eye weight="regular" size={size} className={className} />;
}

export function EyeOffIcon({ className = '', size = 20 }: IconProps) {
  return <EyeSlash weight="regular" size={size} className={className} />;
}
