import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function buildColabNotebook(project, experiment) {
  const codeSpec = experiment?.data?.codeExperiment || {};
  const language = codeSpec.language || "python";
  const dependencies = Array.isArray(codeSpec.dependencies) ? codeSpec.dependencies : [];
  const code = String(codeSpec.code || "# Add your computational experiment implementation here\nprint('Ready to run experiment')\n");
  const outcomes = Array.isArray(experiment?.data?.expectedOutcomes) ? experiment.data.expectedOutcomes : [];

  const cells = [
    {
      cell_type: "markdown",
      metadata: {},
      source: [
        `# ${experiment.title || project.title}\n`,
        `\n`,
        `**Investigation:** ${project.curiosity}\n\n`,
        `**Objective:** ${experiment.data?.objective || "Test the frozen hypothesis and capture observed measurements."}\n\n`,
        `## Frozen Expected Outcomes (Do Not Modify Before Running)\n`,
        ...(outcomes.length
          ? outcomes.map((o) => `- **${o.metric}:** ${o.prediction}${o.rationale ? ` _(${o.rationale})_` : ""}\n`)
          : ["- No expected outcomes recorded.\n"]),
      ],
    },
  ];

  if (language === "python" && dependencies.length > 0) {
    cells.push({
      cell_type: "code",
      execution_count: null,
      metadata: {},
      outputs: [],
      source: [`!pip install -q ${dependencies.join(" ")}\n`],
    });
  }

  cells.push({
    cell_type: "code",
    execution_count: null,
    metadata: {},
    outputs: [],
    source: code.split("\n").map((line, i, arr) => (i < arr.length - 1 ? `${line}\n` : line)),
  });

  cells.push({
    cell_type: "markdown",
    metadata: {},
    source: [
      "## Capture Results\n",
      "Copy the printed metrics or exported CSV/JSON back into **Open Research IDE → Validation & Testing → Import Observed Results**. Predictions remain frozen and separate from observations.\n",
    ],
  });

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      colab: { provenance: [], name: `${(codeSpec.filename || "experiment").replace(/\.[^.]+$/, "")}.ipynb` },
      kernelspec: { display_name: "Python 3", name: "python3" },
      language_info: { name: language },
    },
    cells,
  };
}

export function buildSurveySchema(project, experiment) {
  const survey = experiment?.data?.surveyDesign || {};
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  return {
    schema: "open-research-ide/survey-v1",
    title: experiment.title || project.title,
    investigation: project.curiosity,
    targetPopulation: survey.targetPopulation || "General adult participants",
    targetSampleSize: survey.targetSampleSize || 100,
    estimatedMinutes: survey.estimatedMinutes || 5,
    distributionChannels: Array.isArray(survey.distributionChannels) ? survey.distributionChannels : [
      { name: "University cohorts & open communities", tier: "free", estimatedCost: "$0", notes: "Good for pilot calibration; report self-selection bias." },
      { name: "Prolific", tier: "paid", estimatedCost: "~$12/hr pro-rated + platform fee", notes: "High attention-check compliance and demographic prescreening." },
      { name: "CloudResearch Connect", tier: "paid", estimatedCost: "~$10–$12/hr pro-rated", notes: "Vetted participant pool for behavioral & survey studies." },
    ],
    questions,
  };
}

export function buildSurveyCsvTemplate(experiment) {
  const survey = experiment?.data?.surveyDesign || {};
  const questions = Array.isArray(survey.questions) ? survey.questions : [];
  const headers = ["participant_id", "submitted_at", ...questions.map((q, i) => q.id || `q${i + 1}`)];
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  return `${headers.map(escape).join(",")}\n`;
}

export function parseCsvSummary(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { rowCount: 0, columns: [], preview: "" };
  const splitRow = (row) => {
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') { current += '"'; i += 1; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        out.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };
  const columns = splitRow(lines[0]);
  const rows = lines.slice(1).map(splitRow);
  const numericStats = [];
  columns.forEach((col, idx) => {
    const nums = rows.map((r) => Number(r[idx])).filter((n) => Number.isFinite(n));
    if (nums.length >= Math.max(2, Math.floor(rows.length * 0.6))) {
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      numericStats.push(`${col}: n=${nums.length}, mean=${mean.toFixed(3)}, range=[${min}, ${max}]`);
    }
  });
  return {
    rowCount: rows.length,
    columns,
    preview: `${rows.length} rows across ${columns.length} columns (${columns.slice(0, 8).join(", ")}).${numericStats.length ? `\nNumeric summary:\n- ${numericStats.join("\n- ")}` : ""}`,
  };
}

function execAsync(cmd, args, options) {
  return new Promise((resolve) => {
    const started = Date.now();
    execFile(cmd, args, { ...options, maxBuffer: 512 * 1024, encoding: "utf8" }, (error, stdout, stderr) => {
      const exitCode = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      const errText = error && typeof error.code !== "number" ? `${stderr || ""}\n${error.message}`.trim() : (stderr || "");
      resolve({
        ranAt: new Date().toISOString(),
        exitCode,
        stdout: String(stdout || "").slice(0, 16000),
        stderr: String(errText).slice(0, 8000),
        durationMs: Date.now() - started,
      });
    });
  });
}

export async function runExperimentCodeLocally(root, projectId, experiment, codeOverride) {
  const codeSpec = experiment?.data?.codeExperiment;
  if (!codeSpec && !codeOverride) throw new Error("No computational experiment code is defined");
  const language = codeSpec?.language || "python";
  if (!["python", "javascript"].includes(language)) {
    throw new Error(`Local sandbox execution currently supports Python and JavaScript (got ${language}). Export to Google Colab or run locally via CLI.`);
  }
  const code = String(codeOverride ?? codeSpec?.code ?? "");
  if (!code.trim()) throw new Error("Experiment code is empty");
  const safeProj = String(projectId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExp = String(experiment.id || "exp").replace(/[^a-zA-Z0-9_-]/g, "_");
  const runDir = path.join(root, "workspace", "runs", safeProj, safeExp);
  await mkdir(runDir, { recursive: true });

  const filename = language === "javascript" ? "experiment.mjs" : "experiment.py";
  const scriptPath = path.join(runDir, filename);
  await writeFile(scriptPath, code, "utf8");

  if (language === "javascript") {
    return execAsync(process.execPath, [scriptPath], { cwd: runDir, timeout: 15000 });
  }
  const pyCmd = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  return execAsync(pyCmd, [scriptPath], { cwd: runDir, timeout: 15000 });
}
