"use client";

import { motion } from "framer-motion";

const DOTS = Array.from({ length: 8 }, (_, index) => ({
  angle: (index / 8) * Math.PI * 2
}));

export function PixieLoader({
  size = 34,
  color = "#8EEBFF"
}: {
  size?: number;
  color?: string;
}) {
  const radius = size / 2;
  const dotSize = Math.max(3, size * 0.14);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {DOTS.map((dot, index) => {
        const x = radius + Math.cos(dot.angle) * (radius - dotSize);
        const y = radius + Math.sin(dot.angle) * (radius - dotSize);
        return (
          <motion.span
            key={`${index}-${dot.angle}`}
            className="absolute rounded-full"
            style={{
              width: dotSize,
              height: dotSize,
              left: x,
              top: y,
              background: color,
              boxShadow: `0 0 12px ${color}`
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.6, 1.15, 0.6] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 0.08
            }}
          />
        );
      })}
    </div>
  );
}
