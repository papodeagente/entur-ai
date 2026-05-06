import { cn } from '@/lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-bg-elevated via-border-subtle to-bg-elevated',
        'bg-[length:400%_100%] animate-skeleton rounded-md',
        className
      )}
    />
  );
}

export function SidebarSkeleton() {
  return (
    <div className="px-2 space-y-2 animate-fade-in">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-16 w-3/4" />
      </div>
      <div className="space-y-2 ml-auto max-w-[60%]">
        <Skeleton className="h-12 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
