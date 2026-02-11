"use client";

import { motion } from "framer-motion";

const PARTICLES = [
  { left: "8%", top: "12%", size: 2, delay: 0, drift: 20 },
  { left: "20%", top: "22%", size: 3, delay: 0.8, drift: 26 },
  { left: "32%", top: "10%", size: 2, delay: 1.4, drift: 18 },
  { left: "46%", top: "18%", size: 2, delay: 2.1, drift: 24 },
  { left: "61%", top: "8%", size: 3, delay: 1.1, drift: 20 },
  { left: "74%", top: "16%", size: 2, delay: 2.7, drift: 28 },
  { left: "88%", top: "13%", size: 2, delay: 0.5, drift: 21 }
];

function paletteForPark(parkId?: string) {
  if (!parkId) {
    return { stroke: "#88B8FF", glow: "rgba(112, 176, 255, 0.25)" };
  }
  if (parkId.includes("magic-kingdom")) {
    return { stroke: "#9CC9FF", glow: "rgba(121, 184, 255, 0.3)" };
  }
  if (parkId.includes("epcot")) {
    return { stroke: "#7BD7FF", glow: "rgba(79, 202, 255, 0.3)" };
  }
  if (parkId.includes("animal-kingdom")) {
    return { stroke: "#8FF3C8", glow: "rgba(92, 231, 176, 0.26)" };
  }
  if (parkId.includes("hollywood-studios")) {
    return { stroke: "#FFBFA6", glow: "rgba(255, 174, 143, 0.25)" };
  }
  if (parkId.includes("volcano-bay")) {
    return { stroke: "#7CE0FF", glow: "rgba(92, 214, 255, 0.3)" };
  }
  if (parkId.includes("epic-universe")) {
    return { stroke: "#C3A6FF", glow: "rgba(174, 138, 255, 0.3)" };
  }
  return { stroke: "#92B7FF", glow: "rgba(132, 172, 255, 0.28)" };
}

function silhouettePath(parkId?: string) {
  if (!parkId) {
    return "M20 148 L80 110 L120 132 L180 94 L230 121 L290 82 L336 110 L392 89 L460 120 L520 84 L580 120";
  }
  if (parkId.includes("magic-kingdom")) {
    return "M20 150 L90 150 L116 118 L135 148 L160 96 L188 149 L218 78 L244 150 L270 104 L296 148 L330 132 L356 150 L410 150 L410 158 L20 158 Z";
  }
  if (parkId.includes("epcot")) {
    return "M26 154 L166 154 C176 104 216 74 266 74 C316 74 356 104 366 154 L506 154";
  }
  if (parkId.includes("hollywood-studios")) {
    return "M18 154 L108 154 L126 96 L178 96 L194 154 L278 154 L278 112 L316 112 L316 154 L502 154";
  }
  if (parkId.includes("animal-kingdom")) {
    return "M18 154 L88 154 L140 120 L176 154 L230 92 L284 154 L352 114 L390 154 L506 154";
  }
  if (parkId.includes("islands-of-adventure")) {
    return "M18 154 L106 154 C136 126 162 98 194 116 C228 136 252 82 286 106 C318 132 344 92 382 122 C408 142 440 126 502 154";
  }
  if (parkId.includes("epic-universe")) {
    return "M18 154 L126 154 L182 96 L238 154 L292 108 L346 154 L402 88 L456 154 L506 154";
  }
  if (parkId.includes("volcano-bay")) {
    return "M18 154 L152 154 L196 96 L236 154 L274 154 L328 110 L376 154 L506 154";
  }
  return "M20 148 L80 110 L120 132 L180 94 L230 121 L290 82 L336 110 L392 89 L460 120 L520 84 L580 120";
}

export function ParkAtmosphere({ parkId }: { parkId?: string }) {
  const theme = paletteForPark(parkId);
  const path = silhouettePath(parkId);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
      >
        <svg
          viewBox="0 0 540 220"
          className="absolute bottom-6 left-1/2 h-[38%] w-[86%] -translate-x-1/2 opacity-25"
        >
          <path d={path} stroke={theme.stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
        <div
          className="absolute inset-x-0 bottom-0 h-44"
          style={{
            background: `radial-gradient(50% 80% at 50% 100%, ${theme.glow}, transparent 70%)`
          }}
        />
      </motion.div>

      {PARTICLES.map((particle, index) => (
        <motion.span
          key={`${particle.left}-${particle.top}-${index}`}
          className="absolute rounded-full"
          style={{
            left: particle.left,
            top: particle.top,
            width: `${particle.size * 4}px`,
            height: `${particle.size * 4}px`,
            backgroundColor: theme.stroke,
            boxShadow: `0 0 18px ${theme.glow}`
          }}
          animate={{
            y: [0, -particle.drift, 0],
            opacity: [0.15, 0.72, 0.2]
          }}
          transition={{
            duration: 5.6 + particle.size,
            repeat: Infinity,
            ease: "easeInOut",
            delay: particle.delay
          }}
        />
      ))}
    </div>
  );
}
