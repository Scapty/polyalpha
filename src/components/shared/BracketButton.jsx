import { useState } from "react";

export default function BracketButton({ children, onClick, style = {}, arrow = false }) {
  return (
    <button className="bracket-btn" onClick={onClick} style={style}>
      <span className="bracket-tr" />
      <span className="bracket-bl" />
      {children}
      {arrow && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      )}
    </button>
  );
}
