import { useRef, useState } from "react";

export default function GlowingInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search...",
  loading = false,
  buttonText = "Search",
  loadingText = "Searching...",
  style = {},
  children // optional: extra content inside the input container
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && value && !loading && onSubmit) {
      onSubmit(value);
    }
  };

  return (
    <>
      <style>{`
        .glow-wrap {
          --glow-hue: 160;
          --glow-color-1: #0a4a3a;
          --glow-color-2: #2DD4A8;
          --glow-color-3: #1a8a6a;
          --glow-color-4: #15b88a;
          --glow-color-5: #88e8cc;
          --glow-color-6: #a8f0da;
        }
        .glow-layer {
          position: absolute;
          z-index: -1;
          overflow: hidden;
          height: 100%;
          width: 100%;
          border-radius: 0px;
        }
        .glow-layer::before {
          content: "";
          position: absolute;
          z-index: -2;
          width: 600px;
          height: 600px;
          background-repeat: no-repeat;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(82deg);
          transition: transform 2s ease;
        }
        /* Layer 1 — main border glow */
        .glow-layer-1 { max-height: 70px; filter: blur(3px); }
        .glow-layer-1::before {
          width: 999px; height: 999px;
          background-image: conic-gradient(#000, var(--glow-color-1) 5%, #000 38%, #000 50%, var(--glow-color-2) 60%, #000 87%);
          transform: translate(-50%, -50%) rotate(60deg);
        }
        /* Layer 2-4 — secondary glow */
        .glow-layer-2, .glow-layer-3, .glow-layer-4 { max-height: 65px; filter: blur(3px); }
        .glow-layer-2::before, .glow-layer-3::before, .glow-layer-4::before {
          background-image: conic-gradient(transparent, var(--glow-color-1), transparent 10%, transparent 50%, var(--glow-color-3), transparent 60%);
        }
        /* Layer 5 — bright accent */
        .glow-layer-5 { max-height: 63px; filter: blur(2px); }
        .glow-layer-5::before {
          background-image: conic-gradient(transparent 0%, var(--glow-color-5), transparent 8%, transparent 50%, var(--glow-color-6), transparent 58%);
          filter: brightness(1.4);
        }
        /* Layer 6 — inner border */
        .glow-layer-6 { max-height: 59px; filter: blur(0.5px); }
        .glow-layer-6::before {
          background-image: conic-gradient(#0A0A0A, var(--glow-color-1) 5%, #0A0A0A 14%, #0A0A0A 50%, var(--glow-color-2) 60%, #0A0A0A 64%);
          filter: brightness(1.3);
          transform: translate(-50%, -50%) rotate(70deg);
        }
        /* Hover state */
        .glow-wrap:hover .glow-layer-1::before { transform: translate(-50%, -50%) rotate(-120deg); }
        .glow-wrap:hover .glow-layer-2::before,
        .glow-wrap:hover .glow-layer-3::before,
        .glow-wrap:hover .glow-layer-4::before { transform: translate(-50%, -50%) rotate(-98deg); }
        .glow-wrap:hover .glow-layer-5::before { transform: translate(-50%, -50%) rotate(-97deg); }
        .glow-wrap:hover .glow-layer-6::before { transform: translate(-50%, -50%) rotate(-110deg); }
        /* Focus state — longer animation */
        .glow-wrap:focus-within .glow-layer-1::before { transform: translate(-50%, -50%) rotate(480deg); transition-duration: 4s; }
        .glow-wrap:focus-within .glow-layer-2::before,
        .glow-wrap:focus-within .glow-layer-3::before,
        .glow-wrap:focus-within .glow-layer-4::before { transform: translate(-50%, -50%) rotate(442deg); transition-duration: 4s; }
        .glow-wrap:focus-within .glow-layer-5::before { transform: translate(-50%, -50%) rotate(443deg); transition-duration: 4s; }
        .glow-wrap:focus-within .glow-layer-6::before { transform: translate(-50%, -50%) rotate(430deg); transition-duration: 4s; }
        /* Teal mask glow */
        .glow-teal-mask {
          position: absolute;
          width: 30px; height: 20px;
          background: var(--glow-color-2);
          top: 10px; left: 5px;
          filter: blur(24px);
          opacity: 0.8;
          transition: opacity 2s;
          pointer-events: none;
        }
        .glow-wrap:hover .glow-teal-mask { opacity: 0; }
      `}</style>
      <div className="glow-wrap" style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(45, 212, 168, 0.08), 0 2px 12px rgba(0, 0, 0, 0.4)", ...style }}>
        <div className="glow-layer glow-layer-1" />
        <div className="glow-layer glow-layer-2" />
        <div className="glow-layer glow-layer-3" />
        <div className="glow-layer glow-layer-4" />
        <div className="glow-layer glow-layer-5" />
        <div className="glow-layer glow-layer-6" />
        <div style={{ position: "relative", width: "100%" }}>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            disabled={loading}
            style={{
              background: "#010201",
              border: "none",
              width: "100%",
              height: 56,
              padding: "0 140px 0 16px",
              color: "#fff",
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              outline: "none",
              letterSpacing: "0.02em",
            }}
          />
          <div className="glow-teal-mask" />
          {onSubmit && (
            <button
              onClick={() => value && !loading && onSubmit(value)}
              disabled={!value || loading}
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                height: 44,
                padding: "0 24px",
                background: !value || loading ? "var(--bg-elevated)" : "var(--accent)",
                color: !value || loading ? "var(--text-ghost)" : "#0A0A0A",
                border: "none",
                cursor: !value || loading ? "not-allowed" : "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                transition: "all 200ms ease-out",
              }}
            >
              {loading ? loadingText : buttonText}
            </button>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
