import * as ss from "simple-statistics";

function splitCsvRow(row) {
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
}

export function parseCsvTable(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return { columns: lines[0] ? splitCsvRow(lines[0]) : [], rows: [], rowCount: 0, numericColumns: {}, summaries: [] };
  }
  const columns = splitCsvRow(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvRow(line);
    while (cells.length < columns.length) cells.push("");
    return cells.slice(0, columns.length);
  });

  const numericColumns = {};
  const summaries = [];
  columns.forEach((col, idx) => {
    const nums = rows.map((r) => Number(r[idx])).filter((n) => Number.isFinite(n));
    if (nums.length >= Math.max(2, Math.floor(rows.length * 0.5))) {
      numericColumns[col] = nums;
      const m = ss.mean(nums);
      const sd = nums.length > 1 ? ss.sampleStandardDeviation(nums) : 0;
      const med = ss.median(nums);
      const iqr = ss.interquartileRange(nums);
      summaries.push({
        column: col,
        n: nums.length,
        mean: m,
        sd,
        median: med,
        iqr,
        min: ss.min(nums),
        max: ss.max(nums),
      });
    }
  });

  return { columns, rows, rowCount: rows.length, numericColumns, summaries };
}

// Log-gamma approximation (Lanczos) + regularized incomplete beta function I_x(a, b) for exact two-tailed Student t p-values
function logGamma(z) {
  const coef = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < coef.length; j += 1) {
    y += 1;
    ser += coef[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betacf(a, b, x) {
  const MAXIT = 120;
  const EPS = 3e-10;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function twoTailedTTestPValue(absT, df) {
  if (!Number.isFinite(absT) || df <= 0) return 1;
  if (absT === 0) return 1;
  const x = df / (df + absT * absT);
  return Math.min(1, Math.max(0, regularizedIncompleteBeta(x, df / 2, 0.5)));
}

// Acklam inverse normal CDF (standard normal z for tail probability p in (0, 1))
function inverseNormalCdf(p) {
  if (p <= 0 || p >= 1) throw new Error("Probability must be strictly between 0 and 1");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// Bisection for Student t critical value for 95% two-tailed confidence interval
function criticalT95(df) {
  let lo = 1.5;
  let hi = 13.0;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    const p = twoTailedTTestPValue(mid, df);
    if (p > 0.05) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function runWelchTTest(groupAInput, groupBInput) {
  const a = (groupAInput || []).map(Number).filter(Number.isFinite);
  const b = (groupBInput || []).map(Number).filter(Number.isFinite);
  if (a.length < 2 || b.length < 2) {
    throw new Error("Welch's t-test requires at least 2 numeric observations in each group");
  }
  const meanA = ss.mean(a);
  const meanB = ss.mean(b);
  const varA = ss.sampleVariance(a);
  const varB = ss.sampleVariance(b);
  const sdA = Math.sqrt(varA);
  const sdB = Math.sqrt(varB);
  const seSq = varA / a.length + varB / b.length;
  const se = Math.sqrt(seSq);
  const meanDiff = meanA - meanB;
  const tStat = se === 0 ? 0 : meanDiff / se;

  const num = seSq * seSq;
  const den = (varA / a.length) ** 2 / (a.length - 1) + (varB / b.length) ** 2 / (b.length - 1);
  const df = den > 0 ? num / den : a.length + b.length - 2;
  const pValue = se === 0 ? 1 : twoTailedTTestPValue(Math.abs(tStat), df);

  const pooledSd = Math.sqrt(((a.length - 1) * varA + (b.length - 1) * varB) / (a.length + b.length - 2));
  const cohensD = pooledSd === 0 ? 0 : meanDiff / pooledSd;
  const crit = criticalT95(Math.max(1, df));
  const ci95 = [meanDiff - crit * se, meanDiff + crit * se];

  return {
    nA: a.length,
    nB: b.length,
    meanA,
    meanB,
    sdA,
    sdB,
    meanDiff,
    tStat,
    df,
    pValue,
    cohensD,
    ci95,
    significantAt05: pValue < 0.05,
    summary: `Welch t(${df.toFixed(1)}) = ${tStat.toFixed(3)}, p = ${pValue < 0.0001 ? pValue.toExponential(2) : pValue.toFixed(4)}, Cohen's d = ${cohensD.toFixed(3)}`,
  };
}

export function runCorrelationAnalysis(xsInput, ysInput) {
  const pairs = [];
  const len = Math.min(xsInput?.length || 0, ysInput?.length || 0);
  for (let i = 0; i < len; i += 1) {
    const x = Number(xsInput[i]);
    const y = Number(ysInput[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) pairs.push([x, y]);
  }
  if (pairs.length < 3) throw new Error("Correlation analysis requires at least 3 paired numeric observations");
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const r = ss.sampleCorrelation(xs, ys);
  const reg = ss.linearRegression(pairs);
  const rSquared = r * r;
  const df = pairs.length - 2;
  const tStat = Math.abs(r) >= 0.999999 ? 1e6 : r * Math.sqrt(df / (1 - rSquared));
  const pValue = Math.abs(r) >= 0.999999 ? 0 : twoTailedTTestPValue(Math.abs(tStat), df);
  return {
    n: pairs.length,
    r,
    rSquared,
    slope: reg.m,
    intercept: reg.b,
    tStat,
    df,
    pValue,
    summary: `Pearson r = ${r.toFixed(4)} (R² = ${rSquared.toFixed(4)}), p = ${pValue < 0.0001 ? pValue.toExponential(2) : pValue.toFixed(4)}, y = ${reg.m.toFixed(3)}x + ${reg.b.toFixed(3)}`,
  };
}

export function calculateSampleSizePower({ effectSizeD, alpha = 0.05, power = 0.8 }) {
  const d = Number(effectSizeD);
  const a = Number(alpha);
  const p = Number(power);
  if (!Number.isFinite(d) || d <= 0) throw new Error("Effect size Cohen's d must be > 0");
  if (!Number.isFinite(a) || a <= 0 || a >= 0.5) throw new Error("Alpha must be between 0 and 0.5");
  if (!Number.isFinite(p) || p <= 0.5 || p >= 0.9999) throw new Error("Power must be between 0.5 and 0.9999");
  const zAlpha = inverseNormalCdf(1 - a / 2);
  const zBeta = inverseNormalCdf(p);
  const perGroupN = Math.ceil((2 * Math.pow(zAlpha + zBeta, 2)) / (d * d));
  return {
    effectSizeD: d,
    alpha: a,
    power: p,
    perGroupN,
    totalN: perGroupN * 2,
    formula: "n/group = ceil(2 * (z_{1-a/2} + z_{power})^2 / d^2)",
  };
}

const escSvg = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

export function generatePublicationSvgChart({
  kind = "bar",
  title = "Experimental Measurement",
  xLabel = "Condition",
  yLabel = "Value",
  labels = [],
  values = [],
  errors = [],
  xValues = [],
  yValues = [],
  secondaryValues = [],
  primaryName = "Measured",
  secondaryName = "Comparison",
}) {
  const W = 720;
  const H = 400;
  const m = { top: 58, right: 28, bottom: 64, left: 74 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  let bodySvg = "";
  let footerNote = "";

  if (kind === "scatter") {
    const pts = [];
    for (let i = 0; i < Math.min(xValues.length, yValues.length); i += 1) {
      const x = Number(xValues[i]);
      const y = Number(yValues[i]);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
    }
    if (!pts.length) throw new Error("Scatter plot needs at least one numeric (x, y) point");
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    let xMin = Math.min(...xs);
    let xMax = Math.max(...xs);
    if (xMin === xMax) { xMin -= 1; xMax += 1; }
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);
    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    const xPad = (xMax - xMin) * 0.08;
    const yPad = (yMax - yMin) * 0.1;
    xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;
    const sx = (x) => m.left + ((x - xMin) / (xMax - xMin)) * pw;
    const sy = (y) => m.top + ph - ((y - yMin) / (yMax - yMin)) * ph;

    for (let i = 0; i <= 4; i += 1) {
      const yVal = yMin + (i / 4) * (yMax - yMin);
      const yy = sy(yVal);
      bodySvg += `<line x1="${m.left}" y1="${yy.toFixed(1)}" x2="${W - m.right}" y2="${yy.toFixed(1)}" stroke="#e6e6e2" stroke-dasharray="3 3" />`;
      bodySvg += `<text x="${m.left - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#525760">${yVal.toFixed(1)}</text>`;
    }
    for (let i = 0; i <= 4; i += 1) {
      const xVal = xMin + (i / 4) * (xMax - xMin);
      const xx = sx(xVal);
      bodySvg += `<text x="${xx.toFixed(1)}" y="${m.top + ph + 18}" text-anchor="middle" font-size="11" fill="#525760">${xVal.toFixed(1)}</text>`;
    }
    if (pts.length >= 2) {
      const corr = pts.length >= 3 ? runCorrelationAnalysis(xs, ys) : { rSquared: null, slope: ss.linearRegression(pts).m, intercept: ss.linearRegression(pts).b };
      const y1 = corr.slope * xMin + corr.intercept;
      const y2 = corr.slope * xMax + corr.intercept;
      bodySvg += `<line x1="${sx(xMin).toFixed(1)}" y1="${sy(y1).toFixed(1)}" x2="${sx(xMax).toFixed(1)}" y2="${sy(y2).toFixed(1)}" stroke="#92400e" stroke-width="1.8" stroke-dasharray="5 4" />`;
      if (corr.rSquared !== null) footerNote = `Linear fit · R² = ${corr.rSquared.toFixed(3)}`;
    }
    for (const [x, y] of pts) {
      bodySvg += `<circle cx="${sx(x).toFixed(1)}" cy="${sy(y).toFixed(1)}" r="4.8" fill="#1e4fc2" fill-opacity="0.88" stroke="#ffffff" stroke-width="1.2" />`;
    }
  } else {
    const vals = (values || []).map(Number);
    const secVals = (secondaryValues || []).map(Number);
    const hasSec = secVals.length === vals.length && secVals.some(Number.isFinite);
    const allNums = [...vals, ...(hasSec ? secVals : []), ...(errors || []).map((e, i) => (vals[i] || 0) + (Number(e) || 0))].filter(Number.isFinite);
    if (!allNums.length) throw new Error("Chart needs numeric data values");
    const yMin = kind === "bar" ? Math.min(0, ...allNums) : Math.min(...allNums) * 0.92;
    let yMax = Math.max(...allNums) * 1.12;
    if (yMax <= yMin) yMax = yMin + 1;
    const sy = (v) => m.top + ph - ((v - yMin) / (yMax - yMin)) * ph;

    for (let i = 0; i <= 4; i += 1) {
      const yVal = yMin + (i / 4) * (yMax - yMin);
      const yy = sy(yVal);
      bodySvg += `<line x1="${m.left}" y1="${yy.toFixed(1)}" x2="${W - m.right}" y2="${yy.toFixed(1)}" stroke="#e6e6e2" stroke-dasharray="3 3" />`;
      bodySvg += `<text x="${m.left - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#525760">${yVal.toFixed(1)}</text>`;
    }

    const n = vals.length;
    if (kind === "line") {
      const stepX = n > 1 ? pw / (n - 1) : pw / 2;
      const pts1 = vals.map((v, i) => `${(m.left + i * stepX).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
      bodySvg += `<polyline fill="none" stroke="#1e4fc2" stroke-width="2.4" points="${pts1}" />`;
      if (hasSec) {
        const pts2 = secVals.map((v, i) => `${(m.left + i * stepX).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
        bodySvg += `<polyline fill="none" stroke="#92400e" stroke-width="2.2" stroke-dasharray="5 3" points="${pts2}" />`;
      }
      vals.forEach((v, i) => {
        const cx = m.left + i * stepX;
        bodySvg += `<circle cx="${cx.toFixed(1)}" cy="${sy(v).toFixed(1)}" r="4.2" fill="#1e4fc2" stroke="#ffffff" stroke-width="1.2" />`;
        if (hasSec) bodySvg += `<circle cx="${cx.toFixed(1)}" cy="${sy(secVals[i]).toFixed(1)}" r="4" fill="#92400e" stroke="#ffffff" stroke-width="1.2" />`;
        const lbl = labels[i] ?? `${i + 1}`;
        bodySvg += `<text x="${cx.toFixed(1)}" y="${m.top + ph + 18}" text-anchor="middle" font-size="11" fill="#525760">${escSvg(String(lbl).slice(0, 14))}</text>`;
      });
    } else {
      const slot = pw / Math.max(1, n);
      const barW = Math.min(hasSec ? 26 : 44, slot * (hasSec ? 0.36 : 0.56));
      vals.forEach((v, i) => {
        const cx = m.left + slot * (i + 0.5);
        const y0 = sy(0);
        const yv = sy(v);
        const bx = hasSec ? cx - barW - 2 : cx - barW / 2;
        const bh = Math.max(2, Math.abs(y0 - yv));
        bodySvg += `<rect x="${bx.toFixed(1)}" y="${Math.min(y0, yv).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="#1e4fc2" />`;
        const err = Number(errors[i]);
        if (Number.isFinite(err) && err > 0) {
          const ex = bx + barW / 2;
          const ey1 = sy(v + err);
          const ey2 = sy(v - err);
          bodySvg += `<line x1="${ex.toFixed(1)}" y1="${ey1.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey2.toFixed(1)}" stroke="#111315" stroke-width="1.4" />`;
          bodySvg += `<line x1="${(ex - 5).toFixed(1)}" y1="${ey1.toFixed(1)}" x2="${(ex + 5).toFixed(1)}" y2="${ey1.toFixed(1)}" stroke="#111315" stroke-width="1.4" />`;
          bodySvg += `<line x1="${(ex - 5).toFixed(1)}" y1="${ey2.toFixed(1)}" x2="${(ex + 5).toFixed(1)}" y2="${ey2.toFixed(1)}" stroke="#111315" stroke-width="1.4" />`;
        }
        if (hasSec) {
          const sv = secVals[i];
          const syv = sy(sv);
          const sx2 = cx + 2;
          const sh2 = Math.max(2, Math.abs(y0 - syv));
          bodySvg += `<rect x="${sx2.toFixed(1)}" y="${Math.min(y0, syv).toFixed(1)}" width="${barW.toFixed(1)}" height="${sh2.toFixed(1)}" rx="3" fill="#92400e" />`;
        }
        const lbl = labels[i] ?? `G${i + 1}`;
        bodySvg += `<text x="${cx.toFixed(1)}" y="${m.top + ph + 18}" text-anchor="middle" font-size="11" fill="#525760">${escSvg(String(lbl).slice(0, 14))}</text>`;
      });
    }
    if (hasSec) {
      footerNote = `${primaryName} (blue) vs. ${secondaryName} (amber)`;
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, -apple-system, sans-serif">`,
    `<rect width="${W}" height="${H}" rx="12" fill="#ffffff" stroke="#e6e6e2" />`,
    `<text x="${m.left}" y="30" font-size="15" font-weight="600" fill="#111315">${escSvg(title)}</text>`,
    footerNote ? `<text x="${W - m.right}" y="30" text-anchor="end" font-size="11.5" fill="#525760">${escSvg(footerNote)}</text>` : "",
    `<line x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${m.top + ph}" stroke="#111315" stroke-width="1.2" />`,
    `<line x1="${m.left}" y1="${m.top + ph}" x2="${W - m.right}" y2="${m.top + ph}" stroke="#111315" stroke-width="1.2" />`,
    bodySvg,
    `<text x="${(m.left + pw / 2).toFixed(1)}" y="${H - 16}" text-anchor="middle" font-size="12" font-weight="500" fill="#525760">${escSvg(xLabel)}</text>`,
    `<text x="18" y="${(m.top + ph / 2).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="500" fill="#525760" transform="rotate(-90 18 ${(m.top + ph / 2).toFixed(1)})">${escSvg(yLabel)}</text>`,
    `</svg>`,
  ].filter(Boolean).join("\n");
}
