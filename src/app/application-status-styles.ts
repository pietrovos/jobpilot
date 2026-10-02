import { ApplicationStatus } from "@/generated/prisma/enums";

export const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export const statusSelectTextStyles: Record<ApplicationStatus, string> = {
  APPLIED: "text-blue-200",
  INTERVIEWING: "text-fuchsia-200",
  OFFER: "text-white",
  REJECTED: "text-rose-200",
};

export const statusDropdownStyles: Record<ApplicationStatus, { button: string; menu: string; option: string; dot: string }> = {
  APPLIED: {
    button: "border-blue-400/30 bg-blue-950/30 text-blue-100 shadow-[0_0_18px_rgb(37_99_235/0.12)] hover:border-blue-300/55 hover:bg-blue-500/12",
    menu: "border-blue-400/25 bg-slate-950/95 shadow-blue-950/35",
    option: "hover:border-blue-300/40 hover:bg-blue-500/12 hover:text-blue-100",
    dot: "bg-blue-400 shadow-[0_0_12px_rgb(96_165_250/0.75)]",
  },
  INTERVIEWING: {
    button: "border-fuchsia-400/35 bg-fuchsia-950/25 text-fuchsia-100 shadow-[0_0_22px_rgb(168_85_247/0.16)] hover:border-fuchsia-300/60 hover:bg-fuchsia-500/12",
    menu: "border-fuchsia-400/25 bg-slate-950/95 shadow-purple-950/40",
    option: "hover:border-fuchsia-300/45 hover:bg-fuchsia-500/12 hover:text-fuchsia-100",
    dot: "bg-fuchsia-400 shadow-[0_0_14px_rgb(232_121_249/0.78)]",
  },
  OFFER: {
    button: "border-orange-300/55 bg-orange-950/35 text-white shadow-[0_0_26px_rgb(251_146_60/0.22)] hover:border-yellow-100/75 hover:bg-orange-500/14",
    menu: "border-orange-300/35 bg-slate-950/95 shadow-orange-950/45",
    option: "hover:border-orange-200/50 hover:bg-orange-500/14 hover:text-orange-50",
    dot: "bg-yellow-300 shadow-[0_0_16px_rgb(250_204_21/0.95)]",
  },
  REJECTED: {
    button: "border-rose-400/35 bg-rose-950/25 text-rose-100 shadow-[0_0_18px_rgb(225_29_72/0.14)] hover:border-rose-300/60 hover:bg-rose-500/12",
    menu: "border-rose-400/25 bg-slate-950/95 shadow-rose-950/40",
    option: "hover:border-rose-300/45 hover:bg-rose-500/12 hover:text-rose-100",
    dot: "bg-rose-400 shadow-[0_0_14px_rgb(251_113_133/0.78)]",
  },
};

export const rowStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-400/25 hover:border-blue-400/70 hover:bg-blue-500/[0.08] hover:shadow-[0_0_28px_rgb(37_99_235/0.14)]",
  INTERVIEWING: "border-purple-400/35 hover:border-fuchsia-300/80 hover:bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] hover:shadow-[0_0_36px_rgb(168_85_247/0.28),inset_0_0_18px_rgb(168_85_247/0.08)]",
  OFFER: "border-orange-400/60 hover:border-yellow-100 hover:bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] hover:shadow-[0_0_72px_rgb(251_146_60/0.52),0_0_26px_rgb(253_186_116/0.32),inset_0_0_34px_rgb(245_158_11/0.18)]",
  REJECTED: "border-rose-400/25 hover:border-rose-400/70 hover:bg-rose-500/[0.07] hover:shadow-[0_0_28px_rgb(225_29_72/0.14)]",
};

export const rowStatusBaseStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-400/25",
  INTERVIEWING: "border-purple-400/35",
  OFFER: "border-orange-400/60",
  REJECTED: "border-rose-400/25",
};

export const rowStatusFocusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "focus:border-blue-400/70 focus:bg-blue-500/[0.08] focus:shadow-[0_0_28px_rgb(37_99_235/0.14)]",
  INTERVIEWING: "focus:border-fuchsia-300/80 focus:bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] focus:shadow-[0_0_36px_rgb(168_85_247/0.28),inset_0_0_18px_rgb(168_85_247/0.08)]",
  OFFER: "focus:border-yellow-100 focus:bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] focus:shadow-[0_0_72px_rgb(251_146_60/0.52),0_0_26px_rgb(253_186_116/0.32),inset_0_0_34px_rgb(245_158_11/0.18)]",
  REJECTED: "focus:border-rose-400/70 focus:bg-rose-500/[0.07] focus:shadow-[0_0_28px_rgb(225_29_72/0.14)]",
};

export const selectedRowStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "border-blue-300 bg-blue-500/[0.10] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  INTERVIEWING: "border-fuchsia-300 bg-[radial-gradient(circle_at_18%_50%,rgb(192_132_252/0.14),transparent_34%),linear-gradient(90deg,rgb(88_28_135/0.24),rgb(15_23_42/0.28))] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  OFFER: "border-yellow-100 bg-[radial-gradient(circle_at_18%_50%,rgb(251_146_60/0.34),transparent_32%),radial-gradient(circle_at_75%_45%,rgb(253_186_116/0.20),transparent_28%),linear-gradient(90deg,rgb(154_52_18/0.56),rgb(15_23_42/0.25))] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
  REJECTED: "border-rose-300 bg-rose-500/[0.10] ring-2 ring-sky-300/80 ring-offset-2 ring-offset-slate-950",
};

export const rankHoldStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "rank-hold rank-hold-applied",
  INTERVIEWING: "rank-hold rank-hold-interviewing",
  OFFER: "rank-hold rank-hold-offer",
  REJECTED: "rank-hold rank-hold-rejected",
};

export const textStatusStyles: Record<ApplicationStatus, { title: string; role: string; metaLabel: string; metaValue: string; time: string; action: string }> = {
  APPLIED: {
    title: "rank-title rank-title-water text-blue-50 hover:text-blue-200",
    role: "text-blue-100/80",
    metaLabel: "text-blue-300/45",
    metaValue: "text-blue-50/90",
    time: "text-blue-200",
    action: "border-blue-300/20 text-blue-100 hover:bg-blue-400/10 hover:border-blue-300/45",
  },
  INTERVIEWING: {
    title: "rank-title rank-title-dark-aura text-fuchsia-50 hover:text-fuchsia-200",
    role: "text-purple-100/88",
    metaLabel: "text-fuchsia-300/52",
    metaValue: "text-purple-50/95",
    time: "text-fuchsia-200",
    action: "border-fuchsia-300/24 text-fuchsia-100 hover:bg-fuchsia-400/10 hover:border-fuchsia-300/55",
  },
  OFFER: {
    title: "rank-title rank-title-angelic text-orange-100 hover:text-orange-50",
    role: "text-orange-100",
    metaLabel: "text-orange-200/70",
    metaValue: "text-amber-50",
    time: "text-amber-100 drop-shadow-[0_0_12px_rgb(251_146_60/0.48)]",
    action: "border-orange-200/35 text-orange-50 hover:bg-orange-400/14 hover:border-yellow-100/70 hover:shadow-[0_0_18px_rgb(251_146_60/0.22)]",
  },
  REJECTED: {
    title: "text-rose-50 hover:text-rose-200",
    role: "text-rose-100/75",
    metaLabel: "text-rose-300/45",
    metaValue: "text-rose-50/85",
    time: "text-rose-200",
    action: "border-rose-300/20 text-rose-100 hover:bg-rose-400/10 hover:border-rose-300/45",
  },
};

export const salaryRankStyles: Record<ApplicationStatus, string> = {
  REJECTED: "text-amber-200/70",
  APPLIED: "salary-glow-applied",
  INTERVIEWING: "text-yellow-100 salary-glow-interviewing",
  OFFER: "text-yellow-50 salary-glow-offer",
};

export const gameMenuStatusStyles: Record<ApplicationStatus, string> = {
  APPLIED: "game-menu-applied",
  INTERVIEWING: "game-menu-interviewing",
  OFFER: "game-menu-offer",
  REJECTED: "game-menu-rejected",
};

export const modalStatusStyles: Record<ApplicationStatus, { overlay: string; shell: string; scrollbar: string; eyebrow: string; button: string; link: string; fieldBorder: string; fieldLabel: string; fieldFocus: string; fieldInput: string; fieldGlow: string; editIcon: string; tile: string; timeline: string; timelineItem: string }> = {
  APPLIED: {
    overlay: "details-overlay-applied",
    shell: "border-blue-400/25 bg-[radial-gradient(circle_at_top_left,rgb(37_99_235/0.12),transparent_34%),#0f172a] shadow-blue-950/30",
    scrollbar: "details-scroll-applied",
    eyebrow: "text-blue-300",
    button: "bg-blue-500 text-slate-950 hover:bg-blue-300",
    link: "text-blue-300 hover:text-blue-200",
    fieldBorder: "border-blue-400/30",
    fieldLabel: "text-blue-300",
    fieldFocus: "focus:border-blue-400",
    fieldInput: "border-blue-400/25 bg-blue-950/35 text-blue-50 focus:bg-blue-950/50 focus:shadow-[0_0_24px_rgb(59_130_246/0.2)]",
    fieldGlow: "hover:border-blue-300/55 hover:shadow-[0_8px_18px_-18px_rgb(96_165_250/0.95),0_1px_0_rgb(96_165_250/0.55)] focus-within:border-blue-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(96_165_250/1),0_1px_0_rgb(96_165_250/0.65)]",
    editIcon: "border-blue-300/45 bg-blue-400/12 text-blue-100 hover:border-blue-200/70 hover:bg-blue-400/22 hover:shadow-[0_0_20px_rgb(59_130_246/0.24)]",
    tile: "border-blue-400/18 bg-blue-950/10",
    timeline: "border-blue-400/20 bg-blue-950/20",
    timelineItem: "border border-blue-400/15 bg-blue-950/16",
  },
  INTERVIEWING: {
    overlay: "details-overlay-interviewing",
    shell: "border-fuchsia-400/25 bg-[radial-gradient(circle_at_top_left,rgb(168_85_247/0.16),transparent_34%),#0f1020] shadow-purple-950/35",
    scrollbar: "details-scroll-interviewing",
    eyebrow: "text-fuchsia-300",
    button: "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_0_18px_rgb(99_102_241/0.22)]",
    link: "text-fuchsia-300 hover:text-fuchsia-200",
    fieldBorder: "border-fuchsia-400/30",
    fieldLabel: "text-fuchsia-300",
    fieldFocus: "focus:border-fuchsia-400",
    fieldInput: "border-fuchsia-400/25 bg-fuchsia-950/30 text-fuchsia-50 focus:bg-fuchsia-950/45 focus:shadow-[0_0_24px_rgb(217_70_239/0.2)]",
    fieldGlow: "hover:border-fuchsia-300/55 hover:shadow-[0_8px_18px_-18px_rgb(232_121_249/0.95),0_1px_0_rgb(232_121_249/0.55)] focus-within:border-fuchsia-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(232_121_249/1),0_1px_0_rgb(232_121_249/0.65)]",
    editIcon: "border-fuchsia-300/45 bg-fuchsia-400/12 text-fuchsia-100 hover:border-fuchsia-200/70 hover:bg-fuchsia-400/22 hover:shadow-[0_0_22px_rgb(217_70_239/0.24)]",
    tile: "border-fuchsia-400/18 bg-fuchsia-950/10",
    timeline: "border-fuchsia-400/20 bg-fuchsia-950/20",
    timelineItem: "border border-fuchsia-400/15 bg-fuchsia-950/16",
  },
  OFFER: {
    overlay: "details-overlay-offer",
    shell: "border-orange-300/35 bg-[radial-gradient(circle_at_top_left,rgb(251_146_60/0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgb(253_186_116/0.14),transparent_30%),#140b08] shadow-orange-950/45",
    scrollbar: "details-scroll-offer",
    eyebrow: "text-orange-200 drop-shadow-[0_0_10px_rgb(251_146_60/0.35)]",
    button: "bg-orange-500 text-slate-950 hover:bg-orange-300 shadow-[0_0_22px_rgb(251_146_60/0.28)]",
    link: "text-orange-200 hover:text-yellow-100",
    fieldBorder: "border-orange-300/35",
    fieldLabel: "text-orange-200",
    fieldFocus: "focus:border-orange-300",
    fieldInput: "border-orange-300/30 bg-orange-950/30 text-orange-50 focus:bg-orange-950/45 focus:shadow-[0_0_26px_rgb(251_146_60/0.24)]",
    fieldGlow: "hover:border-orange-200/60 hover:shadow-[0_8px_18px_-18px_rgb(251_146_60/0.98),0_1px_0_rgb(251_146_60/0.58)] focus-within:border-orange-200/70 focus-within:shadow-[0_8px_22px_-18px_rgb(251_146_60/1),0_1px_0_rgb(251_146_60/0.7)]",
    editIcon: "border-orange-200/55 bg-orange-400/14 text-orange-50 hover:border-yellow-100/80 hover:bg-orange-400/24 hover:shadow-[0_0_24px_rgb(251_146_60/0.3)]",
    tile: "border-orange-300/20 bg-orange-950/10",
    timeline: "border-orange-300/25 bg-orange-950/20",
    timelineItem: "border border-orange-300/18 bg-orange-950/16",
  },
  REJECTED: {
    overlay: "details-overlay-rejected",
    shell: "border-rose-400/25 bg-[radial-gradient(circle_at_top_left,rgb(225_29_72/0.12),transparent_34%),#120b12] shadow-rose-950/30",
    scrollbar: "details-scroll-rejected",
    eyebrow: "text-rose-300",
    button: "bg-rose-500 text-white hover:bg-rose-400",
    link: "text-rose-300 hover:text-rose-200",
    fieldBorder: "border-rose-400/30",
    fieldLabel: "text-rose-300",
    fieldFocus: "focus:border-rose-400",
    fieldInput: "border-rose-400/25 bg-rose-950/30 text-rose-50 focus:bg-rose-950/45 focus:shadow-[0_0_24px_rgb(244_63_94/0.2)]",
    fieldGlow: "hover:border-rose-300/55 hover:shadow-[0_8px_18px_-18px_rgb(251_113_133/0.95),0_1px_0_rgb(251_113_133/0.55)] focus-within:border-rose-300/65 focus-within:shadow-[0_8px_20px_-18px_rgb(251_113_133/1),0_1px_0_rgb(251_113_133/0.65)]",
    editIcon: "border-rose-300/45 bg-rose-400/12 text-rose-100 hover:border-rose-200/70 hover:bg-rose-400/22 hover:shadow-[0_0_20px_rgb(244_63_94/0.24)]",
    tile: "border-rose-400/18 bg-rose-950/10",
    timeline: "border-rose-400/20 bg-rose-950/20",
    timelineItem: "border border-rose-400/15 bg-rose-950/16",
  },
};

export function withoutBorderClasses(className: string) {
  return className
    .split(" ")
    .filter((item) => item !== "border" && !item.startsWith("border-"))
    .join(" ");
}
