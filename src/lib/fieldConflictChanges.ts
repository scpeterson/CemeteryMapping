export type FieldChange = {path:string[];before:unknown;proposed:unknown;current:unknown;conflict:boolean;missing:boolean};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const object=(x:unknown):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"&&!Array.isArray(x);
const skipped=new Set(["expectedVersion","facesRevision","reason","__proto__","constructor","prototype"]);
export function fieldChanges(base:unknown,proposal:unknown,current:unknown,path:string[]=[]):FieldChange[]{
  if(equal(base,proposal))return [];
  if(Array.isArray(base)&&Array.isArray(proposal)&&base.every(object)&&proposal.every(object)&&[...base,...proposal].every(v=>typeof v.id==="string")){
    return proposal.flatMap(value=>{
      const original=base.find(item=>item.id===value.id);
      const latest=Array.isArray(current)?current.find(item=>object(item)&&item.id===value.id):undefined;
      return fieldChanges(original,value,latest,[...path,String(value.id)]);
    });
  }
  if(object(base)&&object(proposal))return Object.keys(proposal).filter(key=>!skipped.has(key)).flatMap(key=>fieldChanges(base[key],proposal[key],object(current)?current[key]:undefined,[...path,key]));
  return [{path,before:base,proposed:proposal,current,conflict:!equal(current,base)&&!equal(current,proposal),missing:current===undefined}];
}
export function applyFieldChanges<T>(current:T,changes:FieldChange[],useMine:Set<number>):T{
  const result=structuredClone(current);
  for(const [index,change]of changes.entries()){
    if(change.missing||(change.conflict&&!useMine.has(index)))continue;
    let cursor:unknown=result;
    for(const key of change.path.slice(0,-1)){
      if(skipped.has(key)){cursor=undefined;break;}
      cursor=Array.isArray(cursor)?cursor.find(value=>object(value)&&value.id===key):object(cursor)?cursor[key]:undefined;
    }
    const key=change.path.at(-1);
    if(object(cursor)&&key&&!skipped.has(key))cursor[key]=structuredClone(change.proposed);
  }
  return result;
}
