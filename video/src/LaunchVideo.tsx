import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import timeline from "./timeline.json";
import { S1Hook } from "./scenes/S1Hook";
import { S2Curiosity } from "./scenes/S2Curiosity";
import { S3Literature } from "./scenes/S3Literature";
import { S4Graph } from "./scenes/S4Graph";
import { S5Review } from "./scenes/S5Review";
import { S6Validate } from "./scenes/S6Validate";
import { S7Exports } from "./scenes/S7Exports";
import { S8Finale } from "./scenes/S8Finale";

const SCENE_MAP: Record<string, React.FC<{ duration: number }>> = {
  hook: S1Hook,
  curiosity: S2Curiosity,
  literature: S3Literature,
  graph: S4Graph,
  review: S5Review,
  validate: S6Validate,
  exports: S7Exports,
  finale: S8Finale,
};

export const LaunchVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Audio src={staticFile("soundtrack.wav")} volume={0.9} />
      {timeline.scenes.map((scene) => {
        const Component = SCENE_MAP[scene.id];
        return (
          <Sequence
            key={scene.id}
            from={scene.from}
            durationInFrames={scene.duration}
            name={scene.id}
          >
            <Component duration={scene.duration} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
