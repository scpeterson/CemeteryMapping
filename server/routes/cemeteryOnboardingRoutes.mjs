import {canManageCemeteryMembers} from '../cemeteryMembershipRepository.mjs';
import {validateUuid} from '../inputValidation.mjs';
import {validateSearchPage} from '../requestValidation.mjs';
import {getImportBatch,createOnboardingCemetery,listImportBatches,stageImport,decideImport} from '../cemeteryOnboardingRepository.mjs';

export function registerCemeteryOnboardingRoutes(app,{pool,requireAdmin,requireCemeteryAdmin,express}){
 app.post('/api/onboarding/cemeteries',requireAdmin,express.json({limit:'5mb'}),async(req,res,next)=>{res.set('Cache-Control','no-store');try{res.status(201).json(await createOnboardingCemetery(pool,req.body,req.user));}catch(error){next(error);}});
 const path='/api/cemeteries/:cemeteryId/import-batches';
 const scope=(req,res,next)=>{try{req.importCemeteryId=validateUuid(req.params.cemeteryId,'Cemetery');if(!canManageCemeteryMembers(req.user,req.importCemeteryId))return res.status(403).json({error:'Forbidden'});res.set('Cache-Control','no-store');next();}catch(error){next(error);}};
 app.get(path,requireCemeteryAdmin,scope,async(req,res,next)=>{try{res.json(await listImportBatches(pool,req.importCemeteryId,validateSearchPage(req.query)));}catch(error){next(error);}});
 app.post(path,requireCemeteryAdmin,scope,express.json({limit:'5mb'}),async(req,res,next)=>{try{res.status(201).json(await stageImport(pool,req.importCemeteryId,req.body,req.user));}catch(error){next(error);}});
 app.post(path+'/:id/decision',requireCemeteryAdmin,scope,express.json({limit:'10kb'}),async(req,res,next)=>{try{const result=await decideImport(pool,req.importCemeteryId,validateUuid(req.params.id,'Import'),req.body,req.user);if(!result)return res.status(404).json({error:'Import not found.'});res.json(result);}catch(error){next(error);}});
 app.get(path+'/:id',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const batch=await getImportBatch(pool,req.importCemeteryId,validateUuid(req.params.id,'Import'));if(!batch)return res.status(404).json({error:'Import not found.'});res.json(batch);}catch(error){next(error);}});
 app.get(path+'/:id/source',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const row=(await pool.query('SELECT source_text FROM cemetery_import_batches WHERE id=$1 AND cemetery_id=$2',[validateUuid(req.params.id,'Import'),req.importCemeteryId])).rows[0];if(!row)return res.status(404).json({error:'Import not found.'});res.type('application/octet-stream').attachment('original-import-source.txt').send(row.source_text);}catch(error){next(error);}});
}
