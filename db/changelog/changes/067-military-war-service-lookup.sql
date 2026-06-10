--liquibase formatted sql

--changeset cemeterymapping:067-military-war-service-lookup splitStatements:false
CREATE TABLE IF NOT EXISTS military_war_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO military_war_service_types (code, label, description, sort_order)
VALUES
  ('revolutionary_war', 'American Revolutionary War', 'Service connected with the American Revolutionary War.', 10),
  ('war_of_1812', 'War of 1812', 'Service connected with the War of 1812.', 20),
  ('mexican_american_war', 'Mexican-American War', 'Service connected with the Mexican-American War.', 30),
  ('civil_war', 'Civil War', 'Service connected with the American Civil War.', 40),
  ('spanish_american_war', 'Spanish-American War', 'Service connected with the Spanish-American War.', 50),
  ('philippine_american_war', 'Philippine-American War', 'Service connected with the Philippine-American War.', 60),
  ('world_war_i', 'World War I', 'Service connected with World War I.', 70),
  ('world_war_ii', 'World War II', 'Service connected with World War II.', 80),
  ('korean_war', 'Korean War', 'Service connected with the Korean War.', 90),
  ('vietnam_war', 'Vietnam War', 'Service connected with the Vietnam War.', 100),
  ('gulf_war', 'Gulf War', 'Service connected with the Gulf War.', 110),
  ('afghanistan_war', 'Afghanistan War', 'Service connected with the war in Afghanistan.', 120),
  ('iraq_war', 'Iraq War', 'Service connected with the Iraq War.', 130),
  ('global_war_on_terror', 'Global War on Terror', 'Service connected with the Global War on Terror.', 140),
  ('peacetime', 'Peacetime service', 'Military service not currently tied to a recorded war or conflict.', 900),
  ('other', 'Other / not listed', 'War or conflict service that is not represented by the current controlled list.', 910)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS military_war_service_type_id uuid REFERENCES military_war_service_types(id);

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

CREATE INDEX IF NOT EXISTS burials_military_war_service_type_id_idx
  ON burials (military_war_service_type_id);

DROP TRIGGER IF EXISTS touch_military_war_service_types_updated_at ON military_war_service_types;
CREATE TRIGGER touch_military_war_service_types_updated_at
  BEFORE UPDATE ON military_war_service_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_military_war_service_types_changes ON military_war_service_types;
CREATE TRIGGER audit_military_war_service_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON military_war_service_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_military_war_service_types_changes ON military_war_service_types;
--rollback DROP TRIGGER IF EXISTS touch_military_war_service_types_updated_at ON military_war_service_types;
--rollback DROP INDEX IF EXISTS burials_military_war_service_type_id_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS military_war_service_type_id;
--rollback DROP TABLE IF EXISTS military_war_service_types;
