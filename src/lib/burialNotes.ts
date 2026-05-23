export function burialNoteItems(notes?: string) {
  return (notes ?? "")
    .replace(/\bNorth Hills (?:Guide|Geneologists)\b/gu, "North Hills Genealogists")
    .split(/\s+\|\s+|(?<=\.)\s+(?=[A-Z])/u)
    .map((note) => note.trim().replace(/\.$/u, ""))
    .filter((note) => !/^Imported from headstone spreadsheet row\b/iu.test(note))
    .filter((note) => !/^Person column:/iu.test(note))
    .filter(Boolean);
}
