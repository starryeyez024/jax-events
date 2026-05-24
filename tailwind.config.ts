import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          900: "#0c4a6e",
        },
        sand: {
          50: "#fdf8f1",
          100: "#f9ecd6",
          200: "#f0d7a6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
