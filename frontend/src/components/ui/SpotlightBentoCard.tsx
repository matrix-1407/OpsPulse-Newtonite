import React from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

interface SpotlightBentoCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  spotlightColor?: string;
}

export const SpotlightBentoCard: React.FC<SpotlightBentoCardProps> = ({
  children,
  className = '',
  onClick,
  spotlightColor = 'rgba(37, 99, 235, 0.07)',
}) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent<HTMLDivElement>) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  const background = useMotionTemplate`radial-gradient(420px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 80%)`;

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onClick={onClick}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`group relative overflow-hidden rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_6px_16px_rgba(15,23,42,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.35)] transition-shadow hover:shadow-[0_8px_28px_rgba(15,23,42,0.06)] dark:hover:shadow-[0_8px_28px_rgba(0,0,0,0.6)] hover:border-slate-300/90 dark:hover:border-slate-700 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
};
