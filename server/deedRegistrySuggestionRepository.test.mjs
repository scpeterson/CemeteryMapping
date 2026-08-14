import assert from "node:assert/strict";
import test from "node:test";
import { findDeedRegistrySuggestions } from "./deedRegistrySuggestionRepository.mjs";

test("deed registry suggestions combine both tab references and prefer Updated 2022 values", async () => {
  let captured;
  const pool = {
    async query(sql, values) {
      captured = { sql, values };
      return { rows: [{
        updated_id: "updated-id", updated_row_number: 217, updated_owner_name: "Roy Soergel",
        updated_known_date: "1944", updated_deed_on_file: "No", updated_deed_register_on_file: "Yes",
        updated_lot_text: "70", updated_modern_section: "C", updated_address: "1 Main St", updated_city: "Pittsburgh", updated_state: "PA",
        original_id: "original-id", original_row_number: 208, original_owner_name: "Roy Soergel", original_known_date: "1944",
      }] };
    },
  };

  const suggestions = await findDeedRegistrySuggestions(pool, "cemetery-id", "Roy Soergel");
  assert.match(captured.sql, /rowType' = 'owner_record'/u);
  assert.deepEqual(captured.values, ["cemetery-id", "%roy%", "%soergel%"]);
  assert.deepEqual(suggestions[0], {
    id: "updated-id", ownerDisplayName: "Roy Soergel", address: "1 Main St", city: "Pittsburgh", state: "PA",
    effectiveDate: "1944", deedOnFile: false, deedRegisterOnFile: true, modernSection: "C", lotText: "70",
    documentReference: "Trinity Cemetery Registry 2022",
    notes: "Original 2017 tab - line 208\nUpdated 2022 tab - line 217",
    originalRowNumber: 208, updatedRowNumber: 217,
  });
});

test("deed registry suggestion search ignores punctuation and duplicate short terms", async () => {
  const pool = { async query(_sql, values) { assert.deepEqual(values, ["cemetery-id", "%george%", "%brant%"]); return { rows: [] }; } };
  assert.deepEqual(await findDeedRegistrySuggestions(pool, "cemetery-id", "George W. George Brant"), []);
});
