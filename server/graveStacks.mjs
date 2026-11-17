import { cemeteryRole } from './auth.mjs';
import { BadRequestError } from './requestValidation.mjs';
import { optionalText } from './inputValidation.mjs';

export function optionalStackDate(value, label = 'Authorization date') {
  const date = optionalText(value, label, 40);
  if (date && (date.startsWith('0000') || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date)) {
    throw new BadRequestError(`${label} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}
export function validateGraveStack(body) {
  if (body?.stackGroup === undefined) return undefined;
  const stackGroup = optionalText(body.stackGroup, 'Stack group', 100);
  const stackLevel = Number(body.stackLevel);
  const stackingAuthorizedOn = optionalStackDate(body.stackingAuthorizedOn);
  const stackingAuthorizationReference = optionalText(body.stackingAuthorizationReference, 'Authorization reference', 1000);
  if (!stackGroup) {
    if (body.stackLevel || stackingAuthorizedOn || stackingAuthorizationReference) throw new BadRequestError('Single-level graves cannot have stacking details.');
    return { stackGroup: '', stackLevel: null, stackingAuthorizedOn: '', stackingAuthorizationReference: '' };
  }
  if (!Number.isSafeInteger(stackLevel) || stackLevel < 1 || stackLevel > 2147483647) throw new BadRequestError('Stack level must be a positive whole number, starting at 1 for the bottom.');
  if (stackLevel > 1 && (!stackingAuthorizedOn || !stackingAuthorizationReference)) throw new BadRequestError('Upper graves require an authorization date and supporting reference; uncertain authorizations require review.');
  return {stackGroup, stackLevel, stackingAuthorizedOn, stackingAuthorizationReference};
}

export async function saveGraveStack(client, existing, stack, actorUser) {
  if (!stack) return;
  const current = (await client.query(`SELECT sg.name AS stack_group, g.stack_level,
    g.stacking_authorized_on::text, g.stacking_authorization_reference
    FROM gravesites g LEFT JOIN grave_stack_groups sg ON sg.id=g.stack_group_uuid WHERE g.id=$1`, [existing.uuid])).rows[0];
  if ((current.stack_group ?? '') === stack.stackGroup && (current.stack_level ?? null) === stack.stackLevel
    && (current.stacking_authorized_on ?? '') === stack.stackingAuthorizedOn
    && (current.stacking_authorization_reference ?? '') === stack.stackingAuthorizationReference) return;
  const authorized = ['admin','cemetery-admin'].includes(cemeteryRole(actorUser, existing.cemetery_id));
  if (!authorized) throw new BadRequestError('Only cemetery or system administrators can change stacking assignments.');
  const cemetery = (await client.query('SELECT stacking_authorization_cutoff::text AS cutoff FROM cemeteries WHERE id=$1 FOR SHARE', [existing.cemetery_id])).rows[0];
  if (stack.stackLevel > 1 && cemetery.cutoff && stack.stackingAuthorizedOn >= cemetery.cutoff) throw new BadRequestError(`New stacking authorizations must predate ${cemetery.cutoff}; earlier reservations remain valid.`);
  let groupId = null;
  if (stack.stackGroup) groupId = (await client.query(`INSERT INTO grave_stack_groups(cemetery_id,name) VALUES($1,$2)
    ON CONFLICT(cemetery_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id`, [existing.cemetery_id,stack.stackGroup])).rows[0].id;
  try {
    await client.query(`UPDATE gravesites SET stack_group_uuid=$2,stack_level=$3,
      stacking_authorized_on=NULLIF($4,'')::date,stacking_authorization_reference=NULLIF($5,'') WHERE id=$1`,
      [existing.uuid,groupId,stack.stackLevel,stack.stackingAuthorizedOn,stack.stackingAuthorizationReference]);
  } catch (error) {
    if (error.code === '23505') throw new BadRequestError('That stack level is already assigned to another active grave.');
    throw error;
  }
}

export const graveStackSelect = `gravesites.stack_level,
  (SELECT max(member.stack_level) FROM gravesites member WHERE member.stack_group_uuid=gravesites.stack_group_uuid AND member.deleted_at IS NULL) AS stack_top_level,
  (SELECT name FROM grave_stack_groups WHERE id=gravesites.stack_group_uuid) AS stack_group`;
