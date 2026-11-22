import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/index.ts");
Config.setCodec("h264");
Config.setCrf(23);
Config.setPixelFormat("yuv420p");
// One worker stays below the constrained CI/WSL memory ceiling.
Config.setConcurrency(1);
Config.setOverwriteOutput(true);
