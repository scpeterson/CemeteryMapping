import pg from 'pg';
import {mkdirSync,writeFileSync} from 'node:fs';
import {currentEnvironment,loadDbEnvironment} from '../scripts/lib/run-liquibase.mjs';
const e=loadDbEnvironment(currentEnvironment());
const c=new pg.Client({host:e.POSTGRES_HOST||'127.0.0.1',port:e.POSTGRES_PORT,database:e.POSTGRES_DB,user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD});
const generatedAt=new Date();
const reportDate=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(generatedAt);
const reportDateLabel=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'long'}).format(generatedAt);
const sql=`WITH locations AS (
 SELECT h.id, g.id AS grave_uuid, g.cemetery_id, COALESCE(s.name,g.section_id) AS section, concat_ws('-',COALESCE(s.name,g.section_id),NULLIF(g.grave_id,'')) AS gravesite_id, g.lot_id
 FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid AND g.deleted_at IS NULL LEFT JOIN sections s ON s.section_id=g.section_uuid
 UNION
 SELECT hg.headstone_uuid, g.id,g.cemetery_id,COALESCE(s.name,g.section_id),concat_ws('-',COALESCE(s.name,g.section_id),NULLIF(g.grave_id,'')),g.lot_id
 FROM headstone_gravesites hg JOIN gravesites g ON g.id=hg.gravesite_uuid AND g.deleted_at IS NULL LEFT JOIN sections s ON s.section_id=g.section_uuid WHERE hg.deleted_at IS NULL
 UNION
 SELECT h.id,NULL::uuid,s.cemetery_id,s.name,NULL,NULL
 FROM headstones h JOIN sections s ON ST_Covers(s.geometry,h.geometry) AND s.deleted_at IS NULL
 WHERE NOT EXISTS (SELECT 1 FROM gravesites g WHERE g.id=h.gravesite_uuid AND g.deleted_at IS NULL)
 AND NOT EXISTS (SELECT 1 FROM headstone_gravesites hg JOIN gravesites g ON g.id=hg.gravesite_uuid AND g.deleted_at IS NULL WHERE hg.headstone_uuid=h.id AND hg.deleted_at IS NULL)
), photos AS (
 SELECT l.headstone_uuid,count(*)::int AS photos,count(*) FILTER(WHERE l.is_primary)::int AS primaries
 FROM headstone_media_assets l JOIN media_assets a ON a.id=l.media_asset_id
 WHERE l.deleted_at IS NULL AND l.status='linked' AND a.deleted_at IS NULL AND a.status='linked' AND a.asset_type='photo' AND NULLIF(trim(a.file_url),'') IS NOT NULL GROUP BY l.headstone_uuid
)
SELECT h.headstone_id AS monument, (SELECT label FROM marker_types WHERE id=h.marker_type_id) AS marker_type, (SELECT label FROM marker_scope_types WHERE id=h.marker_scope_type_id) AS marker_scope, h.inscription, cem.name AS cemetery, loc.section,
 string_agg(DISTINCT loc.lot_id, ', ' ORDER BY loc.lot_id) AS lots,
 string_agg(DISTINCT loc.gravesite_id, ', ' ORDER BY loc.gravesite_id) AS gravesites,
 (SELECT string_agg(DISTINCT COALESCE(NULLIF(b.display_name,''),NULLIF(b.full_name,''),concat_ws(' ',b.first_name,b.last_name)), '; ') FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid AND b.deleted_at IS NULL WHERE hb.headstone_uuid=h.id AND hb.deleted_at IS NULL) AS names,
 COALESCE(p.photos,0) AS photo_count,COALESCE(p.primaries,0) AS primary_count,
 NULLIF(trim(h.photo_url),'') IS NOT NULL AS legacy_photo,
 CASE WHEN COALESCE(p.photos,0)=0 AND NULLIF(trim(h.photo_url),'') IS NULL THEN 'No monument photo' ELSE 'Photos present; no Primary' END AS issue
FROM headstones h JOIN locations loc ON loc.id=h.id JOIN cemeteries cem ON cem.id=loc.cemetery_id AND cem.deleted_at IS NULL LEFT JOIN photos p ON p.headstone_uuid=h.id
WHERE h.deleted_at IS NULL AND cem.name = 'Trinity Lutheran Church Cemetery' AND upper(loc.section) IN ('A','B','C','D')
GROUP BY h.id,cem.name,loc.section,p.photos,p.primaries
ORDER BY cem.name,loc.section,h.headstone_id`;
try {
 await c.connect();await c.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const all=(await c.query(sql)).rows;const rows=all.filter(r=>r.primary_count===0);
 const summary=['A','B','C','D'].map(section=>({section,total:all.filter(r=>r.section===section).length,noPhoto:rows.filter(r=>r.section===section&&r.issue==='No monument photo').length,noPrimary:rows.filter(r=>r.section===section&&r.issue!=='No monument photo').length}));
 const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
 const table=(headers,data)=>`<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 const html=`<!doctype html><html lang="en"><meta charset="utf-8"><title>Monument photo exceptions — Sections A–D</title><style>body{font:15px system-ui;margin:40px;color:#172b35}h1{font-size:27px}table{border-collapse:collapse;width:100%;margin:20px 0 36px}th,td{padding:9px;border:1px solid #ccd5da;text-align:left;vertical-align:top}th{background:#eaf0f3}tr:nth-child(even){background:#f7f9fa}p{max-width:1000px;line-height:1.5}@media print{body{margin:12px;font-size:10px}thead{display:table-header-group}tr{break-inside:avoid}}</style><h1>Monument photo exceptions — Sections A–D</h1><p>Trinity Lutheran Cemetery · Generated ${esc(reportDateLabel)} · Source: ${esc(currentEnvironment().toUpperCase())} database (${esc(e.POSTGRES_DB)}).</p><p>${all.length} monuments checked; ${rows.length} require attention. Each monument is listed once per associated section. Deleted records and unlinked, rejected, or review-only media are excluded. Plot markers are included. Standalone markers are assigned to sections using their map locations. Only photos attached directly to a monument count; gravesite photos do not. Legacy monument photo URLs count as photos but cannot supply a Primary flag.</p>${table(['Section','Monuments checked','No monument photo','Photos present; no Primary','Total exceptions'],summary.map(s=>[s.section,s.total,s.noPhoto,s.noPrimary,s.noPhoto+s.noPrimary]))}${['A','B','C','D'].map(s=>`<h2>Section ${s}</h2>${table(['Gravesite name(s)','Monument ID','Marker type','Marker scope','Inscription','Lot(s)','Associated names','Linked photos','Legacy photo','Issue'],rows.filter(r=>r.section===s).map(r=>[r.gravesites || 'Standalone marker',r.monument,r.marker_type,r.marker_scope,r.inscription,r.lots,r.names,r.photo_count,r.legacy_photo?'Yes':'No',r.issue]))}`).join('')}</html>`;
 mkdirSync('reports',{recursive:true});
 writeFileSync(`reports/monument-photo-exceptions-A-D-${reportDate}.html`,html);
 writeFileSync(`reports/monument-photo-exceptions-A-D-${reportDate}.json`,JSON.stringify({generatedAt:new Date().toISOString(),database:e.POSTGRES_DB,summary,rows},null,2));
 await c.query('COMMIT');console.log(JSON.stringify({cemeteries:[...new Set(all.map(r=>r.cemetery))],checked:all.length,exceptions:rows.length,summary,legacy:rows.filter(r=>r.legacy_photo).length},null,2));
}finally{await c.end()}
