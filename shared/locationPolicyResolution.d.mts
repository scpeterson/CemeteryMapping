import type {PolicyScope,PolicyRow} from '../src/api/policyApi';
export function matchingPolicies(rows:PolicyRow[],scope:PolicyScope,rule:string):PolicyRow[];
export function localPolicy(rows:PolicyRow[],scope:PolicyScope,rule:string):PolicyRow|undefined;
