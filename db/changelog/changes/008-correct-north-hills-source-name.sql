--liquibase formatted sql

--changeset scpeterson:008-correct-north-hills-source-name splitStatements:false
UPDATE burials
SET notes = replace(notes, 'North Hills Guide', 'North Hills Geneologists'),
    updated_at = now()
WHERE notes LIKE '%North Hills Guide%';

--rollback UPDATE burials SET notes = replace(notes, 'North Hills Geneologists', 'North Hills Guide'), updated_at = now() WHERE notes LIKE '%North Hills Geneologists%';
