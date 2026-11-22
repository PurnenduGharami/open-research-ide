import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const C = {
  canvas: "#f5f5f4",
  surface: "#ffffff",
  secondary: "#f9f9f8",
  selected: "#f0f4f1",
  ink: "#1d1d1f",
  secondaryInk: "#636366",
  tertiary: "#858587",
  hairline: "#e4e4e1",
  strong: "#d4d4d0",
  forest: "#2f6550",
  forestSoft: "#eaf2ed",
  blue: "#476c87",
  red: "#b34b43",
  warning: "#9a6a27",
};

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const LogoMark: React.FC<{ size?: number }> = ({ size = 42 }) => (
  <svg width={size} height={size} viewBox="0 0 42 42" fill="none" aria-hidden>
    <rect width="42" height="42" rx="12" fill={C.forestSoft} />
    <circle cx="17" cy="17" r="7" stroke={C.forest} strokeWidth="2.2" />
    <path d="M22 22L29 29" stroke={C.forest} strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="30" cy="12" r="2.4" fill={C.forest} />
    <path d="M21.5 12H27" stroke={C.forest} strokeWidth="1.8" />
  </svg>
);

const Brand: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div style={{ display: "flex", alignItems: "center", gap: compact ? 10 : 13 }}>
    <LogoMark size={compact ? 34 : 42} />
    <span style={{ fontSize: compact ? 17 : 21, fontWeight: 650, letterSpacing: -0.4 }}>
      Open Research <span style={{ color: C.secondaryInk, fontWeight: 500 }}>IDE</span>
    </span>
  </div>
);

const Pill: React.FC<{ children: React.ReactNode; tone?: "green" | "blue" | "red" | "neutral" }> = ({
  children,
  tone = "neutral",
}) => {
  const color = tone === "green" ? C.forest : tone === "blue" ? C.blue : tone === "red" ? C.red : C.secondaryInk;
  const background = tone === "green" ? C.forestSoft : tone === "red" ? "#f8efed" : tone === "blue" ? "#edf2f5" : C.secondary;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 28,
        padding: "4px 11px",
        borderRadius: 999,
        border: `1px solid ${C.hairline}`,
        background,
        color,
        fontFamily: MONO,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

const Arrow: React.FC<{ color?: string; size?: number }> = ({ color = C.tertiary, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 12H19M14 7L19 12L14 17" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, distance = 22, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200, stiffness: 95, mass: 0.65 },
  });
  return (
    <div
      style={{
        ...style,
        opacity: progress,
        transform: `translateY(${(1 - progress) * distance}px)`,
      }}
    >
      {children}
    </div>
  );
};

const Scene: React.FC<{
  children: React.ReactNode;
  duration: number;
  hero?: boolean;
}> = ({ children, duration, hero = false }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 10, duration - 13, duration - 1],
    [0, 1, 1, 0],
    { ...clamp, easing: Easing.inOut(Easing.quad) },
  );
  return (
    <AbsoluteFill
      style={{
        background: C.canvas,
        color: C.ink,
        fontFamily: FONT,
        opacity,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {!hero && (
        <div style={{ position: "absolute", left: 72, top: 42 }}>
          <Brand compact />
        </div>
      )}
      {children}
    </AbsoluteFill>
  );
};

const Heading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
}> = ({ eyebrow, title, subtitle }) => (
  <div style={{ position: "absolute", left: 88, top: 126, width: 1560 }}>
    <Reveal delay={2}>
      <div
        style={{
          color: C.forest,
          fontFamily: MONO,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          marginBottom: 17,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: 61, fontWeight: 650, letterSpacing: -2.3, lineHeight: 1.08 }}>{title}</div>
    </Reveal>
    <Reveal delay={8}>
      <div style={{ color: C.secondaryInk, fontSize: 21, lineHeight: 1.45, marginTop: 14 }}>{subtitle}</div>
    </Reveal>
  </div>
);

const ProductWindow: React.FC<{
  children: React.ReactNode;
  label?: string;
  style?: React.CSSProperties;
}> = ({ children, label = "Illustrative research session", style }) => (
  <div
    style={{
      position: "absolute",
      left: 88,
      right: 88,
      top: 358,
      bottom: 74,
      border: `1px solid ${C.strong}`,
      borderRadius: 18,
      background: C.surface,
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 22px",
        borderBottom: `1px solid ${C.hairline}`,
        background: C.secondary,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[C.strong, C.strong, C.strong].map((color, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: 99, background: color }} />
          ))}
        </div>
        <span style={{ fontSize: 14, color: C.secondaryInk, fontWeight: 550 }}>{label}</span>
      </div>
      <Pill>PRODUCT SCENE · SCHEMATIC</Pill>
    </div>
    {children}
  </div>
);

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      position: "absolute",
      bottom: 25,
      left: 88,
      right: 88,
      textAlign: "center",
      fontSize: 17,
      lineHeight: 1.4,
      color: C.secondaryInk,
      letterSpacing: 0.05,
    }}
  >
    {children}
  </div>
);

const Hero: React.FC = () => (
  <Scene duration={105} hero>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", transform: "translateY(-16px)" }}>
        <Reveal delay={3} distance={18}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 31 }}>
            <LogoMark size={62} />
          </div>
        </Reveal>
        <Reveal delay={9}>
          <div style={{ fontSize: 82, lineHeight: 1.05, fontWeight: 650, letterSpacing: -3.4 }}>
            Research, with its
            <br />
            reasoning intact.
          </div>
        </Reveal>
        <Reveal delay={19}>
          <div style={{ marginTop: 27, fontSize: 24, color: C.secondaryInk, lineHeight: 1.45 }}>
            An open, local-first workspace for the lived investigation.
          </div>
        </Reveal>
        <Reveal delay={30}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 44 }}>
            <Pill tone="green">CURIOSITY</Pill>
            <Arrow size={20} />
            <Pill tone="blue">EVIDENCE</Pill>
            <Arrow size={20} />
            <Pill>EXPORTS</Pill>
          </div>
        </Reveal>
      </div>
    </div>
    <div style={{ position: "absolute", bottom: 37, width: "100%", textAlign: "center", color: C.tertiary, fontSize: 16, letterSpacing: 0.8 }}>
      OPEN RESEARCH IDE · OPEN SOURCE · LOCAL-FIRST
    </div>
  </Scene>
);

const Curiosity: React.FC = () => (
  <Scene duration={135}>
    <Heading
      eyebrow="01 · Curiosity"
      title={<>Start with a question,<br />not a conclusion.</>}
      subtitle="A dedicated research session begins with what you want to understand."
    />
    <Reveal delay={13} style={{ position: "absolute", inset: 0 }}>
      <ProductWindow style={{ top: 382 }} label="Open Research IDE / Research">
        <div style={{ display: "flex", height: "calc(100% - 52px)" }}>
          <div style={{ width: 70, borderRight: `1px solid ${C.hairline}`, background: C.secondary, paddingTop: 23, textAlign: "center" }}>
            <LogoMark size={34} />
            <div style={{ margin: "25px auto 0", width: 34, height: 34, borderRadius: 8, background: C.selected, display: "grid", placeItems: "center", color: C.forest, fontSize: 19 }}>↗</div>
          </div>
          <div style={{ flex: 1, padding: "27px 32px", position: "relative" }}>
            <div style={{ fontSize: 13, color: C.tertiary, fontFamily: MONO, letterSpacing: 0.7 }}>RESEARCH CANVAS</div>
            <div style={{ fontSize: 27, fontWeight: 630, letterSpacing: -0.8, marginTop: 9 }}>A new line of inquiry</div>
            <div style={{ marginTop: 26, padding: 20, borderRadius: 14, border: `1px solid ${C.hairline}`, background: C.secondary, width: "83%" }}>
              <div style={{ fontSize: 13, color: C.forest, fontWeight: 650, marginBottom: 9 }}>Curiosity</div>
              <div style={{ fontSize: 21, lineHeight: 1.5, maxWidth: 850 }}>
                Which mechanisms connect sleep loss to memory consolidation?
              </div>
            </div>
            <div style={{ position: "absolute", left: 32, right: 32, bottom: 25, minHeight: 74, border: `1px solid ${C.strong}`, borderRadius: 14, padding: "19px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 17, color: C.tertiary }}>Follow a question. Keep the evidence attached.</span>
              <div style={{ width: 39, height: 39, display: "grid", placeItems: "center", borderRadius: 10, background: C.forest }}>
                <Arrow color={C.surface} size={22} />
              </div>
            </div>
          </div>
          <div style={{ width: 304, borderLeft: `1px solid ${C.hairline}`, padding: "27px 24px", background: C.secondary }}>
            <div style={{ fontSize: 13, color: C.tertiary, fontFamily: MONO }}>INSPECTOR</div>
            <div style={{ fontSize: 21, fontWeight: 620, marginTop: 17 }}>Session context</div>
            <div style={{ height: 1, background: C.hairline, margin: "20px 0" }} />
            <Pill tone="green">DEDICATED SESSION</Pill>
            <p style={{ fontSize: 15, color: C.secondaryInk, lineHeight: 1.6, marginTop: 20 }}>
              Literature, artifacts, and exports remain connected to the same investigation.
            </p>
          </div>
        </div>
      </ProductWindow>
    </Reveal>
    <Caption>Curiosity becomes a research document—not a one-shot answer.</Caption>
  </Scene>
);

const RecordRow: React.FC<{
  number: string;
  title: string;
  detail: string;
  pill: string;
  delay: number;
}> = ({ number, title, detail, pill, delay }) => (
  <Reveal delay={delay} distance={12}>
    <div style={{ display: "flex", alignItems: "center", padding: "18px 20px", border: `1px solid ${C.hairline}`, borderRadius: 14, background: C.surface, marginBottom: 14 }}>
      <div style={{ width: 44, height: 52, borderRadius: 7, background: C.secondary, border: `1px solid ${C.hairline}`, display: "grid", placeItems: "center", color: C.blue, fontFamily: MONO, fontSize: 13 }}>
        {number}
      </div>
      <div style={{ marginLeft: 18, flex: 1 }}>
        <div style={{ fontSize: 19, fontWeight: 620 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.secondaryInk, marginTop: 5 }}>{detail}</div>
      </div>
      <Pill tone="green">{pill}</Pill>
    </div>
  </Reveal>
);

const Literature: React.FC = () => (
  <Scene duration={150}>
    <Heading
      eyebrow="02 · Literature & evidence"
      title={<>Make every claim<br />traceable.</>}
      subtitle="Real source records become normalized papers, immutable abstracts, and exact passages."
    />
    <ProductWindow label="Research / Literature">
      <div style={{ display: "flex", height: "calc(100% - 52px)" }}>
        <div style={{ flex: 1, padding: "22px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 630 }}>Literature workspace</div>
              <div style={{ fontSize: 13, color: C.secondaryInk, marginTop: 4 }}>OpenAlex + Semantic Scholar · source failures remain visible</div>
            </div>
            <Pill tone="blue">SOURCE METADATA</Pill>
          </div>
          <RecordRow number="01" title="Paper record" detail="Normalized title, authors, source identifiers, and DOI when supplied" pill="NORMALIZED" delay={8} />
          <RecordRow number="02" title="Abstract snapshot" detail="Immutable source abstract retained for isolated review" pill="IMMUTABLE" delay={15} />
          <RecordRow number="03" title="Evidence passage" detail="Exact excerpt anchored to its abstract; confirmation remains explicit" pill="UNVERIFIED" delay={22} />
        </div>
        <div style={{ width: 350, borderLeft: `1px solid ${C.hairline}`, padding: "25px 24px", background: C.secondary }}>
          <div style={{ fontSize: 13, fontFamily: MONO, color: C.tertiary }}>CANONICAL PROJECT</div>
          <div style={{ fontSize: 23, fontWeight: 630, marginTop: 13 }}>Evidence, intact.</div>
          <div style={{ marginTop: 23, display: "grid", gap: 12 }}>
            {["Normalized node", "Exact abstract", "Typed semantic edge"].map((label) => (
              <div key={label} style={{ border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "13px 15px", background: C.surface, fontSize: 15, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ color: C.forest, fontSize: 17 }}>•</span>{label}
              </div>
            ))}
          </div>
          <div style={{ padding: 16, background: C.forestSoft, borderRadius: 12, marginTop: 20, fontSize: 14, color: C.forest, lineHeight: 1.5 }}>
            Evidence is unverified until deterministic human confirmation.
          </div>
        </div>
      </div>
    </ProductWindow>
    <Caption>The excerpt stays attached to the paper—and to the project revision.</Caption>
  </Scene>
);

const GraphNode: React.FC<{
  x: number;
  y: number;
  title: string;
  kind: string;
  width?: number;
  tone?: "green" | "red" | "blue";
}> = ({ x, y, title, kind, width = 190, tone = "blue" }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width,
      minHeight: 70,
      padding: "12px 15px",
      background: tone === "green" ? C.forestSoft : tone === "red" ? "#fbf6f5" : C.surface,
      border: `1px solid ${tone === "red" ? C.red : C.strong}`,
      borderRadius: 12,
    }}
  >
    <div style={{ fontFamily: MONO, fontSize: 10, color: tone === "red" ? C.red : C.tertiary, letterSpacing: 0.6 }}>{kind.toUpperCase()}</div>
    <div style={{ fontSize: 16, fontWeight: 610, marginTop: 5 }}>{title}</div>
  </div>
);

const KnowledgeGraph: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [10, 52], [0, 1], clamp);
  return (
    <Scene duration={135}>
      <Heading
        eyebrow="03 · Knowledge graph"
        title={<>See how the ideas<br />connect.</>}
        subtitle="The graph and inspector are two views of one canonical revision."
      />
      <ProductWindow label="Research / Knowledge graph">
        <div style={{ display: "flex", height: "calc(100% - 52px)" }}>
          <div style={{ flex: 1, position: "relative", padding: 22, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 30, top: 20 }}><Pill tone="blue">TYPED SEMANTIC EDGES</Pill></div>
            <div style={{ position: "absolute", left: 170, top: 70, width: 1050, height: 380 }}>
              <svg width="1050" height="380" viewBox="0 0 1050 380" style={{ position: "absolute", inset: 0 }} aria-hidden>
                <defs>
                  <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={C.strong} /></marker>
                  <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill={C.red} /></marker>
                </defs>
                {[
                  { d: "M210 170 C250 170 245 105 285 105" },
                  { d: "M210 190 C250 190 245 305 285 305" },
                  { d: "M475 105 C535 105 515 180 565 180", red: true },
                  { d: "M475 305 C535 305 515 200 565 200" },
                  { d: "M755 180 C810 180 800 105 840 105" },
                  { d: "M755 200 C810 200 800 305 840 305", red: true },
                ].map((line, i) => (
                  <path
                    key={i}
                    d={line.d}
                    fill="none"
                    stroke={line.red ? C.red : C.strong}
                    strokeWidth={line.red ? 2 : 1.5}
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={1 - draw}
                    markerEnd={line.red ? "url(#arrow-red)" : "url(#arrow-gray)"}
                  />
                ))}
              </svg>
              <GraphNode x={20} y={140} title="Curiosity" kind="Question" tone="green" />
              <GraphNode x={285} y={70} title="Paper record" kind="Literature" />
              <GraphNode x={285} y={270} title="Exact passage" kind="Evidence" />
              <GraphNode x={565} y={150} title="Hypothesis" kind="Interpretation" tone="green" />
              <GraphNode x={840} y={70} title="Research gap" kind="Open question" width={190} />
              <GraphNode x={840} y={270} title="Contradiction" kind="Explicit conflict" tone="red" width={190} />
              <div style={{ position: "absolute", left: 675, top: 280, color: C.red, fontSize: 12, fontFamily: MONO }}>CONTRADICTS</div>
            </div>
          </div>
          <div style={{ width: 332, borderLeft: `1px solid ${C.hairline}`, padding: "25px 24px", background: C.secondary }}>
            <Pill tone="green">REVISION SYNCHRONIZED</Pill>
            <div style={{ fontSize: 25, fontWeight: 630, marginTop: 20 }}>Exact passage</div>
            <div style={{ fontSize: 13, color: C.blue, fontFamily: MONO, marginTop: 6 }}>EVIDENCE · UNVERIFIED</div>
            <div style={{ height: 1, background: C.hairline, margin: "21px 0" }} />
            <div style={{ fontSize: 13, color: C.tertiary }}>Relationships</div>
            <div style={{ fontSize: 16, lineHeight: 1.7, marginTop: 10 }}>Supports hypothesis<br /><span style={{ color: C.red }}>Contradiction labelled explicitly</span></div>
            <div style={{ marginTop: 22, padding: 15, borderRadius: 12, border: `1px solid ${C.hairline}`, background: C.surface, color: C.secondaryInk, fontSize: 14, lineHeight: 1.55 }}>
              Color never carries meaning alone. Every semantic edge has a label.
            </div>
          </div>
        </div>
      </ProductWindow>
      <Caption>One subtle cross-fade. Canvas and inspector resolve together.</Caption>
    </Scene>
  );
};

const ReviewCard: React.FC<{
  letter: string;
  title: string;
  text: string;
  delay: number;
}> = ({ letter, title, text, delay }) => (
  <Reveal delay={delay} style={{ flex: 1 }} distance={18}>
    <div style={{ height: 282, border: `1px solid ${C.hairline}`, borderRadius: 14, background: C.surface, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 48, height: 48, borderRadius: 13, background: C.forestSoft, color: C.forest, display: "grid", placeItems: "center", fontSize: 21, fontWeight: 650 }}>{letter}</div>
        <Pill>ZERO MEMORY</Pill>
      </div>
      <div style={{ fontSize: 25, fontWeight: 630, marginTop: 25 }}>{title}</div>
      <div style={{ fontSize: 16, color: C.secondaryInk, lineHeight: 1.6, marginTop: 12 }}>{text}</div>
      <div style={{ height: 1, background: C.hairline, margin: "22px 0 16px" }} />
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.forest }}>STRUCTURED FINDING → ELEPHANT</div>
    </div>
  </Reveal>
);

const Reviews: React.FC = () => (
  <Scene duration={135}>
    <Heading
      eyebrow="04 · Isolated Goldfish reviews"
      title={<>Three fresh perspectives.<br />No shared assumptions.</>}
      subtitle="Elephant sends only the artifact and raw abstracts to independent reviewers."
    />
    <div style={{ position: "absolute", left: 88, right: 88, top: 378, bottom: 88, border: `1px solid ${C.strong}`, borderRadius: 18, background: C.secondary, padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Pill tone="blue">RAW ABSTRACTS + ARTIFACT</Pill><Arrow /><span style={{ fontSize: 14, color: C.secondaryInk }}>Up to three reviewers in parallel</span></div>
        <Pill tone="green">ISOLATED EXECUTION</Pill>
      </div>
      <div style={{ display: "flex", gap: 20 }}>
        <ReviewCard letter="A" title="Auditor" text="Checks whether each claim stays anchored to its supplied evidence." delay={10} />
        <ReviewCard letter="C" title="Critic" text="Tests alternative explanations and challenges unsupported leaps." delay={18} />
        <ReviewCard letter="F" title="Feasibility" text="Examines protocol constraints, practicality, and missing resources." delay={26} />
      </div>
      <div style={{ marginTop: 22, fontSize: 14, color: C.secondaryInk, textAlign: "center" }}>
        Reviewers return findings. They never write the canonical project JSON directly.
      </div>
    </div>
    <Caption>Independent scrutiny, gathered back into the same investigation.</Caption>
  </Scene>
);

const Experiment: React.FC = () => (
  <Scene duration={165}>
    <Heading
      eyebrow="05 · Experiment & predictions"
      title={<>Make the next step<br />testable.</>}
      subtitle="A proposed protocol with frozen expectations—and a separate place for results."
    />
    <ProductWindow label="Research / Experiments">
      <div style={{ display: "flex", height: "calc(100% - 52px)" }}>
        <div style={{ flex: 1, padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontSize: 25, fontWeight: 630 }}>Proposed experiment</div><div style={{ fontSize: 14, color: C.secondaryInk, marginTop: 5 }}>Protocol prepared for review—not executed</div></div>
            <Pill tone="red">NOT RUN</Pill>
          </div>
          <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
            {[
              ["01", "Define the protocol", "Variables, controls, and collection procedure"],
              ["02", "Freeze expected outcomes", "Predictions preserved before observations arrive"],
              ["03", "Import results separately", "Results append without rewriting predictions"],
            ].map(([number, title, detail]) => (
              <div key={number} style={{ display: "flex", alignItems: "center", padding: "15px 18px", borderRadius: 12, border: `1px solid ${C.hairline}`, background: C.surface }}>
                <span style={{ fontFamily: MONO, color: C.forest, fontSize: 13, width: 40 }}>{number}</span>
                <div><div style={{ fontSize: 17, fontWeight: 620 }}>{title}</div><div style={{ fontSize: 13, color: C.secondaryInk, marginTop: 3 }}>{detail}</div></div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 19 }}><Pill>LAB OPTIONS</Pill><Pill>OUTREACH DRAFT</Pill><Pill>HONEST PRICE CLAIMS</Pill></div>
        </div>
        <div style={{ width: 390, borderLeft: `1px solid ${C.hairline}`, padding: "25px 26px", background: C.secondary }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, fontFamily: MONO, color: C.tertiary }}>PREDICTION RECORD</span><Pill tone="green">FROZEN</Pill></div>
          <div style={{ fontSize: 25, fontWeight: 630, marginTop: 20 }}>Expected outcomes</div>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: C.secondaryInk }}>
            Locked before result import. Later observations cannot silently overwrite the original prediction.
          </p>
          <div style={{ padding: 18, border: `1px solid ${C.strong}`, borderRadius: 12, background: C.surface, marginTop: 22 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.warning }}>RESULT STATUS</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>No results imported</div>
            <div style={{ fontSize: 13, color: C.secondaryInk, marginTop: 6 }}>Awaiting a separate, explicit import.</div>
          </div>
        </div>
      </div>
    </ProductWindow>
    <Caption>A proposal remains a proposal until real observations are imported.</Caption>
  </Scene>
);

const FileSymbol: React.FC<{ extension: string }> = ({ extension }) => (
  <div style={{ width: 58, height: 72, border: `1px solid ${C.strong}`, borderRadius: 9, background: C.secondary, position: "relative", display: "grid", placeItems: "center" }}>
    <div style={{ position: "absolute", right: -1, top: -1, width: 17, height: 17, background: C.canvas, borderLeft: `1px solid ${C.strong}`, borderBottom: `1px solid ${C.strong}`, borderRadius: "0 8px 0 3px" }} />
    <span style={{ fontFamily: MONO, color: C.forest, fontSize: 12, fontWeight: 650 }}>{extension}</span>
  </div>
);

const ExportCard: React.FC<{
  extension: string;
  title: string;
  detail: string;
  delay: number;
}> = ({ extension, title, detail, delay }) => (
  <Reveal delay={delay} style={{ flex: 1 }} distance={16}>
    <div style={{ height: 225, padding: 23, border: `1px solid ${C.hairline}`, borderRadius: 14, background: C.surface }}>
      <FileSymbol extension={extension} />
      <div style={{ fontSize: 22, fontWeight: 630, marginTop: 21 }}>{title}</div>
      <div style={{ fontSize: 14, color: C.secondaryInk, lineHeight: 1.5, marginTop: 7 }}>{detail}</div>
    </div>
  </Reveal>
);

const Exports: React.FC = () => (
  <Scene duration={135}>
    <Heading
      eyebrow="06 · Publish"
      title={<>One project.<br />Four faithful exports.</>}
      subtitle="Take the investigation with you, without rebuilding its context."
    />
    <div style={{ position: "absolute", left: 88, right: 88, top: 378, bottom: 92, border: `1px solid ${C.strong}`, borderRadius: 18, background: C.secondary, padding: "25px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <Pill tone="green">SAME LIVE PROJECT REVISION</Pill>
        <div style={{ height: 40, borderRadius: 8, background: C.forest, color: C.surface, padding: "10px 17px", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 10 }}>Export project <Arrow color={C.surface} size={19} /></div>
      </div>
      <div style={{ display: "flex", gap: 18 }}>
        <ExportCard extension="HTML" title="Interactive HTML" detail="A standalone, explorable research document." delay={8} />
        <ExportCard extension="PDF" title="Print-derived PDF" detail="A faithful, portable reading copy." delay={14} />
        <ExportCard extension="TEX" title="main.tex" detail="LaTeX source generated from the same state." delay={20} />
        <ExportCard extension="BIB" title="references.bib" detail="References connected to the exported work." delay={26} />
      </div>
    </div>
    <Caption>Curiosity, evidence, experiment, and references—kept in sync.</Caption>
  </Scene>
);

const Finale: React.FC = () => (
  <Scene duration={105} hero>
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", transform: "translateY(-12px)" }}>
        <Reveal delay={2}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 29 }}><LogoMark size={58} /></div>
        </Reveal>
        <Reveal delay={8}>
          <div style={{ fontSize: 88, fontWeight: 650, letterSpacing: -3.4, lineHeight: 1.08 }}>Follow the evidence.</div>
        </Reveal>
        <Reveal delay={17}>
          <div style={{ fontSize: 26, color: C.secondaryInk, marginTop: 24 }}>
            Keep curiosity, scrutiny, and every output in one research workspace.
          </div>
        </Reveal>
        <Reveal delay={25}>
          <div style={{ marginTop: 35, fontSize: 22, fontWeight: 620 }}>Open Research IDE</div>
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 14, color: C.forest, letterSpacing: 0.8 }}>OPEN SOURCE · LOCAL-FIRST · REVISION-AWARE</div>
        </Reveal>
      </div>
    </div>
  </Scene>
);

export const LaunchVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.canvas }}>
      <Sequence from={0} durationInFrames={105}><Hero /></Sequence>
      <Sequence from={90} durationInFrames={135}><Curiosity /></Sequence>
      <Sequence from={210} durationInFrames={150}><Literature /></Sequence>
      <Sequence from={345} durationInFrames={135}><KnowledgeGraph /></Sequence>
      <Sequence from={465} durationInFrames={135}><Reviews /></Sequence>
      <Sequence from={585} durationInFrames={165}><Experiment /></Sequence>
      <Sequence from={735} durationInFrames={135}><Exports /></Sequence>
      <Sequence from={855} durationInFrames={105}><Finale /></Sequence>
    </AbsoluteFill>
  );
};
