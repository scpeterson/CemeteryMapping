--liquibase formatted sql

--changeset cemeterymapping:224-headstone-gravesite-secondary-relationships splitStatements:false
ALTER TABLE headstone_gravesites
  DROP CONSTRAINT IF EXISTS headstone_gravesites_relationship_type_check;

ALTER TABLE headstone_gravesites
  ADD CONSTRAINT headstone_gravesites_relationship_type_check CHECK (
    relationship_type IN ('primary', 'spans', 'nearby', 'inferred', 'footstone', 'secondary')
  );

--rollback ALTER TABLE headstone_gravesites DROP CONSTRAINT IF EXISTS headstone_gravesites_relationship_type_check;
--rollback ALTER TABLE headstone_gravesites ADD CONSTRAINT headstone_gravesites_relationship_type_check CHECK (relationship_type IN ('primary', 'spans', 'nearby', 'inferred'));
