"use client";

import { useEffect, useState } from "react";

/**
 * Detects the on-screen keyboard on mobile.
 *
 * `visualViewport` is the only reliable signal: when the keyboard opens, the
 * visual viewport shrinks while the layout viewport does not. A fixed or
 * sticky footer positioned against the layout viewport would then sit behind
 * the keyboard, or pin the focused field against it — so callers use this to
 * un-stick the action area and let it scroll with the content instead.
 *
 * Returns false during SSR and on any browser without `visualViewport`, which
 * is the correct default: the action area stays where it is.
 */
export function useKeyboardOpen(threshold = 160): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : undefined;
    if (!vv) return;

    const update = () => {
      // A shrink well beyond browser-chrome collapse means a keyboard.
      const hidden = window.innerHeight - vv.height;
      setOpen(hidden > threshold);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [threshold]);

  return open;
}
