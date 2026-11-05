import { createHash } from "node:crypto";
import { BadRequestError, ConflictError } from "./requestValidation.mjs";

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
  return value;
}
export const fieldRequestHash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");

// Call inside the same transaction as the mutation, after checking current scope.
// The unique insert waits for a concurrent retry; rollback leaves no receipt.
export async function beginFieldOperation(client, actorUser, operationId, requestHash) {
  if (!actorUser?.subject || actorUser.subject.length>300) throw new BadRequestError("Sign in before synchronizing field work.");
  const inserted=await client.query(`INSERT INTO field_operations(actor_subject,operation_id,actor_app_user_id,request_hash)
    VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING operation_id`,[actorUser.subject,operationId,actorUser.id??null,requestHash]);
  if(inserted.rows.length)return {replayed:false};
  const {rows}=await client.query("SELECT request_hash,response FROM field_operations WHERE actor_subject=$1 AND operation_id=$2 FOR UPDATE",[actorUser.subject,operationId]);
  if(rows[0]?.request_hash!==requestHash)throw new ConflictError("This queued action was already used with different data. Keep the draft and review it before creating a new action.");
  if(!rows[0].response)throw new ConflictError("This action needs review before retrying. Your local draft is retained.");
  return {replayed:true,response:rows[0].response};
}
export async function completeFieldOperation(client, actorUser, operationId, response) {
  await client.query("UPDATE field_operations SET response=$3::jsonb WHERE actor_subject=$1 AND operation_id=$2",[actorUser.subject,operationId,JSON.stringify(response)]);
}

// Borrow one connection without committing the receipt's outer transaction.
export function fieldTransactionPool(client) {
  let sequence=0;
  return {query:client.query.bind(client),connect:async()=>{
    const savepoint=`field_mutation_${++sequence}`;
    return {release(){},query(sql,values){
      return client.query(sql==="BEGIN"?`SAVEPOINT ${savepoint}`:sql==="COMMIT"?`RELEASE SAVEPOINT ${savepoint}`:sql==="ROLLBACK"?`ROLLBACK TO SAVEPOINT ${savepoint}`:sql,values);
    }};
  }};
}
