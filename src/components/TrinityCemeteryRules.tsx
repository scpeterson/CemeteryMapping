import { useState } from "react";
import { Modal } from "./ui/Modal";

const rules = [
  {
    title: "A. Plot purchase and burial rights",
    items: [
      "A deed conveys burial rights. Trinity retains ownership of the land. The deed may contain additional conditions.",
      "Each plot permits up to two sets of ashes, or one casket plus up to one set of ashes.",
      "Only current and former voting members of Trinity may purchase deeds.",
      "Grantees may use burial rights for themselves or for a spouse, child, other legal dependent, or parent.",
      "Inheritance, assignment, sale, or other transfer requires Trinity’s express written authorization.",
      "A valid deed requires full payment and signatures from the grantee and two Congregation Council officers.",
      "The plot price is $1,000.",
      "Exceptions require Congregation Council approval, Pastor approval, and written documentation.",
    ],
  },
  {
    title: "B. Interment rules and fees",
    items: [
      "Caskets require grave vaults, and cremation urns require urn vaults. Ashes may also be buried directly or spread on the plot.",
      "Trinity designates the approved contractor for grave opening, closing, repair, maintenance, and related services.",
      "Trinity negotiates and establishes the contractor’s fees.",
      "At burial, the grantee or their representative pays the contractor’s current scheduled charges and pays Trinity $150 for ashes or $300 for a casket.",
    ],
  },
  {
    title: "C. Monuments and markers",
    items: [
      "Install a permanent marker as soon as practical and within nine months of burial. After that, Trinity may install a temporary or permanent marker of its choice without notice.",
      "Sections A–E permit upright headstones or flush markers.",
      "Sections F and G permit flush markers only.",
      "Headstones and flush markers must be granite or bronze and supported by a cement base of appropriate depth.",
      "Flush markers may project at most ½ inch above the surrounding ground.",
      "A single plot permits one headstone up to 36 × 36 × 16 inches (width × height × depth). A double plot or two contiguous immediate-family plots permit one single-size headstone per plot or one shared headstone up to 50 × 36 × 16 inches.",
      "A single plot permits one flush marker up to 28 × 18 inches (width × depth), or 28 × 34 inches for two sets of ashes. A double plot or two contiguous immediate-family plots permit one single-size flush marker per plot or one shared marker up to 54 × 18 inches. A U.S. military veteran’s grave may also have one flush foot marker up to 24 × 12 inches.",
      "Place headstones and flush markers toward the west side of the plot. Place a veteran’s foot marker toward the east side.",
      "Trinity may remove a nonconforming marker installed on or after October 20, 2025, without notice.",
    ],
  },
  {
    title: "D. Care and maintenance",
    items: [
      "Trinity cuts the grass at reasonable intervals during the growing season and removes debris.",
      "Maintenance, repair, and replacement of markers and items placed on plots are outside Trinity’s responsibilities.",
      "Trinity assumes no responsibility for damage, loss, or theft of items placed on graves.",
    ],
  },
  {
    title: "E. Flowers and decorations",
    items: [
      "Natural flowers are allowed April 1 through October 31.",
      "Potted plants are allowed for Easter, Mother’s Day, Father’s Day, Memorial Day, Veterans Day, Thanksgiving, and Christmas. Remove them one week after the holiday.",
      "Natural or artificial wreaths are allowed from November 1 through the end of February.",
      "Small U.S. flags are allowed on veterans’ graves for one week before and after Memorial Day, Independence Day, and Veterans Day.",
      "Prohibited items include artificial flowers, trees, shrubs, other plantings, rocks, gravel, wood chips, mulch, fencing, shepherd’s hooks, vases, shells, toys, metal or plastic decorations, chairs, glass, crockery, wood or iron objects, and similar items that interfere with care. Changes to plot grade are prohibited.",
      "Trinity may remove unsightly, obstructive, or inappropriate items at its discretion without notice.",
    ],
  },
  {
    title: "F. Failure to use a plot",
    items: [
      "A deed becomes void if the plot has not been claimed and used within three years after the grantee’s death.",
      "If Trinity determines that the plot cannot be used, Trinity substitutes an unsold plot of similar dimensions in the same section. If none is available or the grantee refuses it, the remedy is a refund of the original purchase price without interest.",
      "If no burial occurs within 50 years of deed issuance, Trinity may repossess burial rights without compensation. Trinity must send written notice to the last known address and allow 60 days to respond. Before repossession, a responding grantee may request one written extension of up to 20 years.",
    ],
  },
];

export default function TrinityCemeteryRules() {
  const [open, setOpen] = useState(false);
  const onClose = () => setOpen(false);
  return <>
    <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>Trinity rules</button>
    {open && <Modal className="cemetery-rules-panel" label="Trinity cemetery rules" onClose={onClose}>
      <button type="button" onClick={onClose}>Close</button>
      <h2>Trinity cemetery rules</h2>
      <p>Exhibit B · Effective October 20, 2025. Trinity may revise these rules and fees. Individual deeds may contain additional conditions.</p>
      <p>Use Exhibit B and the applicable deed for operational decisions. Section G burial entry enforces the standard limits. The signed G-72 deed permits one casket or up to three sets of ashes as separate alternatives. It also allows a marker up to 36 inches wide.</p>
      {rules.map(({ title, items }) => <section key={title}>
        <h3>{title}</h3>
        <ol>{items.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>)}
    </Modal>}
  </>;
}
