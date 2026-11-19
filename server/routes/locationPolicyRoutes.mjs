import {canManagePolicy,policySnapshot,validatePolicyChange,changePolicy,verifyPreview} from "../locationPolicyAdministration.mjs";
import {validateUuid} from "../inputValidation.mjs";
import {ConflictError} from "../requestValidation.mjs";
export function registerLocationPolicyRoutes(app,{pool,requireCemeteryAdmin}){
 app.get('/api/admin/policies',requireCemeteryAdmin,async(req,res,next)=>{try{res.json(await policySnapshot(pool,req.user,req.query.before?validateUuid(req.query.before,"History cursor"):null));}catch(e){next(e);}});
 for(const action of ['preview','save'])app.post('/api/admin/policies/'+action,requireCemeteryAdmin,async(req,res,next)=>{
  try{
   const input=validatePolicyChange(req.body);
   if(!req.user.id)return res.status(403).json({error:'Sign in with an active application account to preview or save policies.'});
   if(!canManagePolicy(req.user,input))return res.status(403).json({error:'Forbidden'});
   if(action==='save'&&!verifyPreview(req.body.previewToken,input,req.user.id))throw new ConflictError('Preview this exact change again before saving.');
   const result=await changePolicy(pool,input,req.user,{preview:action==='preview'});
   res.json(result);
  }catch(e){
   if(e.code==='42501')return res.status(403).json({error:'Policy permission denied.'});
   if(['23514','22023'].includes(e.code)){
    const detail={location_policy_gravesites:'Existing graves are prohibited by this rule.',location_policy_markers:'Existing markers are not all flat markers.',location_policy_capacity:'Existing burials exceed one casket or two unmixed urns.',section_g_single_primary:'A grave has multiple markers, a non-flat marker or a non-primary/non-spanning relationship.',location_policy_legacy_section:'Canonical section references are required.',location_policy_legacy_block:'Canonical block references are required.'}[e.constraint] || 'Review the selected scope, existing records and canonical location references.';
    return res.status(409).json({error:`Policy conflict: ${detail} No policy was saved.`});
   }
   next(e);
  }
 });
}
