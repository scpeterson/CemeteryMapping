--liquibase formatted sql

--changeset cemeterymapping:481-standardize-gravesite-display-labels splitStatements:false
CREATE FUNCTION gravesite_label(section_name text, lot_number text, grave_number text, include_lot boolean DEFAULT false)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string(array_remove(ARRAY[NULLIF(btrim(section_name),''),
    CASE WHEN include_lot THEN NULLIF(btrim(lot_number),'') END,NULLIF(btrim(grave_number),'')],NULL),'-')
$$;
ALTER TABLE gravesites ADD COLUMN display_label text, ADD COLUMN label_aliases text[] NOT NULL DEFAULT '{}';
WITH proposed AS (
  SELECT id,cemetery_id,section_id,lot_id,grave_id,
    gravesite_label(section_id,lot_id,grave_id,true) old_label,
    CASE WHEN NULLIF(btrim(section_id),'') IS NULL OR NULLIF(btrim(grave_id),'') IS NULL THEN gravesite_id
      WHEN count(*) OVER (PARTITION BY cemetery_id,lower(gravesite_label(section_id,lot_id,grave_id)))>1
        THEN gravesite_label(section_id,lot_id,grave_id,true)
      ELSE gravesite_label(section_id,lot_id,grave_id) END new_label
  FROM gravesites WHERE deleted_at IS NULL
)
UPDATE gravesites g SET display_label=p.new_label,
 label_aliases=CASE WHEN p.old_label<>p.new_label THEN ARRAY[p.old_label] ELSE '{}'::text[] END
FROM proposed p WHERE g.id=p.id;
UPDATE gravesites SET display_label=COALESCE(display_label,NULLIF(gravesite_label(section_id,lot_id,grave_id),''),gravesite_id);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM gravesites WHERE deleted_at IS NULL GROUP BY cemetery_id,lower(display_label) HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Gravesite label collisions remain after retaining lot-qualified labels; reconcile before normalization';
  END IF;
END $$;
-- Preserve the administrator-reported old label, even though the current DEV lot is 23.
UPDATE gravesites SET label_aliases=ARRAY(SELECT DISTINCT a FROM unnest(label_aliases||ARRAY['C-52-0270']) a ORDER BY a)
WHERE gravesite_id='TLC-GPS-0270' AND section_id='C' AND grave_id='0270'
 AND cemetery_id IN(SELECT id FROM cemeteries WHERE name='Trinity Lutheran Church Cemetery');
-- Normal writes always populate the derived label through the trigger. Keep this
-- metadata nullable for isolated legacy fixtures that clone indexes without triggers.

CREATE FUNCTION sync_gravesite_display_label() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate text; old_label text; legacy_label text; aliases text[];
BEGIN
  candidate:=COALESCE(NULLIF(gravesite_label(NEW.section_id,NEW.lot_id,NEW.grave_id),''),NEW.gravesite_id);
  IF NEW.deleted_at IS NULL AND EXISTS(SELECT 1 FROM gravesites other
    WHERE other.cemetery_id=NEW.cemetery_id AND other.id<>NEW.id AND other.deleted_at IS NULL
      AND lower(gravesite_label(other.section_id,other.lot_id,other.grave_id))=lower(candidate)) THEN
    candidate:=gravesite_label(NEW.section_id,NEW.lot_id,NEW.grave_id,true);
  END IF;
  aliases:=COALESCE(NEW.label_aliases,'{}'::text[]);
  IF TG_OP='UPDATE' THEN
    aliases:=aliases||OLD.label_aliases;
    IF OLD.display_label IS DISTINCT FROM candidate THEN aliases:=aliases||ARRAY[OLD.display_label]; END IF;
    old_label:=gravesite_label(OLD.section_id,OLD.lot_id,OLD.grave_id,true);
    IF old_label<>candidate THEN aliases:=aliases||ARRAY[old_label]; END IF;
  END IF;
  legacy_label:=gravesite_label(NEW.section_id,NEW.lot_id,NEW.grave_id,true);
  IF legacy_label<>candidate THEN aliases:=aliases||ARRAY[legacy_label]; END IF;
  NEW.display_label:=candidate;
  NEW.label_aliases:=ARRAY(SELECT DISTINCT a FROM unnest(aliases) a WHERE NULLIF(btrim(a),'') IS NOT NULL AND a<>candidate ORDER BY a);
  RETURN NEW;
END $$;
CREATE TRIGGER sync_gravesite_display_label BEFORE INSERT OR UPDATE OF section_id,lot_id,grave_id,cemetery_id,deleted_at,display_label,label_aliases ON gravesites
FOR EACH ROW EXECUTE FUNCTION sync_gravesite_display_label();
CREATE UNIQUE INDEX gravesites_active_display_label_unique ON gravesites(cemetery_id,lower(display_label)) WHERE deleted_at IS NULL;
CREATE INDEX gravesites_label_aliases_idx ON gravesites USING gin(label_aliases);

-- Labels and aliases are presentation metadata; UUIDs, imported IDs and relationships are untouched.
--rollback DROP INDEX gravesites_label_aliases_idx;
--rollback DROP INDEX gravesites_active_display_label_unique;
--rollback DROP TRIGGER sync_gravesite_display_label ON gravesites;
--rollback DROP FUNCTION sync_gravesite_display_label();
--rollback ALTER TABLE gravesites DROP COLUMN label_aliases,DROP COLUMN display_label;
--rollback DROP FUNCTION gravesite_label(text,text,text,boolean);
