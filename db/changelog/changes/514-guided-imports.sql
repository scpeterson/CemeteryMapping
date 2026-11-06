--liquibase formatted sql

--changeset cemeterymapping:514-guided-imports
CREATE TABLE cemetery_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cemetery_id uuid NOT NULL REFERENCES cemeteries(id),
 kind text NOT NULL CHECK(kind IN ('gravesites','burials')),
 source_name varchar(250) NOT NULL,
 source_sha256 char(64) NOT NULL,
 source_text text NOT NULL,
 records jsonb NOT NULL,
 review jsonb NOT NULL,
 status text NOT NULL DEFAULT 'staged' CHECK(status IN ('staged','approved','rejected')),
 created_by_subject varchar(300) NOT NULL,
 reviewed_by_subject varchar(300),
 review_reason varchar(500),
 created_records jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz
);
CREATE INDEX cemetery_import_batches_queue ON cemetery_import_batches(cemetery_id,created_at DESC,id);
--rollback DROP TABLE cemetery_import_batches;
