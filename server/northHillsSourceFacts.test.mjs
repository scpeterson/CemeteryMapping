import assert from "node:assert/strict";
import test from "node:test";
import { parseNorthHillsSourceFacts } from "./northHillsSourceFacts.mjs";

test("parseNorthHillsSourceFacts extracts church record death date and supporting facts", () => {
  const facts = parseNorthHillsSourceFacts('McWILLIAMS (2C, 1, s) 1909-1965 CR: Middle initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"');

  assert.deepEqual(
    facts.map((fact) => [fact.sourceCode, fact.factType, fact.factValue, fact.factDate, fact.confidence]),
    [
      ["CR", "note", 'Middle initial T., d. December 16, 1965, 56y Sm 25da, "our janitor"', undefined, "review"],
      ["CR", "middle_initial", "T.", undefined, "medium"],
      ["CR", "death_date", "December 16, 1965", "1965-12-16", "high"],
      ["CR", "age_at_death", "56y 5m 25d", undefined, "medium"],
      ["CR", "note", "our janitor", undefined, "medium"],
    ],
  );
});

test("parseNorthHillsSourceFacts supports CRG segments separately from CR", () => {
  const facts = parseNorthHillsSourceFacts("Example CRG: d. Nov. 2, 1929 CR: Church note");

  assert.equal(facts.find((fact) => fact.sourceCode === "CRG" && fact.factType === "death_date")?.factDate, "1929-11-02");
  assert.equal(facts.find((fact) => fact.sourceCode === "CR")?.sourceLabel, "Church Records");
});

test("parseNorthHillsSourceFacts excludes trailing flower holder physical observations from CR notes", () => {
  const facts = parseNorthHillsSourceFacts(
    'SCOTT (3A, 1, s) pillow "Roy C. Scott/ May 26, 1913 / Aug. 26, 1961 /Father" CR: Middle name Charles. Councilman Flower holder with flowers',
  );

  assert.deepEqual(
    facts.map((fact) => [fact.sourceCode, fact.factType, fact.factValue, fact.factDate, fact.confidence]),
    [
      ["CR", "note", "Middle name Charles. Church position: Councilman", undefined, "review"],
      ["CR", "note", "Church position: Councilman", undefined, "medium"],
    ],
  );
});
