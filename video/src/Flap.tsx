import React from "react";
import { random, useCurrentFrame } from "remotion";
import { body, C } from "./theme";

const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export type FlapState = { from: number; text: string; color: string };

/**
 * A row of split-flap cells. Each state change flips only the cells whose letter changes,
 * cycling through random letters (seeded, so every render is identical) before settling.
 */
export const FlapText: React.FC<{ states: FlapState[]; width: number; size: number; seed: string }> = ({
  states,
  width,
  size,
  seed,
}) => {
  const frame = useCurrentFrame();
  const pad = (s: string) => (s.toUpperCase() + " ".repeat(width)).slice(0, width);
  let idx = -1;
  states.forEach((s, i) => {
    if (frame >= s.from) idx = i;
  });
  const cur = idx >= 0 ? states[idx] : { from: 0, text: "", color: C.dim };
  const prev = idx > 0 ? pad(states[idx - 1].text) : pad("");
  const target = pad(cur.text);

  return (
    <div style={{ display: "flex", gap: size * 0.12 }}>
      {target.split("").map((ch, i) => {
        const begin = cur.from + i;
        const changed = prev[i] !== ch;
        const flips = changed && ch !== " " ? 3 + Math.floor(random(`${seed}-${idx}-${i}`) * 4) : 0;
        const settle = begin + flips * 2;
        let shown = ch;
        let squash = 1;
        if (changed && frame < begin) shown = prev[i];
        else if (changed && frame < settle) {
          shown = CH[Math.floor(random(`${seed}-${idx}-${i}-${Math.floor(frame / 2)}`) * CH.length)];
          squash = (frame - begin) % 2 === 0 ? 0.3 : 1;
        }
        return (
          <div
            key={i}
            style={{
              width: size * 1.05,
              height: size * 1.5,
              background: C.flap,
              borderRadius: size * 0.12,
              display: "grid",
              placeItems: "center",
              position: "relative",
              overflow: "hidden",
              fontFamily: body,
              fontWeight: 700,
              fontSize: size,
              lineHeight: 1,
              color: cur.color,
            }}
          >
            <span style={{ scale: `1 ${squash}` }}>{shown}</span>
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "rgba(0,0,0,0.55)" }} />
          </div>
        );
      })}
    </div>
  );
};
