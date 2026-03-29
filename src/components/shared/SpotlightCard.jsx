import { useEffect, useRef } from "react";

export default function SpotlightCard({
  children,
  className = "",
  style = {},
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onMove = (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--spot-x", `${x}px`);
      card.style.setProperty("--spot-y", `${y}px`);
    };

    card.addEventListener("pointermove", onMove);
    return () => card.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <>
      <style>{`
        [data-spot] {
          position: relative;
          border: 1px solid rgba(255,255,255,0.06);
          overflow: hidden;
        }
        [data-spot]::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: radial-gradient(
            300px 300px at var(--spot-x, -999px) var(--spot-y, -999px),
            rgba(45, 212, 168, 0.15),
            transparent 70%
          );
          pointer-events: none;
          z-index: 1;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        [data-spot]:hover::before {
          opacity: 1;
        }
        [data-spot]::after {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          background: radial-gradient(
            400px 400px at var(--spot-x, -999px) var(--spot-y, -999px),
            rgba(45, 212, 168, 0.4),
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
          opacity: 0;
          transition: opacity 0.3s ease;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          padding: 1px;
        }
        [data-spot]:hover::after {
          opacity: 1;
        }
      `}</style>
      <div
        ref={cardRef}
        data-spot
        style={style}
        className={className}
      >
        {children}
      </div>
    </>
  );
}
