import { ImageResponse } from "next/og";

// Browser tab icon for the LineaDAT site.
// Spec: rounded black square with bold magenta-neon "DAT" text.
// Magenta = hsl(320 100% 60%) = #ff33cc, the project's --primary token.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: 6,
          boxSizing: "border-box",
          // Asymmetric grey outline: top/left dashed, right/bottom solid.
          borderTop: "2px dashed #888",
          borderLeft: "2px dashed #888",
          borderRight: "2px solid #888",
          borderBottom: "2px solid #888",
          color: "#ff33cc",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontWeight: 900,
          fontSize: 15,
          letterSpacing: -1,
          // Same-color sharp shadows act as a "stroke" outline -> reads as much
          // heavier glyphs than fontWeight alone can deliver in satori. Blurry
          // outer shadow keeps the magenta glow.
          textShadow:
            "1px 0 0 #ff33cc, -1px 0 0 #ff33cc, 0 1px 0 #ff33cc, 0 -1px 0 #ff33cc, 0 0 6px rgba(255,51,204,0.65)",
        }}
      >
        DAT
      </div>
    ),
    { ...size },
  );
}
