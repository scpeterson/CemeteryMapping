import type { Dispatch, SetStateAction } from "react";
import type { SaveBurialInput } from "../../types";

export default function BurialNameFields({ form, setForm }: {
  form: SaveBurialInput;
  setForm: Dispatch<SetStateAction<SaveBurialInput>>;
}) {
  return <>
        <label>
          Given name status
          <select value={form.givenNameStatus} onChange={(event) => setForm((current) => ({ ...current, givenNameStatus: event.target.value as SaveBurialInput["givenNameStatus"] }))}>
            <option value="recorded">Recorded</option>
            <option value="unknown">Unknown / not recorded</option>
            <option value="no_given_name">No given name</option>
          </select>
          <small>Choose No given name only when confirmed that the person was not named. A blank inscription alone means Unknown / not recorded.</small>
        </label>
        <label>
          Display name
          <input maxLength={255} value={form.displayName ?? ""} placeholder="Infant son of George & Bertie Steele" onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
          <small>Optional description shown in place of the assembled name. Preserve the exact inscription on the marker record.</small>
        </label>
        <label>
          Prefix / Title
          <input maxLength={100} value={form.namePrefix} placeholder="Rev., Reverend, Dr." onChange={(event) => setForm((current) => ({ ...current, namePrefix: event.target.value }))} />
        </label>
        <label>
          First name
          <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value, givenNameStatus: event.target.value.trim() ? "recorded" : current.givenNameStatus === "no_given_name" ? "no_given_name" : "unknown" }))} />
        </label>
        <label>
          Last name
          <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </label>
        <label>
          Maiden name
          <input value={form.maidenName} onChange={(event) => setForm((current) => ({ ...current, maidenName: event.target.value }))} />
        </label>
        <label>
          Suffix / Credentials
          <input
            value={form.nameSuffix}
            placeholder="M.D., Ph.D., Jr."
            onChange={(event) => setForm((current) => ({ ...current, nameSuffix: event.target.value }))}
          />
        </label>
  </>;
}
