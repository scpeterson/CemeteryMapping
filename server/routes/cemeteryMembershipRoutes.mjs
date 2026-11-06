import { canManageCemeteryMembers, listCemeteryMembers, membershipAccount, saveCemeteryMember, validateMembership } from "../cemeteryMembershipRepository.mjs";
import { validateUuid } from "../inputValidation.mjs";
import { validateSearchPage, validateSearchQuery } from "../requestValidation.mjs";
import { Auth0ProvisioningNotConfiguredError } from "../auth0Management.mjs";

export function registerCemeteryMembershipRoutes(app, { pool, requireCemeteryAdmin, auth0ManagementClient }) {
  const scope = (request, response) => {
    const id = validateUuid(request.params.cemeteryId, "Cemetery");
    if (!canManageCemeteryMembers(request.user,id)) { response.status(403).json({ error: "Forbidden" }); return undefined; }
    return id;
  };
  app.get("/api/cemeteries/:cemeteryId/members", requireCemeteryAdmin, async (request,response,next) => {
    try {
      const id=scope(request,response);if(!id)return;
      response.json(await listCemeteryMembers(pool,id,{...validateSearchPage(request.query),query:validateSearchQuery(request.query.q)}));
    } catch(error){next(error);}
  });
  app.post("/api/cemeteries/:cemeteryId/members", requireCemeteryAdmin, async (request,response,next) => {
    try {
      const id=scope(request,response);if(!id)return;
      const input=validateMembership(request.body,{invite:true});
      const cemetery=await pool.query("SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL",[id]);
      if(!cemetery.rows.length)return response.status(404).json({error:"Cemetery not found."});
      const existing=await membershipAccount(pool,input.email);
      const resolved=existing ? undefined : await auth0ManagementClient.resolveOrCreateUser(input);
      const result=await saveCemeteryMember(pool,id,input,request.user,{resolvedSubject:resolved?.externalSubject});
      if(!result)return response.status(404).json({error:"Cemetery not found."});
      if(result.forbidden)return response.status(403).json({error:"Forbidden"});
      response.status(201).json({...result,invitationSent:resolved?.invitationSent??false});
    } catch(error){
      if(error instanceof Auth0ProvisioningNotConfiguredError)return response.status(400).json({error:"New account invitations need system administrator setup. Existing accounts can still be added."});
      next(error);
    }
  });
  for(const method of ["put","delete"]){
    app[method]("/api/cemeteries/:cemeteryId/members/:userId",requireCemeteryAdmin,async(request,response,next)=>{
      try{
        const id=scope(request,response);if(!id)return;
        const input=validateMembership(request.body);
        const result=await saveCemeteryMember(pool,id,input,request.user,{userId:validateUuid(request.params.userId,"Member"),remove:method==="delete"});
        if(!result)return response.status(404).json({error:"Membership not found."});
        if(result.forbidden)return response.status(403).json({error:"Forbidden"});
        response.json(result);
      }catch(error){next(error);}
    });
  }
}
