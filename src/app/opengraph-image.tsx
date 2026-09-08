import { ImageResponse } from "next/og";

// Generated at build time rather than shipped as a binary, so the card can
// never drift from the site's own palette and wording.
//
// Deliberately no emoji: ImageResponse only renders them by fetching sprites
// from a CDN at generation time, which would make the build depend on a
// third-party network call. The wave is drawn instead.

export const runtime = "nodejs";
export const alt = "Wavelength — events on your wavelength, Jacksonville, FL";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          // Mirrors the pastel wash in globals.css: warm off-white base with
          // mint and blush bleeding in from opposite corners. Satori rejects a
          // bare colour inside the `background` shorthand, so the base colour
          // and the gradients are set as separate properties.
          backgroundColor: "#FEFCF7",
          backgroundImage:
            "radial-gradient(ellipse 55% 60% at 6% 0%, rgba(180,224,196,0.85) 0%, rgba(254,252,247,0) 62%)," +
            "radial-gradient(ellipse 60% 65% at 100% 8%, rgba(248,198,214,0.85) 0%, rgba(254,252,247,0) 62%)," +
            "radial-gradient(ellipse 55% 55% at 92% 100%, rgba(180,224,196,0.7) 0%, rgba(254,252,247,0) 60%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 148,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            color: "#0f172a",
            lineHeight: 1,
          }}
        >
          Wavelength
        </div>

        {/* Stylised wave, standing in for the surfer in the wordmark. */}
        <svg width="470" height="52" viewBox="0 0 470 52" style={{ marginTop: 26 }}>
          {/* Every segment is an explicit cubic. Satori renders the smooth-curve
              shorthand (S) unreliably and left a visible break mid-wave. */}
          <path
            d="M8 34 C 52 6, 96 6, 140 34 C 184 62, 228 62, 272 34 C 316 6, 360 6, 404 34 C 424 47, 442 50, 462 46"
            fill="none"
            stroke="#0d9488"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 46,
            color: "#334155",
            fontWeight: 500,
          }}
        >
          Events on your wavelength · Jacksonville, FL
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 31,
            color: "#64748b",
          }}
        >
          Free yoga, live music, markets, festivals and community events —
        </div>
        <div style={{ display: "flex", fontSize: 31, color: "#64748b" }}>
          pulled together from a dozen local calendars.
        </div>
      </div>
    ),
    size
  );
}
