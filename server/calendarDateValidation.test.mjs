import assert from "node:assert/strict";
import test from "node:test";
import { optionalDate, optionalRecordedDate } from "./routes/routeValidationHelpers.mjs";
import { validateBurialPayload, validateHeadstonePayload, validateMaintenanceRecordPayload } from "./routes/cemeteryRouteValidation.mjs";
import { BadRequestError } from "./requestValidation.mjs";

for (const value of ["2002-11-31", "1900-02-29", "2001-02-29", "2000-00-01", "2000-13-01", "2000-01-00", "0000-01-01"]) {
  test(`rejects impossible exact date ${value}`, () => {
    for (const validate of [optionalDate, optionalRecordedDate]) {
      assert.throws(() => validate(value, "Death date"), (error) =>
        error instanceof BadRequestError && error.message === `Death date "${value}" is not a valid calendar date. Check the year, month, and day.`);
    }
  });
}

test("recorded dates validate named months and partial dates without requiring a full date", () => {
  for (const value of ["Nov 31, 2002", "February 29 1900", "Jan 32 2000", "Jan 0 2000", "2002-13", "0000", "Nov. 0000"]) {
    assert.throws(() => optionalRecordedDate(value, "Birth date"), BadRequestError);
  }
  for (const value of ["2000-02-29", "2004-02-29", "1900-02-28", "2002-11-30", "2002", "2002-11", "Nov. 2002,", "February 29, 2000", "0001-01-01", ""]) {
    assert.equal(optionalRecordedDate(value, "Birth date") ?? "", value);
  }
});

test("burial payload identifies the invalid field", () => {
  for (const [field, label] of [["birthDate", "Birth date"], ["deathDate", "Death date"], ["burialDate", "Burial date"]]) {
    assert.throws(() => validateBurialPayload({ firstName: "Alice", lastName: "Example", [field]: "2002-11-31" }),
      (error) => error instanceof BadRequestError && error.message.startsWith(`${label} "2002-11-31"`));
  }
});

for (const [field, label, validate] of [
  ["lastInspectedAt", "Last inspected date", validateHeadstonePayload],
  ["provenanceVerifiedAt", "Source information verified date", validateHeadstonePayload],
  ["observedAt", "Observed date", validateMaintenanceRecordPayload],
  ["completedAt", "Completed date", validateMaintenanceRecordPayload],
]) {
  test(`${label} rejects impossible calendar dates before database access`, () => {
    assert.throws(() => validate({ [field]: "2002-11-31" }),
      (error) => error instanceof BadRequestError && error.message.startsWith(`${label} "2002-11-31"`));
  });
}
