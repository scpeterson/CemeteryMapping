--liquibase formatted sql

--changeset cemeterymapping:017-section-notes-and-trinity-f-g splitStatements:false
ALTER TABLE sections
  ADD COLUMN IF NOT EXISTS notes varchar(4000),
  ALTER COLUMN geometry DROP NOT NULL;

WITH trinity AS (
  SELECT id, facility_id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
section_notes(section_name, note_text) AS (
  VALUES
    ('A', $$Section A, also called "NA" (New Annex) in some church records, has plots numbered 1 - 9, 30 - 38 and 52 - 69.  Several plots have also been sold in the old carriage passageway between numbered plots.$$),
    ('B', $$Section B, also called "OC" (Original Cemetery)in some church records, has plots numbered 1-24. As of 2024, there is no record of any deeds being issued for potential plots in any of the three Section B passageways (some of which have underground utility lines).$$),
    ('C', $$Section C, also called "NA" (New Annex) in some church records, has plots numbered 10 - 119, with many gaps and also duplications with Sections A and D.  Many deeds have also been issued for plots in the three carriage passageways in Section C$$),
    ('D', $$Section D, also called "OC" (Original Cemetery") in some church records, has plots numbered 25-38, 47-58 and 67,68 and 77.  As of 2024, there is no record of any deeds being issued for passageway plots in Section D.$$),
    ('E', $$Section E is the oldest part of the cemetery.  Plot plans are largely nonexistent. As of 2024, it is believed Section E is "full," with no unused burial rights.$$),
    ('F', $$Section F is a narrow strip between the church and Brandt School Road.  As of 2024, no deeds have been issued for Section F due to underground utility lines.$$),
    ('G', $$Section G is the newest section.  It has plots numbered G1-G94.  All deeds for this section were issued on or after March 2021, and indicate they are for Section G.$$)
)
INSERT INTO sections (cemetery_id, name, facility_id, notes, geometry)
SELECT trinity.id, section_notes.section_name, trinity.facility_id, section_notes.note_text, NULL::geometry(MultiPolygon, 4326)
FROM trinity
JOIN section_notes ON section_notes.section_name IN ('F', 'G')
ON CONFLICT (cemetery_id, name) DO UPDATE
SET notes = EXCLUDED.notes;

WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
section_notes(section_name, note_text) AS (
  VALUES
    ('A', $$Section A, also called "NA" (New Annex) in some church records, has plots numbered 1 - 9, 30 - 38 and 52 - 69.  Several plots have also been sold in the old carriage passageway between numbered plots.$$),
    ('B', $$Section B, also called "OC" (Original Cemetery)in some church records, has plots numbered 1-24. As of 2024, there is no record of any deeds being issued for potential plots in any of the three Section B passageways (some of which have underground utility lines).$$),
    ('C', $$Section C, also called "NA" (New Annex) in some church records, has plots numbered 10 - 119, with many gaps and also duplications with Sections A and D.  Many deeds have also been issued for plots in the three carriage passageways in Section C$$),
    ('D', $$Section D, also called "OC" (Original Cemetery") in some church records, has plots numbered 25-38, 47-58 and 67,68 and 77.  As of 2024, there is no record of any deeds being issued for passageway plots in Section D.$$),
    ('E', $$Section E is the oldest part of the cemetery.  Plot plans are largely nonexistent. As of 2024, it is believed Section E is "full," with no unused burial rights.$$),
    ('F', $$Section F is a narrow strip between the church and Brandt School Road.  As of 2024, no deeds have been issued for Section F due to underground utility lines.$$),
    ('G', $$Section G is the newest section.  It has plots numbered G1-G94.  All deeds for this section were issued on or after March 2021, and indicate they are for Section G.$$)
)
UPDATE sections
SET notes = section_notes.note_text
FROM trinity, section_notes
WHERE sections.cemetery_id = trinity.id
  AND sections.name = section_notes.section_name
  AND sections.deleted_at IS NULL;

--rollback DELETE FROM sections WHERE name IN ('F', 'G') AND geometry IS NULL;
--rollback ALTER TABLE sections ALTER COLUMN geometry SET NOT NULL, DROP COLUMN IF EXISTS notes;
