import { executeResearchCommand } from "../plugins/research-engine/engine.mjs";
import { draftManuscriptFromProject } from "./manuscript.mjs";
import { generatePublicationSvgChart } from "./stats-engine.mjs";
import { ensureWorkspaceScaffold, writeWorkspaceFile } from "./workspace-files.mjs";

export async function seedSampleInvestigation(root = process.cwd()) {
  const stamp = Date.now();
  let project = await executeResearchCommand(root, {
    op: "create",
    commandId: `sample-create-${stamp}`,
    curiosity: "Why do sodium-ion batteries degrade below 0°C?",
    title: "Sodium-Ion Low-Temperature Capacity Loss (Sample Walkthrough)",
    mode: "guided",
  });

  const abstractA =
    "Hard-carbon anodes in sodium-ion cells exhibit sharp capacity drop below 0 °C. Using three-electrode impedance spectroscopy in diglyme electrolytes, we observe that sluggish Na+ desolvation at the electrode-electrolyte interface dominates charge-transfer activation energy (62 kJ/mol) at -20 °C, triggering sodium plating before bulk diffusion saturates.";
  const abstractB =
    "Low-temperature cycling of Na3V2(PO4)3 || hard-carbon full cells in carbonate ester (EC/PC) electrolytes reveals stable desolvation kinetics down to -15 °C, whereas progressive solid-electrolyte interphase (SEI) film thickening accounts for over 70% of total interfacial resistance below -20 °C during extended 1C cycling.";

  const quoteA =
    "sluggish Na+ desolvation at the electrode-electrolyte interface dominates charge-transfer activation energy (62 kJ/mol) at -20 °C";
  const quoteB =
    "progressive solid-electrolyte interphase (SEI) film thickening accounts for over 70% of total interfacial resistance below -20 °C";

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-nodes-${stamp}`,
    baseRevision: project.revision,
    op: "upsert_nodes",
    payload: {
      nodes: [
        {
          id: "paper:sample-desolvation",
          type: "paper",
          title: "Interfacial Na+ Desolvation Barriers in Sub-Zero Diglyme Electrolytes",
          sourceRefs: ["Illustrative Sample"],
          data: {
            abstract: abstractA,
            authors: ["H. Takahashi", "M. Alvarez"],
            year: 2025,
            venue: "Journal of Electrochemical Kinetics (Illustrative Sample)",
            provider: "Illustrative Sample",
            citeKey: "takahashi2025interfacial",
            readingStatus: "included",
          },
        },
        {
          id: "paper:sample-sei",
          type: "paper",
          title: "SEI Resistance Growth in Ester-Carbonate Sodium-Ion Full Cells at -20 °C",
          sourceRefs: ["Illustrative Sample"],
          data: {
            abstract: abstractB,
            authors: ["R. Nair", "K. Lindqvist"],
            year: 2025,
            venue: "Energy Storage Materials Review (Illustrative Sample)",
            provider: "Illustrative Sample",
            citeKey: "nair2025sei",
            readingStatus: "included",
          },
        },
        {
          id: "ev:sample-desolvation",
          type: "evidence",
          title: "Desolvation activation energy dominates at -20 °C (diglyme)",
          sourceRefs: ["paper:sample-desolvation"],
          data: {
            paperId: "paper:sample-desolvation",
            quote: quoteA,
          },
        },
        {
          id: "ev:sample-sei",
          type: "evidence",
          title: "SEI resistance accounts for >70% impedance below -20 °C (EC/PC)",
          sourceRefs: ["paper:sample-sei"],
          data: {
            paperId: "paper:sample-sei",
            quote: quoteB,
          },
        },
        {
          id: "contradiction:sample-rate-limit",
          type: "contradiction",
          title: "Dominant low-temperature bottleneck: Na+ desolvation vs. SEI resistance",
          sourceRefs: ["ev:sample-desolvation", "ev:sample-sei"],
          data: {
            description:
              "Study A attributes sub-zero capacity collapse primarily to interfacial Na+ desolvation kinetics, whereas Study B attributes >70% of resistance to SEI film growth—notice the two studies also tested different electrolyte chemistries (diglyme vs. EC/PC carbonate ester) and cycling protocols.",
            resolution: "unresolved",
            sides: [
              {
                label: "Study A (Diglyme · 3-electrode)",
                paperId: "paper:sample-desolvation",
                evidenceId: "ev:sample-desolvation",
                quote: quoteA,
                definitionNote: "Measured charge-transfer activation energy via three-electrode EIS in diglyme.",
              },
              {
                label: "Study B (EC/PC · Full cell)",
                paperId: "paper:sample-sei",
                evidenceId: "ev:sample-sei",
                quote: quoteB,
                definitionNote: "Measured total interfacial impedance after 1C cycling in carbonate ester electrolyte.",
              },
            ],
          },
        },
        {
          id: "gap:sample-electrolyte",
          type: "gap",
          title: "No controlled comparison isolating desolvation vs. SEI under identical cycling",
          sourceRefs: ["contradiction:sample-rate-limit"],
          data: {
            description:
              "Neither study isolates weak-solvation fluorinated co-solvents against identical SEI pre-conditioning in the same cell geometry below -20 °C.",
          },
        },
        {
          id: "hyp:sample-fluorinated",
          type: "hypothesis",
          title: "Weakly coordinating fluorinated co-solvent lowers desolvation barrier without thickening SEI",
          sourceRefs: ["gap:sample-electrolyte", "ev:sample-desolvation"],
          data: {
            statement:
              "Adding 15 vol% fluorinated ether co-solvent decreases Na+ desolvation activation energy below 42 kJ/mol and limits sub-zero capacity fade at -20 °C.",
          },
        },
        {
          id: "hyp:sample-sei-dominant",
          type: "hypothesis",
          title: "SEI Film Thickening Dominates Interfacial Impedance Below -20 °C",
          sourceRefs: ["gap:sample-electrolyte", "ev:sample-sei"],
          data: {
            statement:
              "Unless inorganic NaF-rich SEI passivation forms during formation cycles, carbonate-ester cells fail primarily due to SEI growth rather than bulk desolvation.",
          },
        },
        {
          id: "rev:sample-auditor",
          type: "review",
          title: "Evidence Auditor",
          sourceRefs: ["hyp:sample-fluorinated"],
          data: {
            reviewer: "auditor",
            hypothesisId: "hyp:sample-fluorinated",
            verdict: "Passages are SHA-256 verified substrings; confirm Study B's SEI definition against Study A before pooling metrics. Confidence: high.",
            findings: [
              {
                severity: "low",
                claim: "Exact abstract anchoring intact",
                rationale: "Both quotes match their immutable abstracts verbatim.",
                sourceNodeIds: ["ev:sample-desolvation", "ev:sample-sei"],
              },
            ],
          },
        },
        {
          id: "rev:sample-critic",
          type: "review",
          title: "Methodology Critic",
          sourceRefs: ["hyp:sample-fluorinated"],
          data: {
            reviewer: "critic",
            hypothesisId: "hyp:sample-fluorinated",
            verdict: "Electrolyte solvent differences confound direct comparison between Study A and Study B. Confidence: high.",
            findings: [
              {
                severity: "medium",
                claim: "Solvent chemistry confound across studies",
                rationale: "Diglyme vs. EC/PC changes both solvation sheath and SEI composition; use identical symmetric-cell controls.",
                sourceNodeIds: ["contradiction:sample-rate-limit"],
              },
            ],
          },
        },
        {
          id: "rev:sample-feasibility",
          type: "review",
          title: "Feasibility Reviewer",
          sourceRefs: ["hyp:sample-fluorinated"],
          data: {
            reviewer: "feasibility",
            hypothesisId: "hyp:sample-fluorinated",
            verdict: "Directly testable via Arrhenius impedance modeling and coin-cell EIS sweep at -20 °C. Confidence: high.",
            findings: [
              {
                severity: "low",
                claim: "Low-cost computational pre-screen ready",
                rationale: "Arrhenius fit separates R_ct and R_sei temperature slopes before wet-lab synthesis.",
                sourceNodeIds: ["hyp:sample-fluorinated"],
              },
            ],
          },
        },
        {
          id: "exp:sample-arrhenius",
          type: "experiment",
          title: "Sub-Zero Charge-Transfer vs. SEI Impedance Arrhenius Model",
          sourceRefs: ["hyp:sample-fluorinated"],
          data: {
            modality: "computational",
            objective: "Quantify predicted capacity retention at -20 °C when Ea_desolv is reduced from 62 to 40 kJ/mol.",
            protocol: [
              "Fit baseline charge-transfer resistance R_ct(T) using Ea = 62 kJ/mol from 25 °C down to -20 °C.",
              "Evaluate modified fluorinated co-solvent formulation at Ea = 40 kJ/mol under matched SEI impedance.",
              "Compare predicted 1C capacity retention at -20 °C against frozen acceptance thresholds.",
            ],
            controls: ["Unmodified baseline electrolyte (Ea = 62 kJ/mol)", "Matched SEI thickness parameter"],
            expectedOutcomes: [
              { metric: "Capacity loss at -20 °C", prediction: "<= 38% loss vs. 25 °C baseline", rationale: "Lower desolvation barrier avoids plating." },
              { metric: "R_ct ratio (-20 °C / 25 °C)", prediction: "<= 14x", rationale: "Arrhenius scaling at Ea = 40 kJ/mol." },
            ],
            codeExperiment: {
              language: "javascript",
              filename: "arrhenius_subzero.mjs",
              dependencies: [],
              runCommand: "node arrhenius_subzero.mjs",
              colabReady: true,
              code: [
                "const R = 8.314;",
                "const T_ref = 298.15;",
                "const T_cold = 253.15;",
                "const ratio = (eaKj) => Math.exp((eaKj * 1000 / R) * (1 / T_cold - 1 / T_ref));",
                "const baselineRatio = ratio(62);",
                "const fluorinatedRatio = ratio(40);",
                "console.log('Baseline R_ct ratio (-20C/25C):', baselineRatio.toFixed(2));",
                "console.log('Fluorinated R_ct ratio (-20C/25C):', fluorinatedRatio.toFixed(2));",
                "console.log('Simulated capacity loss at -20C: 35.4%');",
              ].join("\n"),
            },
          },
        },
      ],
      edges: [
        { id: "edge:s-ev1", source: "ev:sample-desolvation", target: "paper:sample-desolvation", type: "supports", label: "Exact abstract quote" },
        { id: "edge:s-ev2", source: "ev:sample-sei", target: "paper:sample-sei", type: "supports", label: "Exact abstract quote" },
        { id: "edge:s-c1", source: "contradiction:sample-rate-limit", target: "ev:sample-desolvation", type: "contradicts", label: "Desolvation bottleneck" },
        { id: "edge:s-c2", source: "contradiction:sample-rate-limit", target: "ev:sample-sei", type: "contradicts", label: "SEI resistance bottleneck" },
        { id: "edge:s-g1", source: "gap:sample-electrolyte", target: "contradiction:sample-rate-limit", type: "identifies", label: "Isolates solvent confound" },
        { id: "edge:s-h1", source: "hyp:sample-fluorinated", target: "gap:sample-electrolyte", type: "addresses", label: "Addresses gap" },
        { id: "edge:s-r1", source: "rev:sample-auditor", target: "hyp:sample-fluorinated", type: "reviews", label: "Evidence audit" },
        { id: "edge:s-r2", source: "rev:sample-critic", target: "hyp:sample-fluorinated", type: "reviews", label: "Methodology critique" },
        { id: "edge:s-r3", source: "rev:sample-feasibility", target: "hyp:sample-fluorinated", type: "reviews", label: "Feasibility check" },
        { id: "edge:s-e1", source: "exp:sample-arrhenius", target: "hyp:sample-fluorinated", type: "tests", label: "Tests hypothesis" },
      ],
    },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-confirm-${stamp}`,
    baseRevision: project.revision,
    op: "confirm_evidence",
    payload: { nodeId: "ev:sample-desolvation", method: "sample-walkthrough-confirmation" },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-blocks-${stamp}`,
    baseRevision: project.revision,
    op: "set_blocks",
    payload: {
      blocks: [
        { id: "sample-lit", kind: "literature", title: "Literature Snapshot (Illustrative Sample)", nodeIds: ["paper:sample-desolvation", "paper:sample-sei"] },
        { id: "sample-an", kind: "analysis", title: "Evidence, Side-by-Side Contradiction & Hypothesis", nodeIds: ["ev:sample-desolvation", "ev:sample-sei", "contradiction:sample-rate-limit", "gap:sample-electrolyte", "hyp:sample-fluorinated", "hyp:sample-sei-dominant"] },
        { id: "sample-rev", kind: "review", title: "Independent Review Panel", nodeIds: ["rev:sample-auditor", "rev:sample-critic", "rev:sample-feasibility"] },
        { id: "sample-exp", kind: "experiment", title: "Computational Validation Plan", nodeIds: ["exp:sample-arrhenius"] },
      ],
    },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-matrix1-${stamp}`,
    baseRevision: project.revision,
    op: "set_hypothesis_vote",
    payload: { evidenceId: "ev:sample-desolvation", hypothesisId: "hyp:sample-fluorinated", vote: "supports" },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-matrix2-${stamp}`,
    baseRevision: project.revision,
    op: "set_hypothesis_vote",
    payload: { evidenceId: "ev:sample-sei", hypothesisId: "hyp:sample-sei-dominant", vote: "supports" },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-idea-${stamp}`,
    baseRevision: project.revision,
    op: "upsert_idea",
    payload: {
      idea: {
        id: "idea:sample-1",
        title: "Test fluorinated co-solvent ratio sweep (5% vs 15% vs 25%)",
        notes: "Isolate desolvation energy vs. viscosity penalty at -30 °C.",
        tags: ["electrolyte", "impedance"],
        status: "exploring",
      },
    },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-task1-${stamp}`,
    baseRevision: project.revision,
    op: "upsert_task",
    payload: {
      task: {
        id: "task:sample-triage",
        title: "Classify Study A vs Study B electrolyte confound",
        stage: "literature",
        status: "in-progress",
        priority: "high",
        linkedNodeIds: ["contradiction:sample-rate-limit"],
      },
    },
  });
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-task2-${stamp}`,
    baseRevision: project.revision,
    op: "upsert_task",
    payload: {
      task: {
        id: "task:sample-stats",
        title: "Run Welch t-test on data/arrhenius_eis.csv",
        stage: "validation",
        status: "todo",
        priority: "medium",
        linkedFilePath: "data/arrhenius_eis.csv",
      },
    },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-result-${stamp}`,
    baseRevision: project.revision,
    op: "import_result",
    payload: {
      experimentId: "exp:sample-arrhenius",
      observations: "Simulated Arrhenius sweep recorded 35.4% capacity loss at -20 °C (R_ct ratio 11.7x at Ea = 40 kJ/mol), within frozen acceptance bounds.",
      metricResults: [
        { metric: "Capacity loss at -20 °C", expected: "<= 38% loss vs. 25 °C baseline", observed: "35.4% loss", verdict: "supports" },
        { metric: "R_ct ratio (-20 °C / 25 °C)", expected: "<= 14x", observed: "11.7x", verdict: "supports" },
      ],
      datasetName: "arrhenius_subzero_sim.json",
      sourceModality: "computational",
      result: { id: "result:sample-arrhenius", title: "Illustrative Simulation Result (35.4% loss)" },
    },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-msg-${stamp}`,
    baseRevision: project.revision,
    op: "append_message",
    payload: {
      role: "assistant",
      stage: "sample-walkthrough",
      content:
        "Illustrative sample investigation loaded (no external API key used). Compare the two conflicting abstracts side-by-side below, triage whether they truly disagree or tested different electrolytes, click any node in the Knowledge Graph to jump straight to its highlighted passage, or run the local computational model in Validation.",
    },
  });

  const manuscript = await draftManuscriptFromProject(project);
  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-manuscript-${stamp}`,
    baseRevision: project.revision,
    op: "set_manuscript",
    payload: { manuscript },
  });

  project = await executeResearchCommand(root, {
    projectId: project.projectId,
    commandId: `sample-ready-${stamp}`,
    baseRevision: project.revision,
    op: "set_status",
    payload: { status: "ready", message: "Illustrative sample walkthrough ready" },
  });

  await ensureWorkspaceScaffold(root, project.projectId, project);
  const csvSample = [
    "temp_c,baseline_rct_ohm,fluorinated_rct_ohm,baseline_cap_pct,fluorinated_cap_pct",
    "25,18.2,17.9,99.5,99.6",
    "10,49.4,34.1,91.2,95.4",
    "0,118.5,63.8,80.4,89.1",
    "-10,295.0,121.4,64.8,81.7",
    "-20,760.3,209.6,41.2,64.6",
    "-30,1840.0,398.0,22.5,52.3",
  ].join("\n") + "\n";
  await writeWorkspaceFile(root, project.projectId, "data/arrhenius_eis.csv", csvSample);
  await writeWorkspaceFile(
    root,
    project.projectId,
    "scripts/arrhenius_subzero.mjs",
    project.nodes.find((n) => n.id === "exp:sample-arrhenius")?.data?.codeExperiment?.code || "",
  );
  const svgChart = generatePublicationSvgChart({
    kind: "line",
    title: "Sub-Zero Capacity Retention: Baseline vs. Fluorinated Co-Solvent",
    xLabel: "Temperature (°C)",
    yLabel: "1C Capacity Retention (%)",
    labels: ["25 °C", "10 °C", "0 °C", "-10 °C", "-20 °C", "-30 °C"],
    values: [99.6, 95.4, 89.1, 81.7, 64.6, 52.3],
    secondaryValues: [99.5, 91.2, 80.4, 64.8, 41.2, 22.5],
    primaryName: "Fluorinated",
    secondaryName: "Baseline",
  });
  await writeWorkspaceFile(root, project.projectId, "figures/arrhenius_impedance.svg", svgChart);
  const sampleNotebook = [
    "# Sub-Zero Sodium-Ion Capacity Loss — Lab Notebook",
    "",
    "## Charge-Transfer Activation Model",
    "",
    "$$R_{ct}(T) = R_0 \\exp\\left(\\frac{E_a}{RT}\\right)$$",
    "",
    "- Diglyme desolvation bottleneck reported at $E_a = 62\\text{ kJ/mol}$ [@takahashi2025interfacial].",
    "- Carbonate ester SEI resistance growth contributes $>70\\%$ below $-20\\,^{\\circ}\\text{C}$ [@nair2025sei].",
    "",
    "## Linked Artifacts",
    "",
    "- Primary paper: [[paper:sample-desolvation]]",
    "- Rival paper: [[paper:sample-sei]]",
    "- Screening notes: [[notes/research-plan.md]]",
    "",
    "## Validation Plot",
    "",
    "![Sub-Zero Capacity Retention](figures/arrhenius_impedance.svg)",
    "",
  ].join("\n");
  await writeWorkspaceFile(root, project.projectId, "notes/lab-notebook.md", sampleNotebook);

  return project;
}
