--liquibase formatted sql

--changeset scpeterson:009-correct-north-hills-genealogists-spelling splitStatements:false
UPDATE burials
SET notes = replace(replace(notes, 'North Hills Guide', 'North Hills Genealogists'), 'North Hills Geneologists', 'North Hills Genealogists'),
    updated_at = now()
WHERE notes LIKE '%North Hills Guide%'
   OR notes LIKE '%North Hills Geneologists%';

--rollback UPDATE burials SET notes = replace(notes, 'North Hills Genealogists', 'North Hills Geneologists'), updated_at = now() WHERE notes LIKE '%North Hills Genealogists%';
