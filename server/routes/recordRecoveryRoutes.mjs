import {canManageCemeteryMembers} from '../cemeteryMembershipRepository.mjs';
import {validateUuid} from '../inputValidation.mjs';
import {validateSearchPage,validateSearchQuery} from '../requestValidation.mjs';
import {listDeletedRecords,restoreDeletedRecord} from '../recordRecoveryRepository.mjs';
import {findMergePeople,previewBurialMerge,mergeBurials} from '../burialMergeRepository.mjs';

export function registerRecordRecoveryRoutes(app,{pool,requireCemeteryAdmin}){
 const base='/api/cemeteries/:cemeteryId';
 const scope=(req,res,next)=>{try{req.recoveryCemeteryId=validateUuid(req.params.cemeteryId,'Cemetery');if(!canManageCemeteryMembers(req.user,req.recoveryCemeteryId))return res.status(403).json({error:'Forbidden'});res.set('Cache-Control','no-store');next();}catch(error){next(error);}};
 app.get(base+'/deleted-records',requireCemeteryAdmin,scope,async(req,res,next)=>{try{res.json(await listDeletedRecords(pool,req.recoveryCemeteryId,req.query.kind,{...validateSearchPage(req.query),query:validateSearchQuery(req.query.q)}));}catch(error){next(error);}});
 app.post(base+'/deleted-records/:kind/:id/restore',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const result=await restoreDeletedRecord(pool,req.recoveryCemeteryId,req.params.kind,validateUuid(req.params.id,'Record'),req.body,req.user);if(!result)return res.status(404).json({error:'Record not found.'});res.json(result);}catch(error){next(error);}});
 app.get(base+'/merge-people',requireCemeteryAdmin,scope,async(req,res,next)=>{try{res.json(await findMergePeople(pool,req.recoveryCemeteryId,validateSearchQuery(req.query.q)));}catch(error){next(error);}});
 app.post(base+'/person-merge-preview',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const result=await previewBurialMerge(pool,req.recoveryCemeteryId,validateUuid(req.body?.sourceId,'Donor person'),validateUuid(req.body?.targetId,'Surviving person'),req.user);if(!result)return res.status(404).json({error:'Active people not found in this cemetery.'});res.json(result);}catch(error){next(error);}});
 app.post(base+'/person-merges',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const result=await mergeBurials(pool,req.recoveryCemeteryId,req.body,req.user);if(!result)return res.status(404).json({error:'Active people not found in this cemetery. Reload their status.'});res.json(result);}catch(error){next(error);}});
 app.get(base+'/person-merges/:sourceId/evidence',requireCemeteryAdmin,scope,async(req,res,next)=>{try{const row=(await pool.query('SELECT * FROM burial_record_merges WHERE source_id=$1 AND cemetery_id=$2',[validateUuid(req.params.sourceId,'Merged person'),req.recoveryCemeteryId])).rows[0];if(!row)return res.status(404).json({error:'Merge evidence not found.'});res.type('application/json').attachment('person-merge-evidence.json').send(JSON.stringify(row,null,2));}catch(error){next(error);}});
}
