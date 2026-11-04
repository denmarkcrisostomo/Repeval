import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Interactive, staticFile, useCurrentFrame } from "remotion";
import { body, C, display } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Frame: React.FC<{ src: string; route: string; bug?: boolean; at: number }> = ({ src, route, bug, at }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: interpolate(frame, [at, at + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        scale: interpolate(frame, [at, at + 16], [0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
      }}
    >
      <div
        style={{
          borderRadius: 12,
          overflow: "hidden",
          outline: bug ? `6px solid ${C.bug}` : "2px solid rgba(255,255,255,0.08)",
          outlineOffset: bug ? 6 : -2,
          opacity: 1,
        }}
      >
        <Img src={staticFile(src)} style={{ width: 560, height: 315, objectFit: "cover", objectPosition: "top left", display: "block" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontFamily: body, fontSize: 36 }}>
        <span style={{ color: C.ink, fontWeight: 700 }}>{route}</span>
        <span style={{ color: bug ? C.bug : C.tealHi, fontWeight: 600 }}>{bug ? "possible bug" : "passed"}</span>
      </div>
    </div>
  );
};

export const Screens: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ground, padding: "90px 120px", alignItems: "center" }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Interactive.Div
          name="Title"
          style={{
            fontFamily: display,
            fontWeight: 700,
            fontSize: 112,
            lineHeight: 1,
            letterSpacing: "-0.025em",
            color: C.ink,
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Every page, photographed
        </Interactive.Div>
        <Interactive.Div
          name="Subtitle"
          style={{
            fontFamily: body,
            fontWeight: 500,
            fontSize: 44,
            color: C.muted,
            opacity: interpolate(frame, [10, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          At desktop and phone width
        </Interactive.Div>
      </div>
      <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "560px 560px", gap: "36px 64px" }}>
        <Frame src="home.png" route="/" at={8} />
        <Frame src="about.png" route="/about" at={18} />
        <Frame src="cart.png" route="/cart" bug at={28} />
        <Frame src="help.png" route="/help.html" at={38} />
      </div>
    </AbsoluteFill>
  );
};
