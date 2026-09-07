import { compact, normalizeLimit, validConfidence, validStatuses, validSorts } from "./normalization.mjs";
import { toBatch, toSummary, toEntry } from "./reviewMapping.mjs";

export async function listNorthHillsOcrReview(pool, filters = {}) {
  const batchResult = await pool.query(`
    SELECT
      batch.id::text,
      cemetery.name AS cemetery_name,
      batch.source_name,
      batch.imported_by,
      batch.notes,
      batch.created_at,
      count(entry.id) AS entry_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'review') AS review_count,
      count(entry.id) FILTER (WHERE entry.parse_confidence = 'low') AS low_confidence_count,
      count(entry.id) FILTER (WHERE matched.candidate_count > 0) AS matched_count
    FROM north_hills_ocr_import_batches batch
    LEFT JOIN cemeteries cemetery ON cemetery.id = batch.cemetery_id
    LEFT JOIN north_hills_ocr_entries entry ON entry.batch_id = batch.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS candidate_count
      FROM burials burial
      JOIN gravesites gravesite ON gravesite.id = burial.gravesite_uuid
      WHERE gravesite.cemetery_id = entry.cemetery_id
        AND burial.deleted_at IS NULL
        AND (
          (entry.source_page_number IS NOT NULL AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%'))
          OR EXISTS (
            SELECT 1
            FROM unnest(entry.surnames) AS surname(value)
            WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
          )
        )
      LIMIT 1
    ) matched ON true
    GROUP BY batch.id, cemetery.name
    ORDER BY batch.created_at DESC, batch.id
  `);

  const batches = batchResult.rows.map(toBatch);
  const selectedBatchId = compact(filters.batchId) ?? batches[0]?.id;
  if (!selectedBatchId) return { batches, selectedBatchId: "", summary: [], entries: [] };

  const where = ["entry.batch_id = $1"];
  const values = [selectedBatchId];
  const confidence = compact(filters.confidence);
  const status = compact(filters.status);
  const section = compact(filters.section);
  const query = compact(filters.q);
  let sort = validSorts.has(compact(filters.sort)) ? compact(filters.sort) : "review";

  if (confidence && validConfidence.has(confidence)) {
    values.push(confidence);
    where.push(`entry.parse_confidence = $${values.length}`);
  }

  if (status && validStatuses.has(status)) {
    values.push(status);
    where.push(`entry.status = $${values.length}`);
  }

  if (section) {
    values.push(section.toUpperCase());
    where.push(`upper(coalesce(entry.parsed_section_name, '')) = $${values.length}`);
  }

  if (query) {
    const pageNumber = /^\d+$/u.test(query) ? Number.parseInt(query, 10) : undefined;
    if (pageNumber) {
      values.push(pageNumber);
      where.push(`entry.source_page_number = $${values.length}`);
      sort = "page";
    } else {
      values.push(`%${query.toLowerCase()}%`);
      where.push(`(
        lower(coalesce(entry.name_text, '')) LIKE $${values.length}
        OR lower(coalesce(entry.raw_text, '')) LIKE $${values.length}
        OR lower(coalesce(entry.inscription_text, '')) LIKE $${values.length}
      )`);
    }
  }

  const limit = normalizeLimit(filters.limit);
  values.push(limit);
  const limitPlaceholder = `$${values.length}`;

  const summaryResult = await pool.query(
    `
      SELECT entry.parse_confidence, entry.status, count(*) AS count
      FROM north_hills_ocr_entries entry
      WHERE entry.batch_id = $1
      GROUP BY entry.parse_confidence, entry.status
      ORDER BY entry.parse_confidence, entry.status
    `,
    [selectedBatchId],
  );

  const orderBy =
    sort === "page"
      ? `
        entry.source_page_number NULLS LAST,
        entry.source_page_index,
        entry.source_line_start,
        entry.id
      `
      : `
        CASE entry.parse_confidence
          WHEN 'review' THEN 0
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          ELSE 3
        END,
        entry.source_page_number NULLS LAST,
        entry.source_line_start,
        entry.id
      `;

  const entriesResult = await pool.query(
    `
      SELECT
        entry.id::text,
        entry.batch_id::text,
        entry.source_page_number,
        entry.source_page_index,
        entry.source_line_start,
        entry.source_line_end,
        entry.name_text,
        entry.surnames,
        entry.raw_text,
        entry.parsed_section_name,
        entry.parsed_row_number,
        entry.parsed_position_number,
        entry.parsed_marker_scope,
        entry.marker_type_text,
        entry.material_text,
        entry.condition_text,
        entry.inscription_text,
        entry.parsed_years,
        entry.parse_confidence,
        entry.parse_notes,
        entry.status,
        COALESCE(matches.candidate_match_count, 0) AS candidate_match_count,
        COALESCE(matches.candidate_matches, '[]'::jsonb) AS candidate_matches,
        COALESCE(source_facts.facts, '[]'::jsonb) AS source_facts,
        COALESCE(observations.observations, '[]'::jsonb) AS observations
      FROM north_hills_ocr_entries entry
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', fact.id::text,
            'entryId', fact.entry_id::text,
            'sourceCode', fact.source_code,
            'sourceLabel', fact.source_label,
            'factType', fact.fact_type,
            'factValue', fact.fact_value,
            'factDate', fact.fact_date,
            'rawText', fact.raw_text,
            'reviewNotes', fact.review_notes,
            'confidence', fact.confidence,
            'status', fact.status,
            'promotedBurialId', fact.promoted_burial_uuid::text,
            'reviewedByEmail', fact.reviewed_by_email,
            'reviewedAt', fact.reviewed_at
          )
          ORDER BY
            CASE fact.fact_type
              WHEN 'death_date' THEN 0
              WHEN 'middle_initial' THEN 1
              WHEN 'age_at_death' THEN 2
              ELSE 3
            END,
            fact.source_code,
            fact.fact_value
        ) AS facts
        FROM north_hills_ocr_source_facts fact
        WHERE fact.entry_id = entry.id
      ) source_facts ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', observation.id::text,
            'entryId', observation.entry_id::text,
            'observationType', observation.observation_type,
            'observationText', observation.observation_text,
            'status', observation.status,
            'createdAt', observation.created_at,
            'updatedAt', observation.updated_at
          )
          ORDER BY observation.observation_type, observation.created_at, observation.id
        ) AS observations
        FROM north_hills_ocr_entry_observations observation
        WHERE observation.entry_id = entry.id
      ) observations ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS candidate_match_count,
               jsonb_agg(
                 jsonb_build_object(
                   'burialId', candidate.burial_id,
                   'gravesiteUuid', candidate.gravesite_uuid,
                   'gravesiteId', candidate.gravesite_id,
                   'graveId', candidate.grave_id,
                   'sectionId', candidate.section_id,
                   'fullName', candidate.full_name,
                   'birthDate', candidate.birth_date,
                   'deathDate', candidate.death_date,
                   'score', candidate.score,
                   'notes', candidate.notes,
                   'gravesiteEvidence', candidate.gravesite_evidence,
                   'headstoneCandidates', candidate.headstone_candidates
                 )
                 ORDER BY candidate.score DESC, candidate.full_name
               ) AS candidate_matches
        FROM (
          SELECT
            burial.id::text AS burial_id,
            gravesite.id::text AS gravesite_uuid,
            gravesite.gravesite_id,
            gravesite.grave_id,
            gravesite.section_id,
            burial.full_name,
            COALESCE(burial.birth_date_text, burial.birth_date::text) AS birth_date,
            COALESCE(burial.death_date_text, burial.death_date::text) AS death_date,
            burial.notes,
            COALESCE(gravesite_evidence.evidence, '[]'::jsonb) AS gravesite_evidence,
            COALESCE(headstone_candidates.candidates, '[]'::jsonb) AS headstone_candidates,
            (
              CASE
                WHEN entry.source_page_number IS NOT NULL
                  AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%')
                THEN 4 ELSE 0
              END
              +
              CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM unnest(entry.surnames) AS surname(value)
                  WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
                )
                THEN 3 ELSE 0
              END
              +
              CASE
                WHEN (EXTRACT(YEAR FROM burial.birth_date)::int = ANY(entry.parsed_years))
                  OR (EXTRACT(YEAR FROM burial.death_date)::int = ANY(entry.parsed_years))
                  OR (substring(burial.birth_date_text from '([0-9]{4})')::int = ANY(entry.parsed_years))
                  OR (substring(burial.death_date_text from '([0-9]{4})')::int = ANY(entry.parsed_years))
                THEN 2 ELSE 0
              END
            ) AS score
          FROM burials burial
          JOIN gravesites gravesite ON gravesite.id = burial.gravesite_uuid
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', gravesite_link.id::text,
                'status', gravesite_link.status,
                'confidence', gravesite_link.confidence,
                'notes', gravesite_link.notes,
                'reviewedByEmail', gravesite_link.reviewed_by_email,
                'reviewedAt', gravesite_link.reviewed_at
              )
              ORDER BY gravesite_link.reviewed_at DESC, gravesite_link.id
            ) AS evidence
            FROM north_hills_ocr_entry_gravesite_links gravesite_link
            WHERE gravesite_link.entry_id = entry.id
              AND gravesite_link.gravesite_uuid = gravesite.id
          ) gravesite_evidence ON true
          LEFT JOIN LATERAL (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', candidate_headstone.id::text,
                'headstoneId', candidate_headstone.headstone_id,
                'evidence', COALESCE(headstone_evidence.evidence, '[]'::jsonb)
              )
              ORDER BY candidate_headstone.headstone_id, candidate_headstone.id
            ) AS candidates
            FROM (
              SELECT DISTINCT candidate_headstone.id, candidate_headstone.headstone_id
              FROM headstones candidate_headstone
              LEFT JOIN headstone_gravesites candidate_headstone_grave
                ON candidate_headstone_grave.headstone_uuid = candidate_headstone.id
               AND candidate_headstone_grave.deleted_at IS NULL
              LEFT JOIN headstone_burials candidate_headstone_burial
                ON candidate_headstone_burial.headstone_uuid = candidate_headstone.id
               AND candidate_headstone_burial.deleted_at IS NULL
              WHERE candidate_headstone.deleted_at IS NULL
                AND (
                  candidate_headstone.gravesite_uuid = gravesite.id
                  OR candidate_headstone_grave.gravesite_uuid = gravesite.id
                  OR candidate_headstone_burial.burial_uuid = burial.id
                )
            ) candidate_headstone
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'id', headstone_link.id::text,
                  'status', headstone_link.status,
                  'confidence', headstone_link.confidence,
                  'notes', headstone_link.notes,
                  'reviewedByEmail', headstone_link.reviewed_by_email,
                  'reviewedAt', headstone_link.reviewed_at
                )
                ORDER BY headstone_link.reviewed_at DESC, headstone_link.id
              ) AS evidence
              FROM north_hills_ocr_entry_headstone_links headstone_link
              WHERE headstone_link.entry_id = entry.id
                AND headstone_link.headstone_uuid = candidate_headstone.id
            ) headstone_evidence ON true
          ) headstone_candidates ON true
          WHERE gravesite.cemetery_id = entry.cemetery_id
            AND burial.deleted_at IS NULL
            AND (
              (entry.source_page_number IS NOT NULL AND burial.notes ILIKE ('%' || 'North Hills Genealogists page: ' || entry.source_page_number::text || '%'))
              OR EXISTS (
                SELECT 1
                FROM unnest(entry.surnames) AS surname(value)
                WHERE lower(coalesce(burial.full_name, burial.last_name, '')) LIKE '%' || lower(surname.value) || '%'
              )
            )
          ORDER BY score DESC, burial.full_name
          LIMIT 5
        ) candidate
      ) matches ON true
      WHERE ${where.join("\n        AND ")}
      ORDER BY ${orderBy}
      LIMIT ${limitPlaceholder}
    `,
    values,
  );

  return {
    batches,
    selectedBatchId,
    summary: summaryResult.rows.map(toSummary),
    entries: entriesResult.rows.map(toEntry),
  };
}

