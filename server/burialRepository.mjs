const recordedDateMonths = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"],
]);

export function splitRecordedDate(value) {
  const text = String(value ?? "").trim();
  if (!text) return { date: null, text: null };
  if (/^\d{4}-\d{2}-\d{2}$/u.test(text)) return { date: text, text };
  const monthDayYear = text.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/u);
  if (monthDayYear) {
    const month = recordedDateMonths.get(monthDayYear[1].toLowerCase());
    const day = Number(monthDayYear[2]);
    const year = Number(monthDayYear[3]);
    if (month && day >= 1 && day <= 31 && year >= 1000 && year <= 9999) {
      return { date: `${monthDayYear[3]}-${month}-${String(day).padStart(2, "0")}`, text };
    }
  }
  return { date: null, text };
}

export function burialDeathPlaceSql() {
  return {
    select: `death_places.id::text AS death_place_id,
        death_places.display_name AS death_place_name,
        death_places.locality AS death_place_locality,
        death_places.administrative_area AS death_place_administrative_area,
        death_places.country_name AS death_place_country_name,
        death_places.country_code AS death_place_country_code,
        death_places.authority_name AS death_place_authority_name,
        death_places.authority_identifier AS death_place_authority_identifier,
        death_places.authority_url AS death_place_authority_url,
        death_places.verification_status AS death_place_verification_status`,
    join: `LEFT JOIN places AS death_places
        ON death_places.id = burials.death_place_uuid
       AND death_places.deleted_at IS NULL
       AND death_places.is_active`,
  };
}

export function burialRecordedDateTextSql(firstSetParameter = 15) {
  return {
    select: "burials.birth_date_text, burials.death_date_text",
    set: `birth_date_text = $${firstSetParameter},\n            death_date_text = $${firstSetParameter + 1}`,
    return: "birth_date_text,\n          death_date_text",
  };
}

export function burialIntermentTypeSql() {
  return {
    select: "burial_interment_types.code AS interment_type, burial_interment_types.label AS interment_type_label",
    join: "JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id",
  };
}

export async function activeIntermentTypeExists(client, code) {
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_interment_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

export function burialRecordStatusSql() {
  return {
    select: "burial_record_status_types.code AS record_status_code, burial_record_status_types.label AS record_status_label",
    join: "JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id",
  };
}

export async function activeBurialRecordStatusExists(client, code) {
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_record_status_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

export function burialMilitaryServiceSql() {
  const branchCodeSelect = "military_branch_types.code AS military_branch_code";
  const branchLabelSelect = "military_branch_types.label AS military_branch";
  const rankCodeSelect = "military_rank_types.code AS military_rank_code";
  const rankLabelSelect = "military_rank_types.label AS military_rank";
  const rankAbbreviationSelect = "military_rank_types.abbreviation AS military_rank_abbreviation";
  const rankPayGradeSelect = "military_rank_types.pay_grade AS military_rank_pay_grade";
  const warServiceCodeSelect = "military_war_service_types.code AS military_war_service_code";
  const warServiceLabelSelect = "military_war_service_types.label AS military_wars";
  const branchJoin = "LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id";
  const rankJoin = "LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id";
  const warServiceJoin = "LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id";

  return {
    select: `burials.veteran, ${branchCodeSelect}, ${branchLabelSelect}, ${rankCodeSelect}, ${rankLabelSelect}, ${rankAbbreviationSelect}, ${rankPayGradeSelect}, ${warServiceCodeSelect}, ${warServiceLabelSelect}, burials.military_enlisted_date, burials.military_discharged_date`,
    join: [branchJoin, rankJoin, warServiceJoin].filter(Boolean).join("\n"),
  };
}
