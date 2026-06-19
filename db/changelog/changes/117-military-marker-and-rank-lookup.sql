--liquibase formatted sql

--changeset cemeterymapping:117-military-marker-and-rank-lookup splitStatements:false
INSERT INTO marker_types (code, label, description, source_notes, source_url, sort_order)
VALUES (
  'military_marker',
  'Military marker',
  'A government-issued or military-service marker identifying a veteran''s service.',
  'VA marker categories include government-furnished headstones, markers, niche markers, and medallions for eligible veterans.',
  'https://www.cem.va.gov/hmm/types.asp',
  165
)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

CREATE TABLE IF NOT EXISTS military_rank_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  military_branch_type_id uuid NOT NULL REFERENCES military_branch_types(id),
  code varchar(50) NOT NULL,
  label varchar(100) NOT NULL,
  abbreviation varchar(20) NOT NULL,
  pay_grade varchar(10),
  rank_group varchar(30) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT military_rank_types_branch_code_unique UNIQUE (military_branch_type_id, code)
);

WITH ranks(branch_code, code, label, abbreviation, pay_grade, rank_group, sort_order) AS (
  VALUES
    ('army', 'pvt', 'Private', 'PVT', 'E-1', 'enlisted', 10),
    ('army', 'pv2', 'Private', 'PV2', 'E-2', 'enlisted', 20),
    ('army', 'pfc', 'Private First Class', 'PFC', 'E-3', 'enlisted', 30),
    ('army', 'spc', 'Specialist', 'SPC', 'E-4', 'enlisted', 40),
    ('army', 'cpl', 'Corporal', 'CPL', 'E-4', 'enlisted', 41),
    ('army', 'sgt', 'Sergeant', 'SGT', 'E-5', 'enlisted', 50),
    ('army', 'ssg', 'Staff Sergeant', 'SSG', 'E-6', 'enlisted', 60),
    ('army', 'sfc', 'Sergeant First Class', 'SFC', 'E-7', 'enlisted', 70),
    ('army', 'msg', 'Master Sergeant', 'MSG', 'E-8', 'enlisted', 80),
    ('army', '1sg', 'First Sergeant', '1SG', 'E-8', 'enlisted', 81),
    ('army', 'sgm', 'Sergeant Major', 'SGM', 'E-9', 'enlisted', 90),
    ('army', 'csm', 'Command Sergeant Major', 'CSM', 'E-9', 'enlisted', 91),
    ('army', 'sma', 'Sergeant Major of the Army', 'SMA', 'E-9', 'enlisted', 92),
    ('army', 'wo1', 'Warrant Officer 1', 'WO1', 'W-1', 'warrant_officer', 110),
    ('army', 'cw2', 'Chief Warrant Officer 2', 'CW2', 'W-2', 'warrant_officer', 120),
    ('army', 'cw3', 'Chief Warrant Officer 3', 'CW3', 'W-3', 'warrant_officer', 130),
    ('army', 'cw4', 'Chief Warrant Officer 4', 'CW4', 'W-4', 'warrant_officer', 140),
    ('army', 'cw5', 'Chief Warrant Officer 5', 'CW5', 'W-5', 'warrant_officer', 150),
    ('army', '2lt', 'Second Lieutenant', '2LT', 'O-1', 'officer', 210),
    ('army', '1lt', 'First Lieutenant', '1LT', 'O-2', 'officer', 220),
    ('army', 'cpt', 'Captain', 'CPT', 'O-3', 'officer', 230),
    ('army', 'maj', 'Major', 'MAJ', 'O-4', 'officer', 240),
    ('army', 'ltc', 'Lieutenant Colonel', 'LTC', 'O-5', 'officer', 250),
    ('army', 'col', 'Colonel', 'COL', 'O-6', 'officer', 260),
    ('army', 'bg', 'Brigadier General', 'BG', 'O-7', 'officer', 270),
    ('army', 'mg', 'Major General', 'MG', 'O-8', 'officer', 280),
    ('army', 'ltg', 'Lieutenant General', 'LTG', 'O-9', 'officer', 290),
    ('army', 'gen', 'General', 'GEN', 'O-10', 'officer', 300),
    ('marine_corps', 'pvt', 'Private', 'Pvt', 'E-1', 'enlisted', 10),
    ('marine_corps', 'pfc', 'Private First Class', 'PFC', 'E-2', 'enlisted', 20),
    ('marine_corps', 'lcpl', 'Lance Corporal', 'LCpl', 'E-3', 'enlisted', 30),
    ('marine_corps', 'cpl', 'Corporal', 'Cpl', 'E-4', 'enlisted', 40),
    ('marine_corps', 'sgt', 'Sergeant', 'Sgt', 'E-5', 'enlisted', 50),
    ('marine_corps', 'ssgt', 'Staff Sergeant', 'SSgt', 'E-6', 'enlisted', 60),
    ('marine_corps', 'gysgt', 'Gunnery Sergeant', 'GySgt', 'E-7', 'enlisted', 70),
    ('marine_corps', 'msgt', 'Master Sergeant', 'MSgt', 'E-8', 'enlisted', 80),
    ('marine_corps', '1stsgt', 'First Sergeant', '1stSgt', 'E-8', 'enlisted', 81),
    ('marine_corps', 'mgysgt', 'Master Gunnery Sergeant', 'MGySgt', 'E-9', 'enlisted', 90),
    ('marine_corps', 'sgtmaj', 'Sergeant Major', 'SgtMaj', 'E-9', 'enlisted', 91),
    ('marine_corps', 'smmc', 'Sergeant Major of the Marine Corps', 'SMMC', 'E-9', 'enlisted', 92),
    ('marine_corps', 'wo', 'Warrant Officer', 'WO', 'W-1', 'warrant_officer', 110),
    ('marine_corps', 'cwo2', 'Chief Warrant Officer 2', 'CWO2', 'W-2', 'warrant_officer', 120),
    ('marine_corps', 'cwo3', 'Chief Warrant Officer 3', 'CWO3', 'W-3', 'warrant_officer', 130),
    ('marine_corps', 'cwo4', 'Chief Warrant Officer 4', 'CWO4', 'W-4', 'warrant_officer', 140),
    ('marine_corps', 'cwo5', 'Chief Warrant Officer 5', 'CWO5', 'W-5', 'warrant_officer', 150),
    ('marine_corps', '2ndlt', 'Second Lieutenant', '2ndLt', 'O-1', 'officer', 210),
    ('marine_corps', '1stlt', 'First Lieutenant', '1stLt', 'O-2', 'officer', 220),
    ('marine_corps', 'capt', 'Captain', 'Capt', 'O-3', 'officer', 230),
    ('marine_corps', 'maj', 'Major', 'Maj', 'O-4', 'officer', 240),
    ('marine_corps', 'ltcol', 'Lieutenant Colonel', 'LtCol', 'O-5', 'officer', 250),
    ('marine_corps', 'col', 'Colonel', 'Col', 'O-6', 'officer', 260),
    ('marine_corps', 'bgen', 'Brigadier General', 'BGen', 'O-7', 'officer', 270),
    ('marine_corps', 'majgen', 'Major General', 'MajGen', 'O-8', 'officer', 280),
    ('marine_corps', 'ltgen', 'Lieutenant General', 'LtGen', 'O-9', 'officer', 290),
    ('marine_corps', 'gen', 'General', 'Gen', 'O-10', 'officer', 300),
    ('navy', 'sr', 'Seaman Recruit', 'SR', 'E-1', 'enlisted', 10),
    ('navy', 'sa', 'Seaman Apprentice', 'SA', 'E-2', 'enlisted', 20),
    ('navy', 'sn', 'Seaman', 'SN', 'E-3', 'enlisted', 30),
    ('navy', 'po3', 'Petty Officer Third Class', 'PO3', 'E-4', 'enlisted', 40),
    ('navy', 'po2', 'Petty Officer Second Class', 'PO2', 'E-5', 'enlisted', 50),
    ('navy', 'po1', 'Petty Officer First Class', 'PO1', 'E-6', 'enlisted', 60),
    ('navy', 'cpo', 'Chief Petty Officer', 'CPO', 'E-7', 'enlisted', 70),
    ('navy', 'scpo', 'Senior Chief Petty Officer', 'SCPO', 'E-8', 'enlisted', 80),
    ('navy', 'mcpo', 'Master Chief Petty Officer', 'MCPO', 'E-9', 'enlisted', 90),
    ('navy', 'mcpon', 'Master Chief Petty Officer of the Navy', 'MCPON', 'E-9', 'enlisted', 91),
    ('navy', 'wo1', 'Warrant Officer 1', 'WO1', 'W-1', 'warrant_officer', 110),
    ('navy', 'cwo2', 'Chief Warrant Officer 2', 'CWO2', 'W-2', 'warrant_officer', 120),
    ('navy', 'cwo3', 'Chief Warrant Officer 3', 'CWO3', 'W-3', 'warrant_officer', 130),
    ('navy', 'cwo4', 'Chief Warrant Officer 4', 'CWO4', 'W-4', 'warrant_officer', 140),
    ('navy', 'cwo5', 'Chief Warrant Officer 5', 'CWO5', 'W-5', 'warrant_officer', 150),
    ('navy', 'ens', 'Ensign', 'ENS', 'O-1', 'officer', 210),
    ('navy', 'ltjg', 'Lieutenant Junior Grade', 'LTJG', 'O-2', 'officer', 220),
    ('navy', 'lt', 'Lieutenant', 'LT', 'O-3', 'officer', 230),
    ('navy', 'lcdr', 'Lieutenant Commander', 'LCDR', 'O-4', 'officer', 240),
    ('navy', 'cdr', 'Commander', 'CDR', 'O-5', 'officer', 250),
    ('navy', 'capt', 'Captain', 'CAPT', 'O-6', 'officer', 260),
    ('navy', 'rdml', 'Rear Admiral Lower Half', 'RDML', 'O-7', 'officer', 270),
    ('navy', 'radm', 'Rear Admiral Upper Half', 'RADM', 'O-8', 'officer', 280),
    ('navy', 'vadm', 'Vice Admiral', 'VADM', 'O-9', 'officer', 290),
    ('navy', 'adm', 'Admiral', 'ADM', 'O-10', 'officer', 300),
    ('air_force', 'ab', 'Airman Basic', 'AB', 'E-1', 'enlisted', 10),
    ('air_force', 'amn', 'Airman', 'Amn', 'E-2', 'enlisted', 20),
    ('air_force', 'a1c', 'Airman First Class', 'A1C', 'E-3', 'enlisted', 30),
    ('air_force', 'sra', 'Senior Airman', 'SrA', 'E-4', 'enlisted', 40),
    ('air_force', 'ssgt', 'Staff Sergeant', 'SSgt', 'E-5', 'enlisted', 50),
    ('air_force', 'tsgt', 'Technical Sergeant', 'TSgt', 'E-6', 'enlisted', 60),
    ('air_force', 'msgt', 'Master Sergeant', 'MSgt', 'E-7', 'enlisted', 70),
    ('air_force', 'smsgt', 'Senior Master Sergeant', 'SMSgt', 'E-8', 'enlisted', 80),
    ('air_force', 'cmsgt', 'Chief Master Sergeant', 'CMSgt', 'E-9', 'enlisted', 90),
    ('air_force', 'cmsaf', 'Chief Master Sergeant of the Air Force', 'CMSAF', 'E-9', 'enlisted', 91),
    ('air_force', '2d_lt', 'Second Lieutenant', '2d Lt', 'O-1', 'officer', 210),
    ('air_force', '1st_lt', 'First Lieutenant', '1st Lt', 'O-2', 'officer', 220),
    ('air_force', 'capt', 'Captain', 'Capt', 'O-3', 'officer', 230),
    ('air_force', 'maj', 'Major', 'Maj', 'O-4', 'officer', 240),
    ('air_force', 'lt_col', 'Lieutenant Colonel', 'Lt Col', 'O-5', 'officer', 250),
    ('air_force', 'col', 'Colonel', 'Col', 'O-6', 'officer', 260),
    ('air_force', 'brig_gen', 'Brigadier General', 'Brig Gen', 'O-7', 'officer', 270),
    ('air_force', 'maj_gen', 'Major General', 'Maj Gen', 'O-8', 'officer', 280),
    ('air_force', 'lt_gen', 'Lieutenant General', 'Lt Gen', 'O-9', 'officer', 290),
    ('air_force', 'gen', 'General', 'Gen', 'O-10', 'officer', 300),
    ('space_force', 'spc1', 'Specialist 1', 'Spc1', 'E-1', 'enlisted', 10),
    ('space_force', 'spc2', 'Specialist 2', 'Spc2', 'E-2', 'enlisted', 20),
    ('space_force', 'spc3', 'Specialist 3', 'Spc3', 'E-3', 'enlisted', 30),
    ('space_force', 'spc4', 'Specialist 4', 'Spc4', 'E-4', 'enlisted', 40),
    ('space_force', 'sgt', 'Sergeant', 'Sgt', 'E-5', 'enlisted', 50),
    ('space_force', 'tsgt', 'Technical Sergeant', 'TSgt', 'E-6', 'enlisted', 60),
    ('space_force', 'msgt', 'Master Sergeant', 'MSgt', 'E-7', 'enlisted', 70),
    ('space_force', 'smsgt', 'Senior Master Sergeant', 'SMSgt', 'E-8', 'enlisted', 80),
    ('space_force', 'cmsgt', 'Chief Master Sergeant', 'CMSgt', 'E-9', 'enlisted', 90),
    ('space_force', 'cmssf', 'Chief Master Sergeant of the Space Force', 'CMSSF', 'E-9', 'enlisted', 91),
    ('space_force', '2d_lt', 'Second Lieutenant', '2d Lt', 'O-1', 'officer', 210),
    ('space_force', '1st_lt', 'First Lieutenant', '1st Lt', 'O-2', 'officer', 220),
    ('space_force', 'capt', 'Captain', 'Capt', 'O-3', 'officer', 230),
    ('space_force', 'maj', 'Major', 'Maj', 'O-4', 'officer', 240),
    ('space_force', 'lt_col', 'Lieutenant Colonel', 'Lt Col', 'O-5', 'officer', 250),
    ('space_force', 'col', 'Colonel', 'Col', 'O-6', 'officer', 260),
    ('space_force', 'brig_gen', 'Brigadier General', 'Brig Gen', 'O-7', 'officer', 270),
    ('space_force', 'maj_gen', 'Major General', 'Maj Gen', 'O-8', 'officer', 280),
    ('space_force', 'lt_gen', 'Lieutenant General', 'Lt Gen', 'O-9', 'officer', 290),
    ('space_force', 'gen', 'General', 'Gen', 'O-10', 'officer', 300),
    ('coast_guard', 'sr', 'Seaman Recruit', 'SR', 'E-1', 'enlisted', 10),
    ('coast_guard', 'sa', 'Seaman Apprentice', 'SA', 'E-2', 'enlisted', 20),
    ('coast_guard', 'sn', 'Seaman', 'SN', 'E-3', 'enlisted', 30),
    ('coast_guard', 'po3', 'Petty Officer Third Class', 'PO3', 'E-4', 'enlisted', 40),
    ('coast_guard', 'po2', 'Petty Officer Second Class', 'PO2', 'E-5', 'enlisted', 50),
    ('coast_guard', 'po1', 'Petty Officer First Class', 'PO1', 'E-6', 'enlisted', 60),
    ('coast_guard', 'cpo', 'Chief Petty Officer', 'CPO', 'E-7', 'enlisted', 70),
    ('coast_guard', 'scpo', 'Senior Chief Petty Officer', 'SCPO', 'E-8', 'enlisted', 80),
    ('coast_guard', 'mcpo', 'Master Chief Petty Officer', 'MCPO', 'E-9', 'enlisted', 90),
    ('coast_guard', 'mcpcg', 'Master Chief Petty Officer of the Coast Guard', 'MCPCG', 'E-9', 'enlisted', 91),
    ('coast_guard', 'wo1', 'Warrant Officer 1', 'WO1', 'W-1', 'warrant_officer', 110),
    ('coast_guard', 'cwo2', 'Chief Warrant Officer 2', 'CWO2', 'W-2', 'warrant_officer', 120),
    ('coast_guard', 'cwo3', 'Chief Warrant Officer 3', 'CWO3', 'W-3', 'warrant_officer', 130),
    ('coast_guard', 'cwo4', 'Chief Warrant Officer 4', 'CWO4', 'W-4', 'warrant_officer', 140),
    ('coast_guard', 'ens', 'Ensign', 'ENS', 'O-1', 'officer', 210),
    ('coast_guard', 'ltjg', 'Lieutenant Junior Grade', 'LTJG', 'O-2', 'officer', 220),
    ('coast_guard', 'lt', 'Lieutenant', 'LT', 'O-3', 'officer', 230),
    ('coast_guard', 'lcdr', 'Lieutenant Commander', 'LCDR', 'O-4', 'officer', 240),
    ('coast_guard', 'cdr', 'Commander', 'CDR', 'O-5', 'officer', 250),
    ('coast_guard', 'capt', 'Captain', 'CAPT', 'O-6', 'officer', 260),
    ('coast_guard', 'rdml', 'Rear Admiral Lower Half', 'RDML', 'O-7', 'officer', 270),
    ('coast_guard', 'radm', 'Rear Admiral Upper Half', 'RADM', 'O-8', 'officer', 280),
    ('coast_guard', 'vadm', 'Vice Admiral', 'VADM', 'O-9', 'officer', 290),
    ('coast_guard', 'adm', 'Admiral', 'ADM', 'O-10', 'officer', 300)
)
INSERT INTO military_rank_types (military_branch_type_id, code, label, abbreviation, pay_grade, rank_group, sort_order)
SELECT military_branch_types.id, ranks.code, ranks.label, ranks.abbreviation, ranks.pay_grade, ranks.rank_group, ranks.sort_order
FROM ranks
JOIN military_branch_types
  ON military_branch_types.code = ranks.branch_code
ON CONFLICT (military_branch_type_id, code) DO UPDATE SET
  label = EXCLUDED.label,
  abbreviation = EXCLUDED.abbreviation,
  pay_grade = EXCLUDED.pay_grade,
  rank_group = EXCLUDED.rank_group,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();

ALTER TABLE burials
  ADD COLUMN IF NOT EXISTS military_rank_type_id uuid REFERENCES military_rank_types(id);

CREATE INDEX IF NOT EXISTS burials_military_rank_type_id_idx
  ON burials (military_rank_type_id);

DROP TRIGGER IF EXISTS touch_military_rank_types_updated_at ON military_rank_types;
CREATE TRIGGER touch_military_rank_types_updated_at
  BEFORE UPDATE ON military_rank_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_military_rank_types_changes ON military_rank_types;
CREATE TRIGGER audit_military_rank_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON military_rank_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_military_rank_types_changes ON military_rank_types;
--rollback DROP TRIGGER IF EXISTS touch_military_rank_types_updated_at ON military_rank_types;
--rollback DROP INDEX IF EXISTS burials_military_rank_type_id_idx;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS military_rank_type_id;
--rollback DROP TABLE IF EXISTS military_rank_types;
--rollback ALTER TABLE marker_types DISABLE TRIGGER audit_marker_types_changes;
--rollback DELETE FROM marker_types WHERE code = 'military_marker';
--rollback ALTER TABLE marker_types ENABLE TRIGGER audit_marker_types_changes;
