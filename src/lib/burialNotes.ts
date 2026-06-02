const abbreviationPeriod = "\uE000";
const sentenceAbbreviations = /\b(?:St|Mr|Mrs|Ms|Dr|Rev)\.\s+/gu;

export function burialNoteItems(notes?: string) {
  return (notes ?? "")
    .replace(/\bNorth Hills (?:Guide|Geneologists)\b/gu, "North Hills Genealogists")
    .replace(sentenceAbbreviations, (match) => match.replace(".", abbreviationPeriod))
    .split(/\s+\|\s+|(?<=\.)\s+(?=[A-Z])/u)
    .map((note) => note.replaceAll(abbreviationPeriod, ".").trim().replace(/\.$/u, ""))
    .filter((note) => !/^Imported from headstone spreadsheet row\b/iu.test(note))
    .filter((note) => !/^Person column:/iu.test(note))
    .filter(Boolean);
}
