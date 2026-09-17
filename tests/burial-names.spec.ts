import { expect, test } from "@playwright/test";
import { select } from "./fixtures/cemetery";
import { overviewFixture, overviewGrave } from "./fixtures/overview";

test("save and reopen an unnamed person's status and descriptive display name", async ({ page }) => {
  await overviewFixture(page);
  const displayName = "Infant son of George & Bertie Steele";
  await page.route("**/api/burials/alice", async (route) => {
    const input = route.request().postDataJSON();
    expect(input.firstName).toBe("");
    expect(input.lastName).toBe("Steele");
    expect(input.givenNameStatus).toBe("no_given_name");
    expect(input.displayName).toBe(displayName);
    const burial = overviewGrave("A-TEST").burials[0];
    return route.fulfill({ json: { ...burial, person: { ...burial.person, firstName: input.firstName, lastName: input.lastName, givenNameStatus: input.givenNameStatus, displayName: input.displayName } } });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tab", { name: "People and ownership" }).click();
  await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
  await page.getByRole("textbox", { name: "First name", exact: true }).fill("");
  await expect(page.getByRole("combobox", { name: "Given name status" })).toHaveValue("unknown");
  await page.getByRole("combobox", { name: "Given name status" }).selectOption("no_given_name");
  await page.getByRole("textbox", { name: "Last name", exact: true }).fill("Steele");
  await page.getByRole("textbox", { name: "Display name" }).fill(displayName);
  await page.getByRole("button", { name: "Save burial", exact: true }).click();
  const record = page.locator("article.burial-record").filter({ has: page.getByRole("button", { name: `Edit burial ${displayName}` }) });
  await expect(record.getByText("No given name", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: `Edit burial ${displayName}` }).click();
  await expect(page.getByRole("combobox", { name: "Given name status" })).toHaveValue("no_given_name");
  await expect(page.getByRole("textbox", { name: "First name", exact: true })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Display name" })).toHaveValue(displayName);
});

test("name formatting distinguishes unnamed people and respects descriptive names", async () => {
  const { fullName } = await import("../src/lib/format");
  expect(fullName({ firstName: "", lastName: "Steele", givenNameStatus: "no_given_name" })).toBe("Steele — No given name");
  expect(fullName({ firstName: "", lastName: "Steele", givenNameStatus: "unknown" })).toBe("Steele");
  expect(fullName({ firstName: "George", lastName: "Steele", displayName: "Infant son of George & Bertie Steele" })).toBe("Infant son of George & Bertie Steele");
});

test("save and reopen a prefix and suffix in name order", async ({ page }) => {
  await overviewFixture(page);
  await page.route("**/api/burials/alice", async (route) => {
    const input = route.request().postDataJSON();
    expect(input.namePrefix).toBe("Reverend");
    expect(input.nameSuffix).toBe("Ph.D.");
    const burial = overviewGrave("A-TEST").burials[0];
    return route.fulfill({ json: { ...burial, person: { ...burial.person, namePrefix: input.namePrefix, nameSuffix: input.nameSuffix } } });
  });
  await page.goto("/");
  await select(page, "A-TEST");
  await page.getByRole("tab", { name: "People and ownership" }).click();
  await page.getByRole("button", { name: "Edit burial Alice Example" }).click();
  await page.getByRole("textbox", { name: "Prefix / Title", exact: true }).fill("Reverend");
  await page.getByRole("textbox", { name: "Suffix / Credentials", exact: true }).fill("Ph.D.");
  await page.getByRole("button", { name: "Save burial", exact: true }).click();
  await page.getByRole("button", { name: "Edit burial Reverend Alice Example Ph.D." }).click();
  await expect(page.getByRole("textbox", { name: "Prefix / Title", exact: true })).toHaveValue("Reverend");
  await expect(page.getByRole("textbox", { name: "Suffix / Credentials", exact: true })).toHaveValue("Ph.D.");
});

test("prefixes precede names and display names still override all name parts", async () => {
  const { fullName } = await import("../src/lib/format");
  const person = { firstName: "John", lastName: "Smith", namePrefix: "Reverend", nameSuffix: "Jr." };
  expect(fullName(person)).toBe("Reverend John Smith Jr.");
  expect(fullName({ ...person, namePrefix: "" })).toBe("John Smith Jr.");
  expect(fullName({ ...person, displayName: "Rev. J. Smith" })).toBe("Rev. J. Smith");
});
