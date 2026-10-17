import { useEffect, useRef, useState } from "react";

// Stay active after the first intersection so scrolling does not restart downloads.
export function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (active || !ref.current) return;
    if (!("IntersectionObserver" in window)) { setActive(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setActive(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [active]);
  return { ref, active };
}
