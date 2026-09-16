import assert from "node:assert/strict";
import test from "node:test";
import { validateBurialPayload } from "./routes/cemeteryRouteValidation.mjs";
import { toBurial } from "./cemeteryMappers.mjs";

test("unnamed burials retain descriptive names separately from structured names", () => {
  const input = validateBurialPayload({ firstName: "", lastName: "Steele", givenNameStatus: "no_given_name", displayName: "Infant son of George & Bertie Steele" });
  assert.equal(input.firstName, "");
  assert.equal(input.givenNameStatus, "no_given_name");
  const result = toBurial({ id: "infant", first_name: null, last_name: input.lastName, given_name_status: input.givenNameStatus, display_name: input.displayName });
  assert.equal(result.person.firstName, "");
  assert.equal(result.person.lastName, "Steele");
  assert.equal(result.person.displayName, input.displayName);
  assert.equal(result.person.givenNameStatus, "no_given_name");
});

test("legacy empty names remain unknown and named records remain recorded", () => {
  assert.equal(toBurial({ first_name: null }).person.givenNameStatus, "unknown");
  assert.equal(toBurial({ first_name: "George" }).person.givenNameStatus, "recorded");
  assert.equal(validateBurialPayload({ firstName: "George" }).givenNameStatus, undefined);
  assert.equal(validateBurialPayload({}).displayName, undefined);
  assert.equal(validateBurialPayload({ displayName: "  " }).displayName, "");
});

test("conflicting given-name states return actionable validation errors", () => {
  assert.throws(() => validateBurialPayload({ givenNameStatus: "recorded" }), /Enter a first name/);
  for (const givenNameStatus of ["unknown", "no_given_name"]) {
    assert.throws(() => validateBurialPayload({ firstName: "George", givenNameStatus }), /Clear the first name or choose Recorded/);
  }
  assert.throws(() => validateBurialPayload({ givenNameStatus: "invalid" }), /Choose a valid given name status/);
  assert.throws(() => validateBurialPayload({ displayName: "x".repeat(256) }), /Display name/);
});
