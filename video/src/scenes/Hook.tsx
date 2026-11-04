import React from "react";
import { AbsoluteFill, Easing, interpolate, Interactive, useCurrentFrame } from "remotion";
import { body, C, display } from "../theme";
import { Logo } from "../Logo";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ground, padding: "120px 140px", justifyContent: "center" }}>
      <Interactive.Div
        name="Wordmark"
        style={{
          position: "absolute",
          top: 84,
          left: 140,
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontFamily: body,
          fontWeight: 700,
          fontSize: 44,
          color: C.ink,
          opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        <Logo height={84} />
      </Interactive.Div>
      <Interactive.Div
        name="Headline line 1"
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 200,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: C.ink,
          opacity: interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [4, 24], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Tests for code
      </Interactive.Div>
      <Interactive.Div
        name="Headline line 2"
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 200,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: C.tealHi,
          opacity: interpolate(frame, [10, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [10, 30], ["0px 40px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        you never tested
      </Interactive.Div>
      <Interactive.Div
        name="Supporting line"
        style={{
          marginTop: 56,
          fontFamily: body,
          fontWeight: 500,
          fontSize: 48,
          color: C.muted,
          opacity: interpolate(frame, [32, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [32, 50], ["0px 20px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        Repeval writes and runs tests inside your own GitHub Actions.
      </Interactive.Div>
    </AbsoluteFill>
  );
};
