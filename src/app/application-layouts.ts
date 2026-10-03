export const applicationLayouts = [
  { value: "cards", label: "Cards" },
  { value: "compact", label: "Compact" },
  { value: "board", label: "Board" },
] as const;

export type ApplicationLayout = (typeof applicationLayouts)[number]["value"];

export const LAYOUT_COOKIE = "jobpilot_layout";

export function parseLayout(value: string | undefined): ApplicationLayout {
  return applicationLayouts.some((layout) => layout.value === value) ? value as ApplicationLayout : "cards";
}
