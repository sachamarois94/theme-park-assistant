import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        "ink-0": "var(--bg-0)",
        "ink-1": "var(--bg-1)",
        "text-0": "var(--text-0)",
        "text-1": "var(--text-1)",
        "accent-0": "var(--accent-0)",
        "accent-1": "var(--accent-1)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(101, 245, 255, 0.18), 0 8px 40px rgba(41, 156, 255, 0.2)",
        card: "0 10px 45px rgba(1, 8, 24, 0.38)"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
