--liquibase formatted sql

--changeset cemeterymapping:449-family-first-lookup-labels splitStatements:false
UPDATE marker_material_types SET label = 'Granite, black', updated_at = now() WHERE code = 'black_granite' AND label = 'Black granite';
UPDATE marker_material_types SET label = 'Granite, gray and pink', updated_at = now() WHERE code = 'gray_and_pink_granite' AND label = 'Gray and Pink Granite';
UPDATE marker_material_types SET label = 'Granite, gray', updated_at = now() WHERE code = 'gray_granite' AND label = 'Gray granite';
UPDATE marker_material_types SET label = 'Granite, orange', updated_at = now() WHERE code = 'orange_granite' AND label = 'Orange granite';
UPDATE marker_material_types SET label = 'Granite, pink', updated_at = now() WHERE code = 'pink_granite' AND label = 'Pink granite';
UPDATE marker_material_types SET label = 'Granite, red', updated_at = now() WHERE code = 'red_granite' AND label = 'Red granite';
UPDATE marker_material_types SET label = 'Marble, gray', updated_at = now() WHERE code = 'gray_marble' AND label = 'Gray Marble';
UPDATE marker_material_types SET label = 'Marble, white', updated_at = now() WHERE code = 'white_marble' AND label = 'White marble';
UPDATE marker_material_types SET label = 'Metal, gray', updated_at = now() WHERE code = 'gray_metal' AND label = 'Gray metal';
UPDATE marker_material_types SET label = 'Metal, green', updated_at = now() WHERE code = 'green_metal' AND label = 'Green metal';
UPDATE marker_material_types SET label = 'Bronze, brown/aqua', updated_at = now() WHERE code = 'brown_aqua_bronze' AND label = 'Brown/Aqua Bronze';
UPDATE marker_material_types SET label = 'Bronze, brown/gold', updated_at = now() WHERE code = 'brown_gold_bronze' AND label = 'Brown/Gold Bronze';
UPDATE marker_types SET label = 'Bronze, brown/gold', updated_at = now() WHERE code = 'brown_gold_bronze' AND label = 'Brown/Gold Bronze';

--rollback UPDATE marker_material_types SET label = 'Black granite', updated_at = now() WHERE code = 'black_granite' AND label = 'Granite, black';
--rollback UPDATE marker_material_types SET label = 'Gray and Pink Granite', updated_at = now() WHERE code = 'gray_and_pink_granite' AND label = 'Granite, gray and pink';
--rollback UPDATE marker_material_types SET label = 'Gray granite', updated_at = now() WHERE code = 'gray_granite' AND label = 'Granite, gray';
--rollback UPDATE marker_material_types SET label = 'Orange granite', updated_at = now() WHERE code = 'orange_granite' AND label = 'Granite, orange';
--rollback UPDATE marker_material_types SET label = 'Pink granite', updated_at = now() WHERE code = 'pink_granite' AND label = 'Granite, pink';
--rollback UPDATE marker_material_types SET label = 'Red granite', updated_at = now() WHERE code = 'red_granite' AND label = 'Granite, red';
--rollback UPDATE marker_material_types SET label = 'Gray Marble', updated_at = now() WHERE code = 'gray_marble' AND label = 'Marble, gray';
--rollback UPDATE marker_material_types SET label = 'White marble', updated_at = now() WHERE code = 'white_marble' AND label = 'Marble, white';
--rollback UPDATE marker_material_types SET label = 'Gray metal', updated_at = now() WHERE code = 'gray_metal' AND label = 'Metal, gray';
--rollback UPDATE marker_material_types SET label = 'Green metal', updated_at = now() WHERE code = 'green_metal' AND label = 'Metal, green';
--rollback UPDATE marker_material_types SET label = 'Brown/Aqua Bronze', updated_at = now() WHERE code = 'brown_aqua_bronze' AND label = 'Bronze, brown/aqua';
--rollback UPDATE marker_material_types SET label = 'Brown/Gold Bronze', updated_at = now() WHERE code = 'brown_gold_bronze' AND label = 'Bronze, brown/gold';
--rollback UPDATE marker_types SET label = 'Brown/Gold Bronze', updated_at = now() WHERE code = 'brown_gold_bronze' AND label = 'Bronze, brown/gold';
