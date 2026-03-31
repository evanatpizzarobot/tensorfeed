/**
 * Ad placeholder for Google AdSense.
 * Replace the inner content with actual ad units once approved.
 * Publisher ID: pub-7224757913262984
 */
export default function AdPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-lg border border-dashed border-border bg-bg-secondary/50 px-5 py-4 flex items-center justify-center ${className}`}
      data-ad-slot="tensorfeed-placeholder"
    >
      <span className="text-xs text-text-muted font-mono">Ad Space Reserved for Google AdSense</span>
    </div>
  );
}
