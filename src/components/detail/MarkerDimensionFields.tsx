import type { MarkerDimensions } from "../../types/markers";

const fields = [
  ["width", "Width"],
  ["height", "Overall height"],
  ["depth", "Depth"],
  ["rise", "Height above grade"],
] as const;

export function MarkerDimensionFields({ dimensions, onChange }: {
  dimensions?: MarkerDimensions;
  onChange: (dimensions: MarkerDimensions) => void;
}) {
  return <>
    {fields.map(([field, label]) => <label key={field}>
      {label} (inches)
      <input type="number" min={field === "rise" ? 0 : 0.01} max={10000} step="any"
        value={dimensions?.[field] ?? ""}
        onChange={(event) => onChange({
          ...dimensions,
          [field]: event.target.value === "" ? null : event.target.valueAsNumber,
        })} />
    </label>)}
  </>;
}
