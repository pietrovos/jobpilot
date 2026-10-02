"use client";

import { useEffect, useRef } from "react";
import { bookmarkletHref } from "@/lib/bookmarklet";

// React refuses javascript: URLs in JSX, so the link is set on the element directly,
// using this deployment's own origin as the capture target.
export function BookmarkletLink() {
  const linkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    linkRef.current?.setAttribute("href", bookmarkletHref(window.location.origin));
  }, []);

  return (
    <a
      ref={linkRef}
      data-testid="bookmarklet"
      onClick={(event) => event.preventDefault()}
      className="inline-flex cursor-grab items-center gap-2 rounded-full border border-sky-300/45 bg-sky-400/15 px-5 py-3 font-black text-sky-50 shadow-[0_0_28px_rgb(14_165_233/0.2)]"
    >
      Save to JobPilot
    </a>
  );
}
