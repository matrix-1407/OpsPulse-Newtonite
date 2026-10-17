import React, { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring, motion } from 'framer-motion';

interface AnimatedMetricTickerProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedMetricTicker: React.FC<AnimatedMetricTickerProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 32, stiffness: 220, mass: 0.6 });
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      if (ref.current) {
        const formatted =
          decimals > 0
            ? latest.toFixed(decimals)
            : Math.round(latest).toLocaleString('en-US');
        ref.current.textContent = `${prefix}${formatted}${suffix}`;
      }
    });
    return () => unsubscribe();
  }, [springValue, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {decimals > 0 ? value.toFixed(decimals) : value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
};

export const SpringComparisonBar: React.FC<{
  percentage: number;
  colorClass?: string;
}> = ({ percentage, colorClass = 'bg-blue-600' }) => {
  const clamped = Math.max(4, Math.min(100, percentage));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60">
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped / 100 }}
        transition={{ type: 'spring', stiffness: 180, damping: 26 }}
        style={{ transformOrigin: 'left' }}
        className={`h-full w-full rounded-full ${colorClass}`}
      />
    </div>
  );
};
