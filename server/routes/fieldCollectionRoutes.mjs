import { assignedEditableCemeteryIds, canEditCemetery } from "../auth.mjs";
import { validateSearchPage, validateSearchQuery } from "../requestValidation.mjs";
import { validateUuid } from "../inputValidation.mjs";
import { getFieldSnapshot, listFieldMarkers, synchronizeFieldOperation, validateFieldOperation } from "../fieldCollectionRepository.mjs";

export function registerFieldCollectionRoutes(app,{pool,requirePowerUser,express}){
  app.get("/api/field-markers",requirePowerUser,async(request,response,next)=>{
    response.set("Cache-Control","no-store");
    try{
      const cemeteryId=validateUuid(request.query.cemeteryId,"Cemetery");
      if(!canEditCemetery(request.user,cemeteryId))return response.status(403).json({error:"Forbidden"});
      response.json(await listFieldMarkers(pool,cemeteryId,{...validateSearchPage(request.query),query:validateSearchQuery(request.query.q)}));
    }catch(error){next(error);}
  });
  app.get("/api/field-cemeteries",requirePowerUser,async(request,response,next)=>{
    response.set("Cache-Control","no-store");
    try{
      const q=validateSearchQuery(request.query.q).replace(/[\\%_]/gu,"\\$&");
      const {rows}=await pool.query(`SELECT id::text,name FROM cemeteries WHERE deleted_at IS NULL
        AND ($1::uuid[] IS NULL OR id=ANY($1::uuid[])) AND name ILIKE $2 ORDER BY lower(name),id LIMIT 50`,
      [request.user.role==="admin"?null:assignedEditableCemeteryIds(request.user),`%${q}%`]);
      response.json(rows);
    }catch(error){next(error);}
  });
  app.get("/api/cemeteries/:cemeteryId/field-snapshot/:markerId",requirePowerUser,async(request,response,next)=>{
    response.set("Cache-Control","no-store");
    try{
      const cemeteryId=validateUuid(request.params.cemeteryId,"Cemetery");
      if(!canEditCemetery(request.user,cemeteryId))return response.status(403).json({error:"Forbidden"});
      const snapshot=await getFieldSnapshot(pool,cemeteryId,validateUuid(request.params.markerId,"Marker"));
      if(!snapshot)return response.status(404).json({error:"Marker not found in this cemetery."});
      response.json(snapshot);
    }catch(error){next(error);}
  });
  app.post("/api/field-sync",requirePowerUser,express.json({limit:"1mb"}),async(request,response,next)=>{
    response.set("Cache-Control","no-store");
    try{
      const operation=validateFieldOperation(request.body);
      if(!canEditCemetery(request.user,operation.cemeteryId))return response.status(403).json({error:"Forbidden"});
      const result=await synchronizeFieldOperation(pool,operation,request.user);
      if(!result)return response.status(404).json({error:"Record not found in this cemetery."});
      if(result.forbidden)return response.status(403).json({error:"Forbidden"});
      response.json(result);
    }catch(error){next(error);}
  });
}
