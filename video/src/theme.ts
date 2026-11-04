import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts ship in public/fonts (Google Fonts, SIL Open Font License) so renders work offline.
void loadFont({ family: "Archivo Narrow", url: staticFile("fonts/ArchivoNarrow-700.woff2"), weight: "700" });
void loadFont({ family: "Archivo", url: staticFile("fonts/Archivo-500.woff2"), weight: "500 700" });
void loadFont({ family: "JetBrains Mono", url: staticFile("fonts/JetBrainsMono-500.woff2"), weight: "500" });

export const display = '"Archivo Narrow", "Arial Narrow", sans-serif';
export const body = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const mono = '"JetBrains Mono", ui-monospace, monospace';

// Repeval brand teal plus the departures-board palette from the website prototype.
export const C = {
  ground: "#0e1416",
  board: "#070b0c",
  flap: "#1a2225",
  ink: "#eef3f2",
  muted: "#9db0ad",
  dim: "#56686a",
  teal: "#00bba7",
  tealHi: "#2dd4bf",
  tealInk: "#5eead4",
  tealDeep: "#134e4a",
  bug: "#ff6b5e",
  amber: "#f5b83d",
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
