import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Call only inside a rollback transaction. CI contains demo data, whereas a
// developer database may also contain field imports; neither is modified here.
export async function createInspectionFixture(client){
 const template=(await client.query(`SELECT h.*,g.cemetery_id FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
  WHERE h.deleted_at IS NULL AND g.deleted_at IS NULL LIMIT 1`)).rows[0];
 assert.ok(template,'Seed demo data before running inspection integration tests');
 const id=randomUUID();
 await client.query(`INSERT INTO headstones(id,headstone_id,gravesite_uuid,marker_type_id,marker_scope_type_id,material_type_id,condition_type_id,geometry,latitude,longitude,last_inspected_at,inscription)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'2026-06-12','Fixture field reading')`,
 [id,`REGRESSION-${id}`,template.gravesite_uuid,template.marker_type_id,template.marker_scope_type_id,template.material_type_id,template.condition_type_id,template.geometry,template.latitude,template.longitude]);
 const batchId=(await client.query("INSERT INTO north_hills_ocr_import_batches(cemetery_id,source_name) VALUES($1,'Inspection regression fixture') RETURNING id",[template.cemetery_id])).rows[0].id;
 const entryId=(await client.query(`INSERT INTO north_hills_ocr_entries(batch_id,cemetery_id,source_page_index,source_line_start,source_line_end,raw_text,inscription_text,source_entry)
 VALUES($1,$2,1,1,1,'upright, exc cond','Fixture NHG reading','{"descriptor":"upright, exc cond"}') RETURNING id`,[batchId,template.cemetery_id])).rows[0].id;
 await client.query('INSERT INTO north_hills_ocr_entry_headstone_links(entry_id,headstone_uuid) VALUES($1,$2)',[entryId,id]);
 const inspectionId=(await client.query("SELECT id FROM monument_inspections WHERE headstone_uuid=$1 AND source_type='field_survey'",[id])).rows[0].id;
 for(let i=0;i<2;i++){
  const photoId=randomUUID();
  await client.query(`INSERT INTO media_assets(id,cemetery_id,storage_key,file_url,original_filename,captured_at) VALUES($1,$2,$3,$4,$5,'2026-06-12')`,[photoId,template.cemetery_id,`regression/${photoId}.jpg`,`/media/${photoId}.jpg`,`fixture-${i}.jpg`]);
  await client.query('INSERT INTO headstone_media_assets(headstone_uuid,media_asset_id) VALUES($1,$2)',[id,photoId]);
  await client.query('INSERT INTO monument_photo_contexts(headstone_uuid,media_asset_id,inspection_id) VALUES($1,$2,$3)',[id,photoId,inspectionId]);
 }
 return {id,entryId};
}
