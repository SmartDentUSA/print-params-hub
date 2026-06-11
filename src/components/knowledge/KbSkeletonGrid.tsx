export default function KbSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kb-skel-card">
          <div className="kb-skel-thumb kb-shimmer" />
          <div className="kb-skel-body">
            <div className="kb-shimmer kb-skel-line" style={{ width: '40%', height: 10 }} />
            <div className="kb-shimmer kb-skel-line" style={{ width: '90%', height: 12 }} />
            <div className="kb-shimmer kb-skel-line" style={{ width: '70%', height: 12 }} />
          </div>
        </div>
      ))}
    </>
  );
}