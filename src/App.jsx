import { useState, useMemo } from "react";

const C = {
  navy:       "#1B2A4A",
  navy2:      "#253D6B",
  gold:       "#C8A84B",
  goldLight:  "#F5E9C0",
  offWhite:   "#F8F6F0",
  lightGray:  "#E8E4DC",
  gray:       "#6B7280",
  green:      "#2E6B3E",
  greenLight: "#D4EDDA",
  red:        "#B82424",
  redLight:   "#FDEAEA",
  amber:      "#C77B0D",
  amberLight: "#FEF3DC",
  white:      "#FFFFFF",
  htext:      "#8BA0C0",
};

const RATIOS = [
  { key: "currentRatio",    label: "Current Ratio",            formula: "Current Assets ÷ Current Liabilities",       section: "Liquidity",    hint: "Pull from balance sheet. Current assets divided by current liabilities.",                                       green: { label: "> 2.0",    fn: v => v > 2.0 },   amber: { label: "1.2 – 2.0", fn: v => v >= 1.2 && v <= 2.0 }, red: { label: "< 1.2",    fn: v => v < 1.2 },   meaning: "Short-term liquidity. Below 1.0 means liabilities exceed assets." },
  { key: "quickRatio",      label: "Quick Ratio",              formula: "(Cash + Receivables) ÷ Current Liabilities", section: "Liquidity",    hint: "Excludes inventory. More conservative than current ratio.",                                                     green: { label: "> 1.0",    fn: v => v > 1.0 },   amber: { label: "0.7 – 1.0", fn: v => v >= 0.7 && v <= 1.0 }, red: { label: "< 0.7",    fn: v => v < 0.7 },   meaning: "Stricter liquidity test excluding inventory." },
  { key: "debtToEquity",    label: "Debt-to-Equity",           formula: "Total Debt ÷ Total Equity",                  section: "Leverage",     hint: "Total interest-bearing debt divided by total shareholders equity.",                                             green: { label: "< 1.0",    fn: v => v < 1.0 },   amber: { label: "1.0 – 2.5", fn: v => v >= 1.0 && v <= 2.5 }, red: { label: "> 2.5",    fn: v => v > 2.5 },   meaning: "High leverage amplifies stress. Above 3.0 is concerning." },
  { key: "interestCoverage",label: "Interest Coverage",        formula: "EBIT ÷ Interest Expense",                    section: "Leverage",     hint: "Earnings before interest and taxes divided by annual interest expense.",                                        green: { label: "> 3.0x",   fn: v => v > 3.0 },   amber: { label: "1.5 – 3.0x",fn: v => v >= 1.5 && v <= 3.0 }, red: { label: "< 1.5x",   fn: v => v < 1.5 },   meaning: "Ability to service debt from operating profit. Below 1.0 is critical." },
  { key: "ebitdaMargin",    label: "EBITDA Margin",            formula: "EBITDA ÷ Revenue × 100",                     section: "Profitability", hint: "Enter as a percentage. e.g. enter 12 for 12%.", isPercent: true,                                              green: { label: "> 10%",    fn: v => v > 10 },    amber: { label: "5 – 10%",   fn: v => v >= 5 && v <= 10 },   red: { label: "< 5%",     fn: v => v < 5 },     meaning: "Operating profitability. Low margin leaves little cushion for shocks." },
  { key: "fcfMargin",       label: "Free Cash Flow Margin",    formula: "Free Cash Flow ÷ Revenue × 100",             section: "Profitability", hint: "FCF = Cash from Operations minus Capex. Enter as a percentage. Can be negative.", isPercent: true, canBeNeg: true, green: { label: "> 5%",    fn: v => v > 5 },     amber: { label: "1 – 5%",    fn: v => v >= 1 && v <= 5 },    red: { label: "< 1%",     fn: v => v < 1 },     meaning: "Cash available after maintaining operations. Negative signals cash burn." },
  { key: "dpo",             label: "Days Payable Outstanding", formula: "(Accounts Payable ÷ COGS) × 365",            section: "Efficiency",   hint: "How many days the supplier takes to pay their own suppliers. Rising DPO signals cash pressure. Enter prior year value if available.", hasPrior: true, green: { label: "Stable",   fn: (v,p) => p !== null ? Math.abs(v-p) <= 10 : v <= 50 }, amber: { label: "Rising 10–20 days", fn: (v,p) => p !== null ? (v-p) > 10 && (v-p) <= 20 : v > 50 && v <= 75 }, red: { label: "> 20 day increase or > 90 days", fn: (v,p) => p !== null ? (v-p) > 20 : v > 75 }, meaning: "Stretching payables is a key distress signal." },
];

const Z_COMPONENTS = [
  { key: "x1", label: "X1", desc: "Working Capital / Total Assets",    formula: "(Current Assets - Current Liabilities) / Total Assets", coefficient: 0.717, hint: "Working capital divided by total assets. e.g. $880K / $18.6M = 0.047" },
  { key: "x2", label: "X2", desc: "Retained Earnings / Total Assets",  formula: "Retained Earnings / Total Assets",                      coefficient: 0.847, hint: "Cumulative retained earnings from balance sheet divided by total assets." },
  { key: "x3", label: "X3", desc: "EBIT / Total Assets",               formula: "EBIT / Total Assets",                                   coefficient: 3.107, hint: "Earnings before interest and taxes divided by total assets. Highest-weighted variable." },
  { key: "x4", label: "X4", desc: "Book Equity / Total Liabilities",   formula: "Book Value of Equity / Total Liabilities",              coefficient: 0.420, hint: "Total shareholders equity divided by total liabilities." },
  { key: "x5", label: "X5", desc: "Revenue / Total Assets",            formula: "Revenue / Total Assets",                                coefficient: 0.998, hint: "Annual revenue divided by total assets." },
];

function getRag(ratio, value, priorValue) {
  if (value === "" || value === null || isNaN(Number(value))) return null;
  const v = Number(value);
  const prev = priorValue !== "" && priorValue !== null && !isNaN(Number(priorValue)) ? Number(priorValue) : null;
  if (ratio.red.fn(v, prev)) return "red";
  if (ratio.amber.fn(v, prev)) return "amber";
  if (ratio.green.fn(v, prev)) return "green";
  return null;
}

const RAG = {
  green: { bg: "#D4EDDA", border: "#2E6B3E", text: "#2E6B3E", label: "GREEN" },
  amber: { bg: "#FEF3DC", border: "#C77B0D", text: "#C77B0D", label: "AMBER" },
  red:   { bg: "#FDEAEA", border: "#B82424", text: "#B82424", label: "RED"   },
};

function RagBadge({ rag }) {
  if (!rag) return <span style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif" }}>Not entered</span>;
  const col = RAG[rag];
  return <span style={{ background: col.bg, border: `1.5px solid ${col.border}`, color: col.text, borderRadius: 3, padding: "2px 8px", fontSize: 10, fontWeight: "bold", fontFamily: "sans-serif", letterSpacing: 1 }}>{col.label}</span>;
}

function getZone(z) {
  if (z > 2.9)  return { label: "SAFE ZONE",     color: C.green, bg: C.greenLight, border: C.green };
  if (z >= 1.23) return { label: "GREY ZONE",    color: C.amber, bg: C.amberLight, border: C.amber };
  return               { label: "DISTRESS ZONE", color: C.red,   bg: C.redLight,   border: C.red   };
}

function getOverallRating(rags, zScore) {
  const scored = rags.filter(r => r !== null);
  if (scored.length === 0) return null;
  const reds = rags.filter(r => r === "red").length;
  const ambers = rags.filter(r => r === "amber").length;
  if (reds >= 3) return "red";
  if (reds >= 1 && zScore !== null && zScore < 1.23) return "red";
  if (reds >= 2 || ambers >= 3) return "amber";
  if (reds === 1) return "amber";
  return "green";
}

const OVERALL = {
  green: { label: "HEALTHY",         sub: "No significant financial concerns identified.",          action: "Maintain standard monitoring cadence." },
  amber: { label: "MONITOR CLOSELY", sub: "Some indicators warrant closer attention.",              action: "Increase monitoring frequency. Request updated financials. Review contingency plan." },
  red:   { label: "ACTIVE RISK",     sub: "Multiple distress signals present.",                     action: "Escalate to leadership. Accelerate backup qualification. Build safety stock. Initiate direct commercial conversation." },
};

const sections = [...new Set(RATIOS.map(r => r.section))];

export default function SupplierFinancialHealth() {
  const [supplierName, setSupplierName] = useState("");
  const [ratioVals, setRatioVals] = useState({});
  const [priorVals, setPriorVals] = useState({});
  const [zInputs, setZInputs] = useState({});
  const [openHint, setOpenHint] = useState(null);
  const [activeTab, setActiveTab] = useState("ratios");

  const rags = RATIOS.map(r => getRag(r, ratioVals[r.key] ?? "", priorVals[r.key] ?? ""));

  const zScore = useMemo(() => {
    const vals = Z_COMPONENTS.map(c => { const v = parseFloat(zInputs[c.key]); return isNaN(v) ? null : v; });
    if (vals.some(v => v === null)) return null;
    return vals.reduce((sum, v, i) => sum + v * Z_COMPONENTS[i].coefficient, 0);
  }, [zInputs]);

  const overallRating = getOverallRating(rags, zScore);
  const hasAnyData = Object.values(ratioVals).some(v => v !== "" && v !== undefined);
  const zEntered = Z_COMPONENTS.some(c => zInputs[c.key] !== undefined && zInputs[c.key] !== "");

  const reset = () => { setRatioVals({}); setPriorVals({}); setZInputs({}); setSupplierName(""); setActiveTab("ratios"); };

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: C.offWhite, minHeight: "100vh", color: C.navy }}>

      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `3px solid ${C.gold}`, padding: "16px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 18, fontWeight: "bold", color: C.white, letterSpacing: 1 }}>SUPPLIER FINANCIAL</span>
          <span style={{ fontSize: 10, color: C.gold, fontFamily: "sans-serif", letterSpacing: 2, fontWeight: "bold" }}>HEALTH SCORER</span>
        </div>
        <div style={{ fontSize: 10, color: C.htext, marginTop: 3, fontFamily: "sans-serif" }}>
          Matthew Flanagan, CPSM · Flanagan Sourcing Intelligence Portfolio
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.navy2, borderBottom: `2px solid ${C.gold}`, overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: "max-content" }}>
          {[{ key: "ratios", label: "1. Ratios" }, { key: "zscore", label: "2. Z-Score" }, { key: "results", label: "3. Assessment" }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              background: activeTab === tab.key ? C.gold : "transparent",
              color: activeTab === tab.key ? C.navy : C.htext,
              border: "none", padding: "10px 18px", fontSize: 12,
              fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 1,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 48px", maxWidth: 800, margin: "0 auto" }}>

        {/* Supplier name */}
        <Card title="Supplier Being Assessed" subtitle="Enter the supplier name for this assessment.">
          <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="e.g. Meridian Components" style={{ border: `1px solid ${C.lightGray}`, borderRadius: 4, padding: "8px 12px", fontSize: 14, fontFamily: "'Georgia', serif", color: C.navy, width: "100%", background: C.white, outline: "none", boxSizing: "border-box" }} />
        </Card>

        {/* ── RATIOS TAB ── */}
        {activeTab === "ratios" && (
          <div>
            <div style={{ background: C.navy2, border: `1px solid ${C.gold}`, borderRadius: 6, padding: "12px 14px", marginBottom: 16, fontSize: 12, color: C.htext, fontFamily: "sans-serif", lineHeight: 1.6 }}>
              Enter the ratios you have available. Not all fields are required. Click <strong style={{ color: C.gold }}>How to calculate</strong> for guidance.
            </div>

            {sections.map(section => (
              <Card key={section} title={section} subtitle={`${section} ratios`}>
                {RATIOS.filter(r => r.section === section).map((ratio, ridx, arr) => {
                  const rag = getRag(ratio, ratioVals[ratio.key] ?? "", priorVals[ratio.key] ?? "");
                  return (
                    <div key={ratio.key} style={{ marginBottom: ridx < arr.length - 1 ? 20 : 0, paddingBottom: ridx < arr.length - 1 ? 20 : 0, borderBottom: ridx < arr.length - 1 ? `1px solid ${C.lightGray}` : "none" }}>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: "bold", color: C.navy, fontFamily: "sans-serif" }}>{ratio.label}</div>
                          <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif", marginTop: 2 }}>{ratio.formula}</div>
                        </div>
                        <RagBadge rag={rag} />
                      </div>

                      <button onClick={() => setOpenHint(openHint === ratio.key ? null : ratio.key)} style={{ background: "none", border: `1px solid ${C.lightGray}`, borderRadius: 10, padding: "2px 10px", fontSize: 11, color: C.gray, fontFamily: "sans-serif", cursor: "pointer", marginBottom: 8 }}>
                        {openHint === ratio.key ? "Hide hint" : "How to calculate"}
                      </button>

                      {openHint === ratio.key && (
                        <div style={{ background: C.goldLight, border: `1px solid ${C.gold}`, borderRadius: 4, padding: "8px 12px", marginBottom: 10, fontSize: 12, fontFamily: "sans-serif", color: C.navy, lineHeight: 1.6 }}>
                          {ratio.hint}
                        </div>
                      )}

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif", marginBottom: 4 }}>
                            Current value{ratio.isPercent ? " (%)" : ""}
                          </div>
                          <input type="number" value={ratioVals[ratio.key] ?? ""} onChange={e => setRatioVals(p => ({ ...p, [ratio.key]: e.target.value }))} placeholder="Enter value" style={inputSt} />
                        </div>
                        {ratio.hasPrior && (
                          <div>
                            <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif", marginBottom: 4 }}>Prior year value (optional)</div>
                            <input type="number" value={priorVals[ratio.key] ?? ""} onChange={e => setPriorVals(p => ({ ...p, [ratio.key]: e.target.value }))} placeholder="Prior year" style={inputSt} />
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, fontFamily: "sans-serif" }}>
                          <span style={{ color: C.green }}>● {ratio.green.label}</span>
                          <span style={{ color: C.amber }}>● {ratio.amber.label}</span>
                          <span style={{ color: C.red }}>● {ratio.red.label}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif" }}>{ratio.meaning}</div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            ))}

            <button onClick={() => setActiveTab("zscore")} style={{ background: C.navy, color: C.white, border: `2px solid ${C.gold}`, borderRadius: 4, padding: "12px", fontSize: 13, fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 1, cursor: "pointer", width: "100%" }}>
              PROCEED TO Z-SCORE →
            </button>
          </div>
        )}

        {/* ── Z-SCORE TAB ── */}
        {activeTab === "zscore" && (
          <div>
            <div style={{ background: C.navy2, border: `1px solid ${C.gold}`, borderRadius: 6, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: "bold", color: C.gold, fontFamily: "sans-serif", marginBottom: 6 }}>ALTMAN Z'-SCORE (Private Company Model)</div>
              <div style={{ fontSize: 12, color: C.htext, fontFamily: "sans-serif", lineHeight: 1.6 }}>
                Enter each variable as a decimal ratio, not a percentage. For example, if working capital is $880K and total assets are $18.6M, enter 0.047. All five inputs are required to calculate the score.
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontFamily: "sans-serif", color: C.green, fontWeight: "bold" }}>● Safe: Z' &gt; 2.90</span>
                <span style={{ fontSize: 12, fontFamily: "sans-serif", color: C.amber, fontWeight: "bold" }}>● Grey: 1.23 – 2.90</span>
                <span style={{ fontSize: 12, fontFamily: "sans-serif", color: C.red,   fontWeight: "bold" }}>● Distress: &lt; 1.23</span>
              </div>
            </div>

            <Card title="Z'-Score Inputs" subtitle="Enter each variable as a decimal ratio.">
              {Z_COMPONENTS.map((comp, cidx) => (
                <div key={comp.key} style={{ marginBottom: cidx < Z_COMPONENTS.length - 1 ? 20 : 0, paddingBottom: cidx < Z_COMPONENTS.length - 1 ? 20 : 0, borderBottom: cidx < Z_COMPONENTS.length - 1 ? `1px solid ${C.lightGray}` : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: C.navy, fontFamily: "sans-serif" }}>{comp.label}: {comp.desc}</div>
                      <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif", marginTop: 2 }}>{comp.formula} · Coefficient: {comp.coefficient}</div>
                    </div>
                    {zInputs[comp.key] !== "" && zInputs[comp.key] !== undefined && !isNaN(Number(zInputs[comp.key])) && (
                      <div style={{ fontSize: 12, fontFamily: "sans-serif", color: C.navy, textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: C.gray }}>Weighted</div>
                        <strong>{(Number(zInputs[comp.key]) * comp.coefficient).toFixed(4)}</strong>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setOpenHint(openHint === comp.key ? null : comp.key)} style={{ background: "none", border: `1px solid ${C.lightGray}`, borderRadius: 10, padding: "2px 10px", fontSize: 11, color: C.gray, fontFamily: "sans-serif", cursor: "pointer", marginBottom: 8 }}>
                    {openHint === comp.key ? "Hide hint" : "How to calculate"}
                  </button>

                  {openHint === comp.key && (
                    <div style={{ background: C.goldLight, border: `1px solid ${C.gold}`, borderRadius: 4, padding: "8px 12px", marginBottom: 8, fontSize: 12, fontFamily: "sans-serif", color: C.navy }}>
                      {comp.hint}
                    </div>
                  )}

                  <input type="number" value={zInputs[comp.key] ?? ""} onChange={e => setZInputs(p => ({ ...p, [comp.key]: e.target.value }))} placeholder="e.g. 0.047" step="0.001" style={inputSt} />
                </div>
              ))}

              {zScore !== null && (
                <div style={{ background: getZone(zScore).bg, border: `2px solid ${getZone(zScore).border}`, borderRadius: 6, padding: "16px", marginTop: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: "sans-serif", fontWeight: "bold", color: getZone(zScore).color, letterSpacing: 1 }}>Z'-SCORE</div>
                    <div style={{ fontSize: 36, fontWeight: "bold", fontFamily: "sans-serif", color: getZone(zScore).color, lineHeight: 1 }}>{zScore.toFixed(3)}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: "bold", fontFamily: "sans-serif", color: getZone(zScore).color }}>{getZone(zScore).label}</div>
                    <div style={{ fontSize: 12, color: C.gray, fontFamily: "sans-serif", marginTop: 4, lineHeight: 1.5 }}>
                      {zScore > 2.9 ? "Low probability of financial distress." : zScore >= 1.23 ? "Elevated risk. Investigate further." : "High probability of distress. Immediate action warranted."}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <button onClick={() => setActiveTab("results")} style={{ background: C.navy, color: C.white, border: `2px solid ${C.gold}`, borderRadius: 4, padding: "12px", fontSize: 13, fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 1, cursor: "pointer", width: "100%" }}>
              VIEW FULL ASSESSMENT →
            </button>
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {activeTab === "results" && (
          <div>
            {!hasAnyData && !zEntered ? (
              <div style={{ textAlign: "center", padding: "40px", color: C.gray, fontFamily: "sans-serif", fontSize: 13, background: C.white, borderRadius: 6, border: `1px dashed ${C.lightGray}` }}>
                Enter ratio values or Z-Score inputs to see the assessment.
              </div>
            ) : (
              <>
                {/* Overall rating */}
                {overallRating && (
                  <div style={{ background: C.navy, border: `2px solid ${C.gold}`, borderRadius: 6, padding: "16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: C.gold, fontFamily: "sans-serif", fontWeight: "bold", letterSpacing: 2, marginBottom: 8 }}>
                      OVERALL ASSESSMENT{supplierName ? ` · ${supplierName}` : ""}
                    </div>
                    <div style={{ background: RAG[overallRating].bg, border: `2px solid ${RAG[overallRating].border}`, borderRadius: 6, padding: "10px 14px", marginBottom: 10 }}>
                      <div style={{ fontSize: 20, fontWeight: "bold", fontFamily: "sans-serif", color: RAG[overallRating].text }}>{OVERALL[overallRating].label}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.white, fontFamily: "sans-serif", marginBottom: 6 }}>{OVERALL[overallRating].sub}</div>
                    <div style={{ fontSize: 12, color: C.htext, fontFamily: "sans-serif" }}>
                      <strong style={{ color: C.gold }}>Recommended action:</strong> {OVERALL[overallRating].action}
                    </div>
                  </div>
                )}

                {/* RAG count */}
                <Card title="Risk Signal Summary" subtitle="Count of indicators by status">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["green", "amber", "red"].map(rag => {
                      const count = rags.filter(r => r === rag).length;
                      return (
                        <div key={rag} style={{ flex: 1, minWidth: 70, background: RAG[rag].bg, border: `1.5px solid ${RAG[rag].border}`, borderRadius: 4, padding: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: 28, fontWeight: "bold", fontFamily: "sans-serif", color: RAG[rag].text }}>{count}</div>
                          <div style={{ fontSize: 10, fontFamily: "sans-serif", color: RAG[rag].text, fontWeight: "bold", letterSpacing: 1 }}>{rag.toUpperCase()}</div>
                        </div>
                      );
                    })}
                    <div style={{ flex: 1, minWidth: 70, background: "#F2EFE8", border: `1.5px solid ${C.lightGray}`, borderRadius: 4, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: "bold", fontFamily: "sans-serif", color: C.gray }}>{rags.filter(r => r === null).length}</div>
                      <div style={{ fontSize: 10, fontFamily: "sans-serif", color: C.gray, fontWeight: "bold", letterSpacing: 1 }}>NOT ENTERED</div>
                    </div>
                  </div>
                </Card>

                {/* Ratio detail */}
                <Card title="Ratio Detail" subtitle="Status for each entered ratio">
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {RATIOS.map((ratio, ridx) => {
                      const rag = rags[ridx];
                      const val = ratioVals[ratio.key];
                      if (!val && val !== 0) return null;
                      return (
                        <div key={ratio.key} style={{ display: "flex", alignItems: "center", gap: 10, background: ridx % 2 === 0 ? C.white : "#F2EFE8", border: `1px solid ${C.lightGray}`, borderRadius: 4, padding: "10px 12px", flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 120 }}>
                            <div style={{ fontSize: 12, fontWeight: "bold", color: C.navy, fontFamily: "sans-serif" }}>{ratio.label}</div>
                            <div style={{ fontSize: 10, color: C.gray, fontFamily: "sans-serif" }}>{ratio.section}</div>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif", color: C.navy }}>{val}{ratio.isPercent ? "%" : ""}</div>
                          <RagBadge rag={rag} />
                        </div>
                      );
                    })}
                    {rags.every(r => r === null) && <div style={{ fontSize: 12, color: C.gray, fontFamily: "sans-serif", textAlign: "center", padding: "16px" }}>No ratio values entered yet.</div>}
                  </div>
                </Card>

                {/* Z-Score result */}
                {zScore !== null && (
                  <Card title="Altman Z'-Score" subtitle="Quantitative distress prediction model">
                    <div style={{ background: getZone(zScore).bg, border: `2px solid ${getZone(zScore).border}`, borderRadius: 6, padding: "14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontSize: 10, fontFamily: "sans-serif", fontWeight: "bold", color: getZone(zScore).color, letterSpacing: 1 }}>Z'-SCORE</div>
                        <div style={{ fontSize: 36, fontWeight: "bold", fontFamily: "sans-serif", color: getZone(zScore).color, lineHeight: 1 }}>{zScore.toFixed(3)}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: "bold", fontFamily: "sans-serif", color: getZone(zScore).color }}>{getZone(zScore).label}</div>
                        <div style={{ fontSize: 11, color: C.gray, fontFamily: "sans-serif", marginTop: 4 }}>Safe: above 2.90 · Grey: 1.23–2.90 · Distress: below 1.23</div>
                      </div>
                    </div>

                    {/* Component bars */}
                    {Z_COMPONENTS.map(comp => {
                      const val = parseFloat(zInputs[comp.key]);
                      if (isNaN(val)) return null;
                      const weighted = val * comp.coefficient;
                      const pct = Math.min(Math.abs((weighted / zScore) * 100), 100);
                      return (
                        <div key={comp.key} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "sans-serif", marginBottom: 3 }}>
                            <span style={{ color: C.navy }}>{comp.label}: {comp.desc}</span>
                            <strong style={{ color: C.navy }}>{weighted.toFixed(4)}</strong>
                          </div>
                          <div style={{ height: 8, background: C.lightGray, borderRadius: 2 }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: weighted >= 0 ? C.navy2 : C.red, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}

                <button onClick={reset} style={{ background: "transparent", border: `1px solid ${C.lightGray}`, borderRadius: 4, padding: "10px", fontSize: 12, fontFamily: "sans-serif", color: C.gray, cursor: "pointer", letterSpacing: 1, width: "100%" }}>↺ START NEW ASSESSMENT</button>
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ background: C.navy, borderTop: `2px solid ${C.gold}`, padding: "10px 16px", textAlign: "center" }}>
        <span style={{ fontSize: 10, color: C.htext, fontFamily: "sans-serif", letterSpacing: 1 }}>FLANAGAN SOURCING INTELLIGENCE PORTFOLIO · MATTHEW FLANAGAN, CPSM</span>
      </div>
    </div>
  );
}

const inputSt = {
  border: "1px solid #E8E4DC", borderRadius: 4, padding: "8px 10px",
  fontSize: 13, fontFamily: "sans-serif", color: "#1B2A4A",
  background: "#FFFFFF", outline: "none", width: "100%", boxSizing: "border-box",
};

function Card({ title, subtitle, children }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E8E4DC", borderRadius: 6, marginBottom: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ background: "#F2EFE8", borderBottom: "2px solid #C8A84B", padding: "10px 14px" }}>
        <div style={{ fontSize: 13, fontWeight: "bold", color: "#1B2A4A", fontFamily: "sans-serif" }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "sans-serif", marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: "14px" }}>{children}</div>
    </div>
  );
}