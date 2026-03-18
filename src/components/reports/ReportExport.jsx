import { useToast } from "../shared/Toast";

export default function ReportExport({ report }) {
  const toast = useToast();

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(report);
      toast("Report copied to clipboard");
    } catch {
      toast("Failed to copy", "error");
    }
  };

  const copyAsEmail = async () => {
    const html = report
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^- (.*$)/gm, "<li>$1</li>")
      .replace(/\n/g, "<br>");
    try {
      await navigator.clipboard.writeText(html);
      toast("Email-formatted HTML copied");
    } catch {
      toast("Failed to copy", "error");
    }
  };

  const printReport = () => {
    window.print();
    toast("Print dialog opened");
  };

  return (
    <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "center" }}>
      <button className="btn-ghost" onClick={copyMarkdown} style={{ fontSize: 13 }}>
        📋 Copy Markdown
      </button>
      <button className="btn-ghost" onClick={copyAsEmail} style={{ fontSize: 13 }}>
        📧 Copy as Email
      </button>
      <button className="btn-ghost" onClick={printReport} style={{ fontSize: 13 }}>
        🖨️ Print / PDF
      </button>
    </div>
  );
}
