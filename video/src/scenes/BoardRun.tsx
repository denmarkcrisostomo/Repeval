import React from "react";
import { AbsoluteFill, Easing, interpolate, Interactive, useCurrentFrame } from "remotion";
import { FlapText, type FlapState } from "../Flap";
import { body, C } from "../theme";

// The real demo-shop run, as GitHub reports its workflow steps.
// [name, what it does while running, result detail, running from frame, settles at frame, result]
const STEPS: [string, string, string, number, number, "passed" | "bug"][] = [
  ["Checkout", "copying repo", "demo-shop", 6, 20, "passed"],
  ["Set up Node", "installing", "node 22", 20, 34, "passed"],
  ["Analyze", "reading code", "express 5 pages", 34, 52, "passed"],
  ["Plan", "picking tests", "9 of 13 targets", 52, 64, "passed"],
  ["Generate", "writing tests", "4 test files", 64, 76, "passed"],
  ["Test", "opening pages", "10 passed 1 bug", 76, 112, "bug"],
  ["Save report", "uploading", "kept 7 days", 112, 124, "passed"],
];
const SIZE = 38;

export const BoardRun: React.FC = () => {
  const frame = useCurrentFrame();
  const seconds = Math.round(interpolate(frame, [6, 124], [0, 62], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <AbsoluteFill style={{ backgroundColor: C.ground, padding: "96px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <Interactive.Div name="Repo" style={{ fontFamily: body, fontWeight: 700, fontSize: 64, color: C.ink, letterSpacing: "-0.02em" }}>
            you / demo-shop
          </Interactive.Div>
          <Interactive.Div name="Run meta" style={{ fontFamily: body, fontWeight: 500, fontSize: 40, color: C.muted, marginTop: 8 }}>
            Run on main, on GitHub Actions
          </Interactive.Div>
        </div>
        <Interactive.Div
          name="Clock"
          style={{ fontFamily: body, fontWeight: 700, fontSize: 96, color: C.ink, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
        >
          {clock}
        </Interactive.Div>
      </div>

      <Interactive.Div
        name="Board"
        style={{
          marginTop: 48,
          backgroundColor: C.board,
          borderRadius: 28,
          padding: "40px 44px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [0, 14], [0.97, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        {STEPS.map(([name, doing, detail, run, done, result], i) => {
          const finalColor = result === "bug" ? C.bug : C.tealHi;
          const nameStates: FlapState[] = [
            { from: 0, text: name, color: C.dim },
            { from: run, text: name, color: C.amber },
            { from: done, text: name, color: finalColor },
          ];
          const detailStates: FlapState[] = [
            { from: run, text: doing, color: C.amber },
            { from: done, text: detail, color: finalColor },
          ];
          const statusStates: FlapState[] = [
            { from: 0, text: "waiting", color: C.dim },
            { from: run + 2, text: "running", color: C.amber },
            { from: done + 4, text: result === "bug" ? "bug" : "passed", color: finalColor },
          ];
          return (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <FlapText states={nameStates} width={11} size={SIZE} seed={`n${i}`} />
              <FlapText states={detailStates} width={15} size={SIZE} seed={`d${i}`} />
              <FlapText states={statusStates} width={7} size={SIZE} seed={`s${i}`} />
            </div>
          );
        })}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
