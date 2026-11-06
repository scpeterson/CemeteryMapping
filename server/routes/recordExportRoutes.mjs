import {validateUuid} from '../inputValidation.mjs';
import {validateSearchQuery} from '../requestValidation.mjs';
import {canEditCemetery,canViewOwnershipForCemetery} from '../auth.mjs';
import {canExportCemetery,validateExportOptions,exportRecords} from '../recordExportRepository.mjs';

export function registerRecordExportRoutes(app,{pool,requireReader}){
 app.get('/api/export-cemeteries',requireReader,async(req,res,next)=>{res.set('Cache-Control','no-store');try{
  const q=validateSearchQuery(req.query.q).replace(/[\\%_]/gu,'\\$&');
  const ids=req.user.role==='admin'?null:(req.user.cemeteryAccess??[]).map(a=>a.cemeteryId);
  const rows=(await pool.query("SELECT id::text,name FROM cemeteries WHERE deleted_at IS NULL AND($1::uuid[] IS NULL OR id=ANY($1::uuid[])) AND name ILIKE $2 ORDER BY lower(name),id LIMIT 50",[ids,`%${q}%`])).rows;
  res.json(rows.map(c=>({...c,canExportOwnership:canViewOwnershipForCemetery(req.user,c.id),canExportMaintenance:canEditCemetery(req.user,c.id)})));
 }catch(error){next(error);}});
 app.get('/api/cemeteries/:cemeteryId/export',requireReader,async(req,res,next)=>{res.set('Cache-Control','no-store');try{
  const cemeteryId=validateUuid(req.params.cemeteryId,'Cemetery');if(!canExportCemetery(req.user,cemeteryId))return res.status(403).json({error:'This account has no export access to this cemetery.'});
  const options=validateExportOptions(req.query),result=await exportRecords(pool,cemeteryId,options,req.user);
  if(result.forbidden)return res.status(403).json({error:'Private ownership or maintenance exports require current editor access to this cemetery.'});
  res.set('X-Record-Count',String(result.count));res.set('X-Content-Type-Options','nosniff');res.type(options.format==='csv'?'text/csv; charset=utf-8':'application/geo+json').attachment(`cemetery-${options.dataset}.${options.format==='csv'?'csv':'geojson'}`).send(result.content);
 }catch(error){next(error);}});
}
