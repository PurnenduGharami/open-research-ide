import React from "react";
import { Composition } from "remotion";
import { LaunchVideo } from "./LaunchVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OpenResearchIDE"
      component={LaunchVideo}
      durationInFrames={960}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
