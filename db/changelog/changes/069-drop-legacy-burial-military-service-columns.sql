--liquibase formatted sql

--changeset cemeterymapping:069-drop-legacy-burial-military-service-columns splitStatements:false
UPDATE burials
SET military_branch_type_id = military_branch_types.id
FROM military_branch_types
WHERE burials.military_branch_type_id IS NULL
  AND military_branch_types.code = CASE
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('army', 'u.s. army', 'us army', 'united states army') THEN 'army'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('marine corps', 'marines', 'u.s. marine corps', 'us marine corps', 'united states marine corps') THEN 'marine_corps'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('navy', 'u.s. navy', 'us navy', 'united states navy') THEN 'navy'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('air force', 'u.s. air force', 'us air force', 'united states air force') THEN 'air_force'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('space force', 'u.s. space force', 'us space force', 'united states space force') THEN 'space_force'
    WHEN lower(btrim(COALESCE(burials.military_branch, ''))) IN ('coast guard', 'u.s. coast guard', 'us coast guard', 'united states coast guard') THEN 'coast_guard'
    ELSE NULL
  END;

UPDATE burials
SET military_war_service_type_id = military_war_service_types.id
FROM military_war_service_types
WHERE burials.military_war_service_type_id IS NULL
  AND military_war_service_types.code = CASE
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('american revolutionary war', 'revolutionary war') THEN 'revolutionary_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) = 'war of 1812' THEN 'war_of_1812'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('mexican-american war', 'mexican american war') THEN 'mexican_american_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('civil war', 'american civil war') THEN 'civil_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('spanish-american war', 'spanish american war') THEN 'spanish_american_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('philippine-american war', 'philippine american war') THEN 'philippine_american_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('world war i', 'wwi', 'ww1') THEN 'world_war_i'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('world war ii', 'wwii', 'ww2') THEN 'world_war_ii'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) = 'korean war' THEN 'korean_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) = 'vietnam war' THEN 'vietnam_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('gulf war', 'persian gulf war') THEN 'gulf_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('afghanistan war', 'war in afghanistan') THEN 'afghanistan_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) = 'iraq war' THEN 'iraq_war'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('global war on terror', 'global war on terrorism', 'gwot') THEN 'global_war_on_terror'
    WHEN lower(btrim(COALESCE(burials.military_wars, ''))) IN ('peacetime', 'peacetime service') THEN 'peacetime'
    ELSE NULL
  END;

DROP INDEX IF EXISTS burials_military_branch_trgm_idx;
DROP INDEX IF EXISTS burials_military_wars_trgm_idx;

ALTER TABLE burials
  DROP COLUMN IF EXISTS military_branch,
  DROP COLUMN IF EXISTS military_wars;

--rollback ALTER TABLE burials ADD COLUMN IF NOT EXISTS military_branch varchar(100), ADD COLUMN IF NOT EXISTS military_wars varchar(500);
--rollback UPDATE burials SET military_branch = military_branch_types.label FROM military_branch_types WHERE military_branch_types.id = burials.military_branch_type_id;
--rollback UPDATE burials SET military_wars = military_war_service_types.label FROM military_war_service_types WHERE military_war_service_types.id = burials.military_war_service_type_id;
--rollback CREATE INDEX IF NOT EXISTS burials_military_branch_trgm_idx ON burials USING gin (lower(military_branch) gin_trgm_ops);
--rollback CREATE INDEX IF NOT EXISTS burials_military_wars_trgm_idx ON burials USING gin (lower(military_wars) gin_trgm_ops);
