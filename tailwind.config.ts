import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Loaded via next/font in layout.tsx and exposed as CSS variables.
        //   sans    → Noto Sans (humanist body face)
        //   display → Montserrat (section headings, event titles)
        //   title   → Sigmar (only the "Jax Beach Fun Times" h1 — chunky,
        //             playful, reserved for the brand wordmark)
        // System fallbacks keep the app usable if Google Fonts fails.
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        title: ["var(--font-title)", "Georgia", "serif"],
      },
      colors: {
        // Soft pastel accent palette — inspired by playful editorial sites
        // (think NUA Creativos style). Each chip is a watercolor wash rather
        // than a primary-color block, giving the UI a friendly, hand-made
        // feel instead of the previous web-2.0 saturated look.
        pastel: {
          lavender: "#E5DCF7",
          mint: "#D4EDDD",
          sky: "#CFE5F4",
          butter: "#FBEDB5",
          blush: "#F8D6E0",
          sage: "#D6DEC9",
          peach: "#FBD8C5",
          lilac: "#EFD7E8",
        },
        // Slightly stronger pastel variants used for borders / active-state
        // outlines on the chips above. One step deeper, still soft.
        "pastel-ink": {
          lavender: "#7A5FCF",
          mint: "#5BA876",
          sky: "#5AA0CE",
          butter: "#C7A436",
          blush: "#CB6E89",
          sage: "#7A8A65",
          peach: "#D38962",
          lilac: "#B07AA8",
        },
        // Brand accent — kept as a muted teal so we have a single "primary
        // action" color that still feels coastal but doesn't shout. Used
        // for buttons, active toggles, focus rings.
        ocean: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          500: "#0d9488",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#042f2e",
        },
        // Near-white background tones. Pure white feels sterile next to the
        // pastel chips; this is a barely-warm off-white.
        sand: {
          50: "#FEFCF7",
          100: "#FAF6EC",
          200: "#F1EAD8",
        },
      },
      boxShadow: {
        // Modern "no shadow" cards use ring-style inset borders for floating
        // surfaces (toasts, popovers) — crisper than blurred drop shadows.
        ring: "0 0 0 1px rgba(15, 23, 42, 0.08)",
        "ring-strong": "0 0 0 1px rgba(15, 23, 42, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
