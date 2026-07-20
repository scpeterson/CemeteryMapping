import { BadRequestError } from "./requestValidation.mjs";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function requiredText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) throw new BadRequestError(`${label} is required.`);
  if (text.length > maxLength) throw new BadRequestError(`${label} is too long.`);
  return text;
}

export function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (text.length > maxLength) throw new BadRequestError(`${label} is too long.`);
  return text;
}

export function optionalCoordinate(value, label, { min, max }) {
  const text = optionalText(value, label, 50);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) throw new BadRequestError(`${label} is invalid.`);
  return number;
}

export function validateUuid(value, label) {
  const text = String(value ?? "").trim();
  if (!uuidPattern.test(text)) throw new BadRequestError(`${label} must be a UUID.`);
  return text;
}

export function validateIdentifierList(value, label, maxItems = 100) {
  const identifiers = Array.isArray(value) ? value.map((item) => String(item ?? "").trim()).filter(Boolean) : [];
  const uniqueIdentifiers = [...new Set(identifiers)];
  if (uniqueIdentifiers.length === 0) throw new BadRequestError(`${label} is required.`);
  if (uniqueIdentifiers.length > maxItems) throw new BadRequestError(`${label} can include at most ${maxItems} records.`);
  uniqueIdentifiers.forEach((identifier) => {
    if (identifier.length > 100) throw new BadRequestError(`${label} contains an identifier that is too long.`);
  });
  return uniqueIdentifiers;
}
