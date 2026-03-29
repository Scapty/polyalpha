import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../utils/supabase";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) return;

    // If Supabase is not configured, fall back to demo mode
    if (!supabase) {
      onLogin?.();
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    onLogin?.();
  };

  const inputStyle = {
    width: "100%",
    height: 52,
    padding: "0 16px",
    background: "var(--bg-deep)",
    border: "1px solid var(--border)",
    borderRadius: 0,
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    fontSize: 15,
    outline: "none",
    transition: "border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out)",
  };

  const labelStyle = {
    display: "block",
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 8,
  };

  const handleFocus = (e) => {
    e.target.style.borderColor = "var(--accent)";
    e.target.style.boxShadow = "0 0 0 1px var(--accent)";
  };
  const handleBlur = (e) => {
    e.target.style.borderColor = "var(--border)";
    e.target.style.boxShadow = "none";
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: "40px 24px",
    }}>
      <div className="animate-fade-in-up" style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo + heading */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 32, cursor: "pointer" }} onClick={() => navigate("/")}>
            <span style={{
              fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "-0.02em",
            }}>
              <span style={{ color: "var(--text-primary)" }}>Dex</span>
              <span style={{ color: "var(--accent)" }}>io</span>
            </span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 500,
            textTransform: "uppercase", letterSpacing: "-0.02em",
            color: "var(--text-bright)", marginBottom: 8,
          }}>
            Log In
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>Welcome back</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            background: "var(--bg-deep)",
            border: "1px solid var(--border)",
            padding: "clamp(16px, 4vw, 32px)",
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={handleFocus} onBlur={handleBlur}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={inputStyle}
                onFocus={handleFocus} onBlur={handleBlur}
              />
            </div>
            {error && (
              <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>{error}</p>
            )}
            <button
              type="submit" className="btn-primary"
              disabled={!email.trim() || !password.trim() || loading}
              style={{ width: "100%", height: 52, marginTop: 8, fontSize: 13 }}
            >
              {loading ? "Signing in..." : "Log In"}
            </button>
          </div>
        </form>

        <p style={{
          textAlign: "center", marginTop: 24, fontSize: 14,
          color: "var(--text-muted)",
        }}>
          Don't have an account?{" "}
          <span onClick={() => navigate("/signup")} style={{
            color: "var(--accent)", cursor: "pointer", fontWeight: 500,
          }}>
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}
