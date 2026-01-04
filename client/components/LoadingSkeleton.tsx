'use client';

import React from 'react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 rounded';

  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: 'rounded',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'loading-shimmer',
    shimmer: 'loading-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        'animate-fade-in-blur',
        className
      )}
      style={style}
    />
  );
}

interface SkeletonGroupProps {
  count?: number;
  className?: string;
  children?: React.ReactNode;
}

export function SkeletonGroup({ count = 3, className, children }: SkeletonGroupProps) {
  if (children) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={60} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card-modern p-6 space-y-4 animate-fade-in-blur">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="40%" height={20} />
          <Skeleton variant="text" width="30%" height={16} />
        </div>
      </div>
      <Skeleton variant="text" width="100%" height={16} />
      <Skeleton variant="text" width="90%" height={16} />
      <Skeleton variant="rectangular" height={120} className="rounded-lg" />
      <div className="flex justify-between items-center pt-4">
        <Skeleton variant="text" width="25%" height={14} />
        <Skeleton variant="text" width="20%" height={14} />
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="card-elevated p-8 text-center animate-fade-in-blur">
      <Skeleton variant="circular" width={48} height={48} className="mx-auto mb-4" />
      <Skeleton variant="text" width="60%" height={32} className="mx-auto mb-3" />
      <Skeleton variant="text" width="40%" height={18} className="mx-auto" />
    </div>
  );
}

export function ListItemSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-4 animate-fade-in-blur">
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" width="70%" height={16} />
        <Skeleton variant="text" width="50%" height={14} />
      </div>
      <Skeleton variant="rectangular" width={80} height={24} className="rounded-full" />
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in-blur">
      <div className="text-center space-y-4">
        <Skeleton variant="text" width="50%" height={36} className="mx-auto" />
        <Skeleton variant="text" width="70%" height={20} className="mx-auto" />
      </div>

      <div className="grid-readable">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      <CardSkeleton />

      <div className="space-y-3">
        <Skeleton variant="text" width="30%" height={24} />
        {Array.from({ length: 3 }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton variant="rectangular" height={40} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={50} />
      ))}
    </div>
  );
}

// Default export for backward compatibility
function LoadingSkeleton({ type = 'card', count = 3 }: { type?: 'card' | 'table' | 'text'; count?: number }) {
  if (type === 'table') {
    return <TableSkeleton rows={count} />;
  }
  if (type === 'text') {
    return <SkeletonGroup count={count} />;
  }
  return <CardSkeleton />;
}

export default LoadingSkeleton;
