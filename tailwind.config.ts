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
          green: "#35D07F",
          gold: "#FBCC5C",
          dark: "#1E002B",
        },
      },
      backgroundImage: {
        "mesh-gradient":
          "radial-gradient(at 40% 20%, #35D07F22 0px, transparent 50%), radial-gradient(at 80% 0%, #FBCC5C18 0px, transparent 50%), radial-gradient(at 0% 50%, #35D07F11 0px, transparent 50%)",
      },
    },
  },
  plugins: [],
};

export default config;