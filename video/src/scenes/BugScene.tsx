import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Interactive, staticFile, useCurrentFrame } from "remotion";
import { body, C, display, mono } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

export const BugScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ground, padding: "100px 160px", flexDirection: "row", alignItems: "center", gap: 120 }}>
      <Img
        name="Cart on a phone"
        src={staticFile("cart-m.png")}
        style={{
          width: 400,
          height: 866,
          borderRadius: 36,
          outline: `6px solid ${C.bug}`,
          outlineOffset: 8,
          opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [0, 20], ["-40px 0px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
        }}
      />
      <div style={{ flex: 1 }}>
        <Interactive.Div
          name="Status pill"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 26px",
            borderRadius: 999,
            backgroundColor: "rgba(255,107,94,0.16)",
            color: C.bug,
            fontFamily: body,
            fontWeight: 700,
            fontSize: 40,
            opacity: interpolate(frame, [8, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.bug }} />
          Possible bug on /cart
        </Interactive.Div>
        <Interactive.Div
          name="Headline"
          style={{
            marginTop: 36,
            fontFamily: display,
            fontWeight: 700,
            fontSize: 120,
            lineHeight: 0.95,
            letterSpacing: "-0.025em",
            textWrap: "balance",
            color: C.ink,
            opacity: interpolate(frame, [14, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [14, 32], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
          }}
        >
          The cart page throws an error
        </Interactive.Div>
        <Interactive.Div
          name="Error"
          style={{
            marginTop: 44,
            display: "inline-block",
            padding: "18px 26px",
            borderRadius: 16,
            backgroundColor: C.board,
            color: C.bug,
            fontFamily: mono,
            fontWeight: 500,
            fontSize: 40,
            opacity: interpolate(frame, [30, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          cartTotal is not defined
        </Interactive.Div>
        <Interactive.Div
          name="Plain explanation"
          style={{
            marginTop: 40,
            maxWidth: 1000,
            fontFamily: body,
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.3,
            textWrap: "pretty",
            color: C.ink,
            opacity: interpolate(frame, [46, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            translate: interpolate(frame, [46, 64], ["0px 20px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
          }}
        >
          Visitors would see a total of $0. Repeval found it before they did, and explains it in plain words.
        </Interactive.Div>
      </div>
    </AbsoluteFill>
  );
};
