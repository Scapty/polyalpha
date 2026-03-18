import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReportExport from "./ReportExport";

export default function ReportDisplay({ report, isDemo, onBack }) {
  return (
    <div className="animate-fade-in-up" style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <button
          onClick={onBack}
          className="btn-ghost"
          style={{ fontSize: 13, padding: "8px 16px" }}
        >
          ← New Report
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isDemo && (
            <span className="badge badge-yellow" style={{ fontSize: 10 }}>DEMO REPORT</span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Generated {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Report header */}
      <div
        style={{
          padding: "28px 32px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          borderBottom: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 16, color: "var(--accent)" }}>◈</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            PolyAlpha Intelligence
          </span>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, var(--accent), transparent)", marginBottom: 0, opacity: 0.3 }} />
      </div>

      {/* Report body */}
      <div
        style={{
          padding: "8px 36px 40px",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderTop: "none",
          borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
        }}
      >
        <div className="report-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {report}
          </ReactMarkdown>
        </div>
      </div>

      {/* Export */}
      <ReportExport report={report} />
    </div>
  );
}
