export const dataConfidenceOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export const reviewStatusOptions = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "needs_review", label: "Needs review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "conflict", label: "Source conflict" },
] as const;

