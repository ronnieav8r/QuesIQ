/** Portable visual constants; no platform imports or runtime/provider behavior. */
export const interviewColors = {
  background: "#080C11", backgroundRaised: "#0C1219", border: "#22303C", borderStrong: "#365063",
  cyan: "#27D5FF", cyanDark: "#083A48", danger: "#FF6B72", lime: "#B8F24A", limeDark: "#263A0C",
  muted: "#8FA4B5", panel: "#111922", panelStrong: "#17222D", text: "#F4F8FB", textSoft: "#C1CED8", white: "#FFFFFF",
} as const;
export const interviewSpacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 44 } as const;
export const interviewRadius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const interviewTypography = { title: 30, section: 18, body: 16, supporting: 14, caption: 12 } as const;
export const interviewLayout = { minTouchTarget: 48, primaryHeight: 54, pageGutter: 20, contentMaxWidth: 640 } as const;

export const interviewPreviewCssVariables = Object.fromEntries(Object.entries({
  bg: interviewColors.background, raised: interviewColors.backgroundRaised, border: interviewColors.border,
  "border-strong": interviewColors.borderStrong, cyan: interviewColors.cyan, "cyan-dark": interviewColors.cyanDark,
  danger: interviewColors.danger, lime: interviewColors.lime, "lime-dark": interviewColors.limeDark,
  muted: interviewColors.muted, panel: interviewColors.panel, "panel-strong": interviewColors.panelStrong,
  text: interviewColors.text, "text-soft": interviewColors.textSoft,
}).map(([name, value]) => [`--preview-${name}`, value]));
