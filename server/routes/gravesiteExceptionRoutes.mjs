import { requiredText, validateUuid } from "../inputValidation.mjs";
import { BadRequestError } from "../requestValidation.mjs";
import { canManagePolicy } from "../locationPolicyAdministration.mjs";

export function registerGravesiteExceptionRoutes(app, { pool, requireCemeteryAdmin }) {
  const path = "/api/admin/policies/gravesite-exceptions";
  app.get(path, requireCemeteryAdmin, async (req, res, next) => {
    try {
      const cemeteryId = validateUuid(req.query.cemeteryId, "Cemetery");
      if (!req.user.id || !canManagePolicy(req.user, { cemeteryId })) {
        return res.status(403).json({ error: "Exception permission denied." });
      }
      const query = requiredText(req.query.query, "Gravesite ID", 50).toUpperCase();
      const { rows } = await pool.query(`
        SELECT g.id, g.gravesite_id AS "plotId",
          gravesite_location_policy(g.id, 'casket_or_two_urns') AS "capacityEnforced",
          to_jsonb(b) - 'gravesite_uuid' AS burial,
          to_jsonb(m) - 'gravesite_uuid' AS marker
        FROM gravesites g
        JOIN cemeteries c ON c.id = g.cemetery_id
        LEFT JOIN burial_capacity_exceptions b ON b.gravesite_uuid = g.id
        LEFT JOIN marker_width_exceptions m ON m.gravesite_uuid = g.id
        WHERE g.cemetery_id = $1 AND c.facility_id = '1'
          AND c.deleted_at IS NULL AND g.deleted_at IS NULL
          AND (upper(g.gravesite_id) = $2 OR regexp_replace(upper(g.gravesite_id), '-0+(?=[0-9])', '-') = $2)
        ORDER BY (upper(g.gravesite_id) = $2) DESC, g.gravesite_id, g.id LIMIT 10
      `, [cemeteryId, query]);
      const exact = rows.filter(row => row.plotId.toUpperCase() === query);
      res.json(exact.length ? exact : rows);
    } catch (error) { next(error); }
  });
  app.put(path, requireCemeteryAdmin, async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const cemeteryId = validateUuid(body.cemeteryId, "Cemetery");
      if (!req.user.id || !canManagePolicy(req.user, { cemeteryId })) {
        return res.status(403).json({ error: "Exception permission denied." });
      }
      const graveId = validateUuid(body.graveId, "Gravesite");
      const approval = requiredText(body.approval, "Written approval reference", 500);
      if (body.expected !== null && (!body.expected || typeof body.expected !== "object" || Array.isArray(body.expected))) {
        throw new BadRequestError("Reload the exception before saving.");
      }
      const { rule, ashesOnly, ashesWithCasket, markerWidth } = body;
      if (rule === "burial") {
        if (!Number.isInteger(ashesOnly) || !Number.isInteger(ashesWithCasket)
          || ashesOnly < 0 || ashesOnly > 2147483647 || ashesWithCasket < 0 || ashesWithCasket > ashesOnly) {
          throw new BadRequestError("Enter whole-number ashes limits. The limit with a casket must be within the ashes-only limit.");
        }
      } else if (rule === "marker") {
        if (!Number.isFinite(markerWidth) || markerWidth <= 0 || markerWidth > 10000) {
          throw new BadRequestError("Enter a valid marker width in inches.");
        }
      } else throw new BadRequestError("Choose a supported exception type.");
      const { rows } = await pool.query(
        "SELECT save_gravesite_exception($1,$2,$3,$4,$5,$6,$7,$8,$9) AS exception",
        [req.user.id, cemeteryId, graveId, rule, body.expected === null ? null : JSON.stringify(body.expected),
          approval, rule === "burial" ? ashesOnly : null, rule === "burial" ? ashesWithCasket : null,
          rule === "marker" ? markerWidth : null],
      );
      res.json(rows[0].exception);
    } catch (error) {
      if (error.code === "42501") return res.status(403).json({ error: "Exception permission denied." });
      if (error.code === "40001") return res.status(409).json({ error: "The exception changed. Find the plot again before saving." });
      if (["23514", "22023"].includes(error.code)) return res.status(409).json({ error: error.message });
      next(error);
    }
  });
}
