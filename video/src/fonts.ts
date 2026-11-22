import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/IBMPlexMono";

const serifNormal = loadSerif("normal", { weights: ["400"], subsets: ["latin"] });
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });

const interNormal = loadInter("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

const monoNormal = loadMono("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

export const SERIF = serifNormal.fontFamily;
export const SANS = interNormal.fontFamily;
export const MONO = monoNormal.fontFamily;
