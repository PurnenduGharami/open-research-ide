import React from "react";
import { Composition } from "remotion";
import { LaunchVideo } from "./LaunchVideo";
import timeline from "./timeline.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OpenResearchIDE"
      component={LaunchVideo}
      durationInFrames={timeline.durationInFrames}
      fps={timeline.fps}
      width={timeline.width}
      height={timeline.height}
    />
  );
};
