import React from "react";
import { Composition, Folder } from "remotion";
import { RepevalDemo } from "./RepevalDemo";
import { BoardRun } from "./scenes/BoardRun";
import { BugScene } from "./scenes/BugScene";
import { EndCard } from "./scenes/EndCard";
import { Hook } from "./scenes/Hook";
import { Screens } from "./scenes/Screens";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="RepevalDemo-Scenes">
        <Composition id="Hook" component={Hook} width={1920} height={1080} fps={30} durationInFrames={90} />
        <Composition id="BoardRun" component={BoardRun} width={1920} height={1080} fps={30} durationInFrames={160} />
        <Composition id="Screens" component={Screens} width={1920} height={1080} fps={30} durationInFrames={120} />
        <Composition id="BugScene" component={BugScene} width={1920} height={1080} fps={30} durationInFrames={120} />
        <Composition id="EndCard" component={EndCard} width={1920} height={1080} fps={30} durationInFrames={150} />
      </Folder>
      <Composition id="RepevalDemo" component={RepevalDemo} width={1920} height={1080} fps={30} durationInFrames={592} />
    </>
  );
};
