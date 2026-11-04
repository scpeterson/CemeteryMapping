---
---

# Start Here: Power Users

Use this guide if you are new to using Cemetery Mapping to find cemetery records, review monuments and burials, or maintain records for your assigned cemetery. You do not need to install software or run database commands. The separate [developer setup guide](getting-started.md) is for people running the application locally.

## Get access and sign in

1. Obtain the correct application address from your administrator. [Hosted TEST](https://test.nhcemeteries.org) is a testing environment: confirm where you should enter real work before making changes.
2. Ask for a **power-user** account and assignment to the cemetery you maintain. If access has not been arranged, follow [Requesting and Approving Access](access-requests.md).
3. On hosted TEST, your administrator must also allow your email through Cloudflare Access. Complete the gateway's sign-in prompts, then the application's sign-in prompts.
4. For a new application account, complete account/password setup and the email verification or setup link sent to your inbox. Return to the application and sign in using the approved email address.
5. Confirm you can open records for the assigned cemetery and see its permitted edit controls. If controls are missing, ask the administrator to check your role and cemetery assignment. Sign out and back in after access changes.

Cloudflare access, your sign-in account, and your application role are separate requirements. Completing one does not grant the others.

## Take a first tour

1. Open the map and use its legend to identify the displayed features. Zoom into your cemetery and select a gravesite or monument.
2. Read **Overview** first, then open **Details** or the relevant record section for more information. You can also use search to locate a person or known record identifier.
3. Check the cemetery, section, and record ID before editing. Similar names and shared monuments can lead to several possible records.
4. Open **Monuments** from a gravesite to inspect its associated markers. Use the **Markers** panel to find standalone monuments and plot markers.
5. Open **Reports** to explore the reports available to your role. **Owner holdings** helps find recorded ownership within your permitted cemeteries.

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
