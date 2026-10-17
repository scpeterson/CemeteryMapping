--liquibase formatted sql

--changeset cemeterymapping:438-access-request-capacity-index
CREATE INDEX access_requests_created_at ON access_requests (created_at);

--rollback DROP INDEX access_requests_created_at;
