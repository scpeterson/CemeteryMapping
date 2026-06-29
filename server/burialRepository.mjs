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

export async function burialMilitaryServiceColumnsExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'veteran'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

async function burialRecordedDateTextColumnsExist(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'birth_date_text'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialRecordedDateTextSql(client, firstSetParameter = 15) {
  if (await burialRecordedDateTextColumnsExist(client)) {
    return {
      select: "burials.birth_date_text, burials.death_date_text",
      set: `birth_date_text = $${firstSetParameter},\n            death_date_text = $${firstSetParameter + 1}`,
      return: "birth_date_text,\n          death_date_text",
      hasColumns: true,
    };
  }

  return {
    select: "NULL::text AS birth_date_text, NULL::text AS death_date_text",
    set: "",
    return: "NULL::text AS birth_date_text,\n          NULL::text AS death_date_text",
    hasColumns: false,
  };
}

export async function legacyBurialMilitaryBranchColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_branch'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function legacyBurialMilitaryWarsColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_wars'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialIntermentTypeLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'burial_interment_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialIntermentTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'interment_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function legacyBurialIntermentTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'interment_type'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialIntermentTypeSql(client) {
  if (await burialIntermentTypeColumnExists(client)) {
    return {
      select: "burial_interment_types.code AS interment_type, burial_interment_types.label AS interment_type_label",
      join: "JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id",
      hasLookup: true,
    };
  }

  if (await legacyBurialIntermentTypeColumnExists(client)) {
    return {
      select: "COALESCE(NULLIF(burials.interment_type, ''), 'casket') AS interment_type, CASE WHEN burials.interment_type = 'urn' THEN 'Funeral urn' ELSE 'Casket' END AS interment_type_label",
      join: "",
      hasLookup: false,
    };
  }

  return {
    select: "'casket'::text AS interment_type, 'Casket'::text AS interment_type_label",
    join: "",
    hasLookup: false,
  };
}

export async function activeIntermentTypeExists(client, code) {
  if (!(await burialIntermentTypeColumnExists(client))) return true;
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_interment_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

export async function burialRecordStatusColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'burial_record_status_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialRecordStatusSql(client) {
  if (await burialRecordStatusColumnExists(client)) {
    return {
      select: "burial_record_status_types.code AS record_status_code, burial_record_status_types.label AS record_status_label",
      join: "JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id",
      hasLookup: true,
    };
  }

  return {
    select: "'interred'::text AS record_status_code, 'Interred'::text AS record_status_label",
    join: "",
    hasLookup: false,
  };
}

export async function activeBurialRecordStatusExists(client, code) {
  if (!(await burialRecordStatusColumnExists(client))) return true;
  const result = await client.query("SELECT EXISTS (SELECT 1 FROM burial_record_status_types WHERE code = $1 AND is_active) AS exists", [code]);
  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryBranchLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_branch_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryBranchTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_branch_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryWarServiceLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_war_service_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryWarServiceTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_war_service_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryRankLookupExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name = 'military_rank_types'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryRankTypeColumnExists(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'burials'
        AND column_name = 'military_rank_type_id'
    ) AS exists
  `);

  return Boolean(result.rows[0]?.exists);
}

export async function burialMilitaryServiceSql(client) {
  if (!(await burialMilitaryServiceColumnsExist(client))) {
    return {
      select:
        "NULL::text AS veteran, NULL::text AS military_branch_code, NULL::text AS military_branch, NULL::text AS military_rank_code, NULL::text AS military_rank, NULL::text AS military_rank_abbreviation, NULL::text AS military_rank_pay_grade, NULL::text AS military_war_service_code, NULL::text AS military_wars",
      join: "",
      hasLookup: false,
    };
  }

  const hasBranchLookup = await burialMilitaryBranchTypeColumnExists(client);
  const hasWarServiceLookup = await burialMilitaryWarServiceTypeColumnExists(client);
  const hasRankLookup = await burialMilitaryRankTypeColumnExists(client);
  const hasLegacyBranchColumn = !hasBranchLookup && (await legacyBurialMilitaryBranchColumnExists(client));
  const hasLegacyWarsColumn = !hasWarServiceLookup && (await legacyBurialMilitaryWarsColumnExists(client));
  const branchCodeSelect = hasBranchLookup ? "military_branch_types.code AS military_branch_code" : "NULL::text AS military_branch_code";
  const branchLabelSelect = hasBranchLookup ? "military_branch_types.label AS military_branch" : hasLegacyBranchColumn ? "burials.military_branch" : "NULL::text AS military_branch";
  const rankCodeSelect = hasRankLookup ? "military_rank_types.code AS military_rank_code" : "NULL::text AS military_rank_code";
  const rankLabelSelect = hasRankLookup ? "military_rank_types.label AS military_rank" : "NULL::text AS military_rank";
  const rankAbbreviationSelect = hasRankLookup ? "military_rank_types.abbreviation AS military_rank_abbreviation" : "NULL::text AS military_rank_abbreviation";
  const rankPayGradeSelect = hasRankLookup ? "military_rank_types.pay_grade AS military_rank_pay_grade" : "NULL::text AS military_rank_pay_grade";
  const warServiceCodeSelect = hasWarServiceLookup ? "military_war_service_types.code AS military_war_service_code" : "NULL::text AS military_war_service_code";
  const warServiceLabelSelect = hasWarServiceLookup ? "military_war_service_types.label AS military_wars" : hasLegacyWarsColumn ? "burials.military_wars" : "NULL::text AS military_wars";
  const branchJoin = hasBranchLookup ? "LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id" : "";
  const rankJoin = hasRankLookup ? "LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id" : "";
  const warServiceJoin = hasWarServiceLookup ? "LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id" : "";

  return {
    select: `burials.veteran, ${branchCodeSelect}, ${branchLabelSelect}, ${rankCodeSelect}, ${rankLabelSelect}, ${rankAbbreviationSelect}, ${rankPayGradeSelect}, ${warServiceCodeSelect}, ${warServiceLabelSelect}`,
    join: [branchJoin, rankJoin, warServiceJoin].filter(Boolean).join("\n"),
    hasLookup: hasBranchLookup || hasRankLookup || hasWarServiceLookup,
  };
}
