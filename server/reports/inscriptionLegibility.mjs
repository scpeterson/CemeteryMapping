import { inscriptionPlaceholder } from "../../shared/inscriptionStatus.mjs";

export function unreadableInscriptionReasons(text) {
  const value = String(text ?? "");
  return [ /\billegible\b/iu.test(value) ? "Illegible text" : null,
    /\[\s*-\s*\]/u.test(value) ? "Unreadable [-] fragment" : null ].filter(Boolean);
}
const labels = { full: "Fully illegible", partial: "Partially illegible", extent_unknown: "Illegibility noted; extent unknown",
  readable: "Readable / no illegibility noted", blank: "Blank", not_recorded: "Not assessed / not recorded" };
const ranks = { readable: 0, partial: 1, full: 2 };
export function classifyInscription(reading = {}) {
  const text = String(reading.inscription ?? "");
  const status = reading.inscriptionStatus;
  const legibility = reading.currentLegibility;
  let code, basis;
  if (status === "blank" || legibility === "blank" || inscriptionPlaceholder(text) === "blank") {
    code = "blank"; basis = "Blank surface recorded";
  } else if (status === "illegible" || legibility === "illegible" || inscriptionPlaceholder(text) === "illegible") {
    code = "full"; basis = inscriptionPlaceholder(text) ? "Standalone legacy placeholder" : "Whole-face assessment";
  } else if (legibility === "partially_legible") {
    code = "partial"; basis = "Partial-legibility assessment";
  } else if (legibility === "legible") {
    code = "readable"; basis = "Legible assessment";
  } else if (unreadableInscriptionReasons(text).length) {
    // A bare fragment says nothing about how much of the surface is affected.
    const remainder = text.replace(/\[[^\]]*\]/gu, "").replace(/\billegible\b/giu, "");
    code = /[\p{L}\p{N}]/u.test(remainder) ? "partial" : "extent_unknown";
    basis = "Text indication; review extent";
  } else if (text.trim()) {
    code = "readable"; basis = "Transcription without unreadable annotations";
  } else { code = "not_recorded"; basis = "No legibility evidence"; }
  return { code, label: labels[code], basis, text, unreadable: ["full", "partial", "extent_unknown"].includes(code) };
}

export function inspectionReadings(inspection) {
  if (!inspection) return [];
  const faces = Array.isArray(inspection.faces) ? inspection.faces : [];
  const readings = faces.map((face, index) => ({ ...face, kind: "face", label: face.label || `Face ${index + 1}` }));
  const text = String(inspection.inscription ?? "");
  const combined = faces.length === 1 ? faces[0].inscription : faces.map(face => `${face.label}\n${face.inscription}`).join("\n\n");
  if (!faces.length || (text.trim() && text !== combined)) readings.push({ kind: "unassigned", label: "Unassigned inscription", inscription: text });
  return readings;
}
const normalizedLabel = face => String(face.label ?? "").trim().toLowerCase();
export function compareInspectionReadings(latest, previous) {
  const current = inspectionReadings(latest), older = inspectionReadings(previous), used = new Set();
  const pairs = current.map(face => ({ face, old: undefined }));
  // Reserve all stable-ID matches before any label fallback can consume them.
  for (const pair of pairs) {
    const { face } = pair;
    const matches = face.id && current.filter(item => item.id === face.id).length === 1
      ? older.filter(item => item.kind === face.kind && item.id === face.id) : [];
    if (matches.length === 1) { pair.old = matches[0]; used.add(pair.old); }
  }
  for (const pair of pairs) {
    if (pair.old) continue;
    const { face } = pair;
    const matches = current.filter(item => item.kind === face.kind && normalizedLabel(item) === normalizedLabel(face)).length === 1
      ? older.filter(item => item.kind === face.kind && normalizedLabel(item) === normalizedLabel(face)) : [];
    if (matches.length === 1 && !used.has(matches[0])) { pair.old = matches[0]; used.add(pair.old); }
  }
  for (const old of older) if (!used.has(old)) pairs.push({ old });
  return pairs.map(({face, old}) => {
    const now = classifyInscription(face), before = classifyInscription(old);
    let change = "Not comparable", changeReason;
    if (!previous) changeReason = "No previous inspection";
    else if (!face) changeReason = "No matching latest face/reading";
    else if (!old) changeReason = "No matching previous face/reading";
    else if (ranks[now.code] === undefined || ranks[before.code] === undefined) changeReason = "Missing assessment, blank surface, or unknown extent";
    else change = ranks[now.code] > ranks[before.code] ? "Worsened" : ranks[now.code] < ranks[before.code] ? "Improved" : now.text !== before.text ? "Same category; transcription changed" : "Same legibility category";
    return { face, old, now, before, change, changeReason };
  });
}
