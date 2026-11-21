---
---

# Start Here: Power Users

Use this guide if you are new to using Cemetery Mapping to find cemetery records, review monuments and burials, or maintain records for your assigned cemetery. You do not need to install software or run database commands. The separate [developer setup guide](getting-started.md) is for people running the application locally.

## Get access and sign in

1. Obtain the correct application address from your administrator. [Hosted TEST](https://test.nhcemeteries.org) is a testing environment: confirm where you should enter real work before making changes.
2. Ask for a **Power user** membership in each cemetery you maintain. One account can have a different role in each cemetery. If access has not been arranged, follow [Requesting and Approving Access](access-requests.md).
3. On hosted TEST, your administrator must also allow your email through Cloudflare Access. Complete the gateway's sign-in prompts, then the application's sign-in prompts.
4. For a new application account, complete account/password setup and the email verification or setup link sent to your inbox. Return to the application and sign in using the approved email address.
5. Choose an assigned cemetery in the header and confirm its permitted edit controls appear. Set your preferred initial cemetery in **My profile**. If controls are missing, ask the administrator to check that cemetery's membership and refresh the app. Sign out and back in when Auth0 token permissions change.

Cloudflare access, your sign-in account, and your application role are separate requirements. Completing one does not grant the others.

## New workspaces and availability

Confirm the environment's [release status](release-status.md) with your administrator.
The November feature workflows have recorded DEV and hosted TEST deployments;
consult the dated release status for exact revisions and validation limits.
Each person uses one account, with an independent role for each cemetery.
Update contact/preferences through **My profile**.

- **Field** saves encrypted marker/person drafts and original photos on your device.
  Prepare the built offline page while online, then synchronize with the original
  account when connected. Saving on the device does not save to the server.
- **Export** downloads scoped CSV or gravesite/marker GeoJSON. Ownership contacts
  require separate permission and explicit confirmation.
- **Tasks** lists assigned or cemetery work, due dates and in-app reminders.
  Reminders are shown while the application is in use; no email or push is sent.
- Cemetery administrators use **Members**, **Onboarding** and **Recovery** under
  Administration for delegated access, reviewed imports, restoration and person
  duplicate review. Ask an administrator to review duplicates or deleted records.

If saving reports another editor's change, keep or copy your draft, then explicitly
reload the latest values and review them before saving again. The reload action
discards the local draft after confirmation. Detailed steps are in
[Operator Workflows](operator-workflows.md#recovering-other-conflicting-edits).

## Take a first tour

1. Open the map and use its legend to identify the displayed features. Zoom into your cemetery and select a gravesite or monument.
2. Read **Overview** first, then open **Details** or the relevant record section for more information. You can also use search to locate a person or known record identifier.
3. Check the cemetery, section, and record ID before editing. Similar names and shared monuments can lead to several possible records.
4. Open **Monuments** from a gravesite to inspect its associated markers. Use the **Markers** panel to find standalone monuments and plot markers.
5. Open **Reports** to explore the reports available to your role. **Owner holdings** helps find recorded ownership within your permitted cemeteries.

For photography follow-up, run **Reports → Data maintenance → Unreadable monument
inscriptions**. Select your permitted **Cemetery**, a **Section** or All sections,
and optionally set **Include plot markers → No**. The report separates fully
illegible faces from partially illegible faces, includes empty faces marked with
the Illegible checkbox, and labels unreadable fragments with insufficient extent
evidence as unknown. It includes plot/standalone markers unless filtered out.

Each face/reading row shows its latest and immediately previous inspection's
legibility, dates/sources, original text and observed change. Use **Show → Current
or previous illegibility** to include readings that became readable. Missing or
unmatched evidence is Not comparable, not proof that legibility changed. Select
a monument ID to review the inspections before taking new photographs. One
illegible face does not mean every face on the monument is unreadable.

The enhanced report needs its own deployment; older releases use text matching
only and do not independently match an empty structured Illegible flag. Absence
from a report is not proof of readability. Keep correct flags and history rather
than adding placeholder text to force a match. See the [report workflow and
classification rules](operator-workflows.md#unreadable-monument-inscriptions-report).

Search can find deceased names, known monument/gravesite IDs, and other recorded details. Owner and deed information is restricted by cemetery assignment. If a search returns nothing, try a surname or shorter identifier and check active filters.

## Understand what you are looking at

| Record | What it represents |
| --- | --- |
| Gravesite | A mapped burial space. Its boundary may be estimated; check its geometry notes and confidence. |
| Burial | A person's record associated with a gravesite. A monument may commemorate more than one person. |
| Monument or marker | A physical object. It can serve several gravesites or stand alone; a plot marker does not establish a burial space. |
| Lot and ownership | Land grouping and recorded rights. A burial or monument does not establish ownership. |
| Inspection | A dated observation of condition, inscriptions, faces, and associated photos. Historical and current inspections can differ. |
| NHG evidence | A North Hills Genealogists source reading. Being listed in NHG is distinct from having a confirmed linked reading. |

A veteran star identifies a gravesite's veteran evidence; a pink square with a black border identifies a plot marker. Use the current map legend for the complete symbol key. Do not interpret an estimated polygon, a missing owner, or an unlinked source as proof that land is available.

## Everyday power-user work

### Correct an existing record

Open the record, review its identity and source information, then use the edit controls available to you. Save and confirm the displayed result before moving on. Give a clear change reason when requested, such as the source used to correct a name or date. Cancel if you are unsure which record the evidence describes.

Power users can update existing cemetery records and view/edit deed-owner data for their assigned cemeteries. User management, structural changes, deletes, and some review workflows require a higher role. Refer uncertain associations, duplicate records, geometry changes, or placeholder burials to an administrator.

### Review a monument and its history

Open the monument and check its type, material, relationships, source information, and available photos. In its details, select an **Inspection** to view that visit's condition, inscriptions, and photos. The latest inspection is selected initially. An empty photo gallery for a historical inspection does not mean the monument has no photos in other visits.

Keep historical readings separate from what can be read today. Do not replace a historical inscription merely because the current stone is illegible. Creating or editing inspections currently requires cemetery-admin or admin access; ask for help if those controls are absent. See [Inspection History](operator-workflows.md#inspection-history) for the detailed workflow.

**Current marker reading** identifies the latest inspection's date/year, type
and source. Selecting an older inspection changes the visit view without replacing
that summary. Historical transcriptions are additional source evidence, not an
automatic log of every edit; older inspection readings remain independent.

### Add monument photos

Within a cemetery where you have power-user access, open the monument and choose
**Overview → Add photos**, or **Details → Photos → Photo gallery (N)**. Set
**Photo record** to **All marker photos** or **Photos without a record**, then
choose **Upload new photos**, select your files, and **Upload photos**. These
choices store the images in the monument library without assigning an inspection.

You can also upload/link/unlink photos for an existing maintenance record in a
cemetery you may edit. Choose that maintenance record to set its face and
Before/During/After timing. Inspection-linked uploads, links, face changes and
unlinking require a cemetery admin for that cemetery or a system admin. If an
inspection is selected and upload controls are absent, switch Photo record to
All marker photos or Photos without a record; you do not need inspection-edit
permission to upload to the monument library. Deleting the photo itself requires
cemetery-admin or system-admin access; unlinking from maintenance keeps the image.
See the [photo permissions and workflow](operator-workflows.md#photo-collection).

### Work with ownership evidence

Check the lot, gravesite, existing ownership history, and supporting deed before recording a change. Use **Reports → Owner holdings** to review associated property. “No owner found” means no current ownership record was found in the app, not that the space was never deeded. See [Operator Workflows](operator-workflows.md) for ownership-event procedures and report guidance.

### If you are assigned NHG review work

**Admin → Readings** is a separate review workflow whose availability depends on your role; a power-user account does not automatically grant access. An administrator can arrange the appropriate access or perform the review with you.

For users with access, filter by printed page number and choose **Apply filters**. Confirm gravesite and headstone matches separately: linking one does not confirm the other. Reject incorrect suggestions rather than linking nearby records simply because they appear in the candidate list. Observation cards have **Reviewed** and **Rejected** buttons for users permitted to edit readings. Pending/handled totals also include observations and source facts, so deciding all candidate matches may not complete the reading.

## When something is unclear

- Missing edit or ownership controls: ask the administrator to verify your role and cemetery assignment.
- A server error: copy its reference number, the page or action, and the record ID for the administrator. Check the saved record before repeating a write whose result is uncertain.
- Conflicting records or sources: preserve the evidence and ask for review rather than guessing an identity, location, ownership, or compass bearing.
- Unexpected TEST behavior: report the issue and confirm the environment before continuing data entry.

For more detail, continue to [Operator Workflows](operator-workflows.md). Administrators can use [Admin Workflows](admin-workflows.md), and access coordinators can use [Requesting and Approving Access](access-requests.md).
