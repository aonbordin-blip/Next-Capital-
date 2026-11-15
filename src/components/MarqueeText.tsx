import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface MarqueeTextProps {
  children: React.ReactNode;
  className?: string;
  /** Scrolling speed in pixels per second (default: 34) */
  speedPxPerSec?: number;
  /** Trailing gap between repeated text copies (default: pr-8) */
  gapClassName?: string;
  /** If true, keeps box sized to content when short instead of taking full width */
  fitContent?: boolean;
  /** Optional subtle horizontal edge fade when scrolling (default: true) */
  edgeFade?: boolean;
}

/**
 * Displays single-line text cleanly; when text exceeds its container width
 * (would otherwise wrap or truncate with ...), smoothly scrolls right-to-left
 * in a seamless continuous loop.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({
  children,
  className = '',
  speedPxPerSec = 34,
  gapClassName = 'pr-8',
  fitContent = false,
  edgeFade = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [durationSec, setDurationSec] = useState(10);

  const checkOverflow = () => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const availableWidth = container.clientWidth;
    const contentWidth = measure.scrollWidth;

    if (availableWidth <= 0) return;

    const overflow = contentWidth > availableWidth + 2;
    setIsOverflowing(overflow);

    if (overflow) {
      const nextDuration = Math.max(5.5, Number((contentWidth / speedPxPerSec).toFixed(2)));
      setDurationSec(nextDuration);
    }
  };

  useLayoutEffect(() => {
    checkOverflow();
  }, [children, speedPxPerSec]);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    let rafId = 0;
    const scheduleCheck = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(checkOverflow);
    };

    const observer = new ResizeObserver(scheduleCheck);
    observer.observe(container);
    observer.observe(measure);

    window.addEventListener('resize', scheduleCheck);
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(scheduleCheck).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', scheduleCheck);
    };
  }, [children, speedPxPerSec]);

  return (
    <div
      ref={containerRef}
      className={`marquee-container relative min-w-0 max-w-full overflow-hidden whitespace-nowrap py-[0.5px] ${
        fitContent ? 'inline-block align-bottom' : 'block w-full'
      } ${isOverflowing && edgeFade ? 'marquee-edge-fade' : ''} ${className} ${
        isOverflowing ? '!text-left' : ''
      }`}
    >
      {/* Hidden single-copy measurement element prevents layout feedback loops */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap"
      >
        {children}
      </span>

      {isOverflowing ? (
        <span
          className="animate-marquee-rtl items-center"
          style={{ '--marquee-duration': `${durationSec}s` } as React.CSSProperties}
        >
          <span className={`inline-block shrink-0 whitespace-nowrap ${gapClassName}`}>
            {children}
          </span>
          <span
            className={`inline-block shrink-0 whitespace-nowrap ${gapClassName}`}
            aria-hidden="true"
          >
            {children}
          </span>
        </span>
      ) : (
        <span className="inline-block whitespace-nowrap">{children}</span>
      )}
    </div>
  );
};
