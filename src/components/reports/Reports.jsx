import { useState } from "react";
import { generateReport } from "../../utils/aiAgent";
import ReportGenerator from "./ReportGenerator";
import ReportDisplay from "./ReportDisplay";
import DataBadge from "../shared/DataBadge";

const steps = [
  "Collecting market data...",
  "Analyzing active markets...",
  "AI agent writing report...",
  "Formatting output...",
];

export default function Reports({ markets }) {
  const [report, setReport] = useState(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  async function handleGenerate(config) {
    setLoading(true);
    setReport(null);
    setCurrentStep(0);

    // Simulate progressive steps
    for (let i = 0; i < steps.length - 1; i++) {
      await new Promise((r) => setTimeout(r, 600));
      setCurrentStep(i + 1);
    }

    const result = await generateReport(config);
    setCurrentStep(steps.length);
    setReport(result.report);
    setIsDemo(result.isDemo);
    setLoading(false);
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "3px solid var(--border-subtle)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 28px",
          }}
        />
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginBottom: 24 }}>
          Generating your report...
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                fontFamily: "var(--font-mono)",
                color: i < currentStep ? "var(--accent)" : i === currentStep ? "var(--text-primary)" : "var(--text-muted)",
                transition: "color 0.3s",
              }}
            >
              <span style={{ width: 20, textAlign: "center" }}>
                {i < currentStep ? "✓" : i === currentStep ? (
                  <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", border: "2px solid var(--border-subtle)", borderTopColor: "var(--accent)", animation: "spin 0.6s linear infinite" }} />
                ) : "○"}
              </span>
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (report) {
    return (
      <ReportDisplay
        report={report}
        isDemo={isDemo}
        onBack={() => { setReport(null); setIsDemo(false); }}
      />
    );
  }

  return <ReportGenerator onGenerate={handleGenerate} markets={markets} loading={loading} />;
}
