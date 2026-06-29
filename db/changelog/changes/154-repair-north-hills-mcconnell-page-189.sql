--liquibase formatted sql

--changeset cemeterymapping:154-repair-north-hills-mcconnell-page-189
UPDATE north_hills_ocr_entries
SET
  raw_text = 'McCONNELL (10A, 1, s) upright, gray granite, exc cond "Mattie E./ McConnell / 1891-1932" Separate flag holder: "American / US/ Legion", star',
  inscription_text = 'Mattie E./ McConnell / 1891-1932 American / US/ Legion',
  updated_at = now()
WHERE source_page_number = 189
  AND source_line_start = 45
  AND name_text = 'McCONNELL';

--rollback UPDATE north_hills_ocr_entries SET raw_text = 'McCONNELL (10A, 1, s) upright, gray granite, exc cond "Mattile IE./ McConnell/ 1891-1932" Separate flag holder: "American/ US/ Legion", star', inscription_text = 'Mattile IE./ McConnell/ 1891-1932 American/ US/ Legion', updated_at = now() WHERE source_page_number = 189 AND source_line_start = 45 AND name_text = 'McCONNELL';
