import { useEffect, useState } from "react";

export default function PolyAlphaLogo({ size = "small", animate = true }) {
  const [loaded, setLoaded] = useState(!animate);

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setLoaded(true), 50);
      return () => clearTimeout(t);
    }
  }, [animate]);

  const isLarge = size === "large";
  const fontSize = isLarge ? 36 : 17;
  const letterDelay = 40;

  const text = "Dexio";
  const splitIdx = 3; // "Dex" vs "io"

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isLarge ? 14 : 8,
        userSelect: "none",
      }}
    >
      {/* Geometric mark — abstract "D" that draws itself */}
      <div
        style={{
          width: isLarge ? 40 : 22,
          height: isLarge ? 40 : 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: loaded ? 1 : 0,
          transform: loaded ? "scale(1)" : "scale(0.8)",
          transition: "all 0.5s var(--ease-out)",
        }}
      >
        <svg
          width={isLarge ? 36 : 20}
          height={isLarge ? 36 : 20}
          viewBox="0 0 36 36"
          fill="none"
        >
          {/* Abstract geometric D + signal mark */}
          <path
            d="M10 6L10 30L24 30C28.4 30 32 24.6 32 18C32 11.4 28.4 6 24 6L10 6Z"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            style={{
              strokeDasharray: 90,
              strokeDashoffset: loaded ? 0 : 90,
              transition: "stroke-dashoffset 0.7s var(--ease-out) 0.1s",
            }}
          />
          {/* Inner signal line */}
          <path
            d="M16 14L20 18L16 22"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 16,
              strokeDashoffset: loaded ? 0 : 16,
              transition: "stroke-dashoffset 0.4s var(--ease-out) 0.55s",
            }}
          />
        </svg>
      </div>

      {/* Text */}
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {text.split("").map((char, i) => (
          <span
            key={i}
            className={animate ? "logo-letter" : ""}
            style={{
              display: "inline-block",
              color: i >= splitIdx ? "var(--accent)" : "var(--text-primary)",
              animationDelay: animate ? `${i * letterDelay}ms` : undefined,
              opacity: animate && !loaded ? 0 : undefined,
            }}
          >
            {char}
          </span>
        ))}
      </span>
    </div>
  );
}
