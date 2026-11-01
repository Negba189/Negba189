export function SkeletonLine({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`skeleton ${width} ${height}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3">
      <SkeletonLine width="w-2/3" height="h-5" />
      <SkeletonLine width="w-1/2" height="h-4" />
      <SkeletonLine width="w-3/4" height="h-4" />
    </div>
  );
}

export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonLine key={i} width={i === 0 ? 'w-20' : 'w-32'} />
      ))}
    </div>
  );
}

export function SkeletonTree() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3" style={{ paddingRight: `${i * 24}px` }}>
          <SkeletonLine width="w-6" height="h-6" />
          <SkeletonLine width={i === 0 ? 'w-48' : 'w-36'} height="h-5" />
        </div>
      ))}
    </div>
  );
}
