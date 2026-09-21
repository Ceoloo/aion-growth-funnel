import { ImageResponse } from "next/og";
import { brand, metadata as siteCopy } from "@/content/site";

export const runtime = "nodejs";
export const alt = siteCopy.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social sharing card, generated from the same copy as the site. Original
 * AION composition — no third-party marks or imagery.
 */
export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a1726",
          padding: "72px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: 8,
              color: "#fdfcfa",
              display: "flex",
            }}
          >
            AION
          </div>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 99,
              background: "#1f63f5",
              display: "flex",
            }}
          />
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: 10,
              color: "#6b7787",
              display: "flex",
            }}
          >
            SYSTEMS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 62,
              lineHeight: 1.1,
              fontWeight: 600,
              color: "#fdfcfa",
              maxWidth: 940,
              display: "flex",
            }}
          >
            {brand.tagline}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "#e6e0d4",
              maxWidth: 900,
              display: "flex",
            }}
          >
            Marketing, content and sales connected — so every inquiry has a clear next step.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {brand.chain.map((stage, index) => (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 600,
                  color: "#fdfcfa",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: 99,
                  padding: "10px 20px",
                  display: "flex",
                }}
              >
                {stage}
              </div>
              {index < brand.chain.length - 1 ? (
                <div style={{ fontSize: 22, color: "#2eb6d4", display: "flex" }}>→</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
