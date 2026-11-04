import React from "react";
import { AbsoluteFill, Easing, interpolate, Interactive, Sequence, useCurrentFrame } from "remotion";
import { body, C, display, mono } from "../theme";
import { Logo } from "../Logo";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Promise: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.ground,
        padding: "120px 160px",
        justifyContent: "center",
        opacity: interpolate(frame, [52, 64], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}
    >
      <Interactive.Div
        name="Promise"
        style={{
          fontFamily: display,
          fontWeight: 700,
          fontSize: 150,
          lineHeight: 0.95,
          letterSpacing: "-0.03em",
          color: C.ink,
          opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [0, 20], ["0px 30px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
        }}
      >
        Your code never leaves GitHub
      </Interactive.Div>
      <Interactive.Div
        name="Promise detail"
        style={{
          marginTop: 44,
          fontFamily: body,
          fontWeight: 500,
          fontSize: 52,
          color: C.tealInk,
          opacity: interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        No database. Nothing stored. Free and open source.
      </Interactive.Div>
    </AbsoluteFill>
  );
};

const CallToAction: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ground, alignItems: "center", justifyContent: "center", gap: 64 }}>
      <Interactive.Div
        name="Logo"
        style={{
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [0, 20], [0.96, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
        }}
      >
        <Logo
          height={300}
          tip={interpolate(frame, [6, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}
          base={interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })}
        />
      </Interactive.Div>
      <div
        style={{
          display: "flex",
          gap: 28,
          opacity: interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          translate: interpolate(frame, [14, 30], ["0px 20px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }),
        }}
      >
        <Interactive.Div
          name="Sign in"
          style={{ padding: "26px 44px", borderRadius: 999, backgroundColor: C.teal, color: "#04201d", fontFamily: body, fontWeight: 700, fontSize: 48 }}
        >
          Sign in with GitHub
        </Interactive.Div>
        <Interactive.Div
          name="Command"
          style={{ padding: "26px 44px", borderRadius: 999, backgroundColor: C.flap, color: C.ink, fontFamily: mono, fontWeight: 500, fontSize: 48 }}
        >
          npx repeval
        </Interactive.Div>
      </div>
      <Interactive.Div
        name="URL"
        style={{
          fontFamily: body,
          fontWeight: 500,
          fontSize: 44,
          color: C.muted,
          opacity: interpolate(frame, [26, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        repeval.vercel.app
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.ground }}>
    <Sequence name="Promise" durationInFrames={64}>
      <Promise />
    </Sequence>
    <Sequence name="Call to action" from={60}>
      <CallToAction />
    </Sequence>
  </AbsoluteFill>
);
