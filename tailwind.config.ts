import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body:    ["var(--font-dm-sans)", "sans-serif"],
        mono:    ["var(--font-dm-mono)", "monospace"],
      },
      colors: {
        celo: {
          green: "#05d86b",
          gold: "#ffbb1b",
          dark: "#0c0011",
        },
      },
      backgroundImage: {
        "mesh-gradient":
          "radial-gradient(at 40% 20%, #e6f3ec22 0px, transparent 50%), radial-gradient(at 80% 0%, #FBCC5C18 0px, transparent 50%), radial-gradient(at 0% 50%, #35D07F11 0px, transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;