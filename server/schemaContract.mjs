export const requiredSchemaChangeset = "230-split-c-0234-hague-gravesites";

export async function assertCurrentSchema(pool) {
  let result;
  try {
    result = await pool.query(
      `SELECT EXISTS (
         SELECT 1
         FROM databasechangelog
         WHERE id = $1 AND author = 'cemeterymapping'
       ) AS current`,
      [requiredSchemaChangeset],
    );
  } catch (error) {
    throw new Error(`Database schema could not be verified. Run npm run db:migrate before starting the API. (${error.message})`, { cause: error });
  }

  if (result.rows[0]?.current !== true) {
    throw new Error(`Database schema is out of date. Required Liquibase changeset ${requiredSchemaChangeset} is missing. Run npm run db:migrate before starting the API.`);
  }
}
