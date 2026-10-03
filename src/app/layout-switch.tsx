"use client";

import { useTransition } from "react";
import { setApplicationLayout } from "@/app/actions/preferences";
import { applicationLayouts, type ApplicationLayout } from "./application-layouts";

function LayoutIcon({ layout }: { layout: ApplicationLayout }) {
  const props = { viewBox: "0 0 20 20", "aria-hidden": true, focusable: false, className: "size-4", fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;
  if (layout === "cards") return <svg {...props}><rect x="3" y="3" width="14" height="6" rx="1" /><rect x="3" y="11" width="14" height="6" rx="1" /></svg>;
  if (layout === "compact") return <svg {...props}><path d="M3 5h14M3 10h14M3 15h14" /></svg>;
  return <svg {...props}><rect x="3" y="3" width="4" height="14" rx="1" /><rect x="8" y="3" width="4" height="9" rx="1" /><rect x="13" y="3" width="4" height="11" rx="1" /></svg>;
}

// The choice is kept in a cookie so the server renders the right layout on every visit.
export function LayoutSwitch({ layout }: { layout: ApplicationLayout }) {
  const [pending, startTransition] = useTransition();

  function choose(next: ApplicationLayout) {
    if (next !== layout) startTransition(() => setApplicationLayout(next));
  }

  return (
    <div role="group" aria-label="Layout" aria-busy={pending} className="flex shrink-0 border border-sky-300/20 bg-slate-950/60 p-1">
      {applicationLayouts.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === layout}
          title={`${option.label} layout`}
          onClick={() => choose(option.value)}
          className={`flex items-center gap-2 px-3 py-2 text-sm font-bold transition ${
            option.value === layout ? "bg-sky-400/20 text-sky-50" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
          }`}
        >
          <LayoutIcon layout={option.value} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
