import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { BoardRun } from "./scenes/BoardRun";
import { BugScene } from "./scenes/BugScene";
import { EndCard } from "./scenes/EndCard";
import { Hook } from "./scenes/Hook";
import { Screens } from "./scenes/Screens";

// 90 + 160 + 120 + 120 + 150 = 640 frames, minus 4 fades of 12 frames = 592 frames (about 20 s at 30 fps).
export const RepevalDemo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Hook" durationInFrames={90}>
      <Hook />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Board run" durationInFrames={160}>
      <BoardRun />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Screenshots" durationInFrames={120}>
      <Screens />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="Bug explained" durationInFrames={120}>
      <BugScene />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} />
    <TransitionSeries.Sequence name="End card" durationInFrames={150}>
      <EndCard />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
