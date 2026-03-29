import { useRef, useLayoutEffect, useState, useCallback } from "react";

export default function PageTransition({ children, locationKey }) {
  const [transitionClass, setTransitionClass] = useState("animate-page-enter");
  const prevKey = useRef(locationKey);
  const containerRef = useRef(null);

  const triggerTransition = useCallback(() => {
    if (locationKey !== prevKey.current) {
      prevKey.current = locationKey;
      // Remove and re-add animation class to retrigger
      if (containerRef.current) {
        containerRef.current.style.animation = "none";
        // Force reflow
        void containerRef.current.offsetHeight;
        containerRef.current.style.animation = "";
      }
    }
  }, [locationKey]);

  useLayoutEffect(() => {
    triggerTransition();
  }, [triggerTransition]);

  return (
    <div ref={containerRef} className={transitionClass}>
      {children}
    </div>
  );
}
