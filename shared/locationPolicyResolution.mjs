// Each key inherits independently; false is an explicit value, never absence.
export function matchingPolicies(rows,scope,rule){
 return rows.filter(p=>p.rule_key===rule&&(!p.cemetery_id||p.cemetery_id===scope.cemeteryId)
  &&(!p.section_uuid||p.section_uuid===scope.sectionId)&&(!p.block_uuid||p.block_uuid===scope.blockId))
  .sort((a,b)=>Number(Boolean(b.block_uuid))-Number(Boolean(a.block_uuid))||Number(Boolean(b.section_uuid))-Number(Boolean(a.section_uuid))||Number(Boolean(b.cemetery_id))-Number(Boolean(a.cemetery_id)));
}
export function localPolicy(rows,scope,rule){return matchingPolicies(rows,scope,rule).find(p=>p.cemetery_id===scope.cemeteryId&&p.section_uuid===scope.sectionId&&p.block_uuid===scope.blockId);}
