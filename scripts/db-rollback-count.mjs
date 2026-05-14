import { parsePositiveInteger, runLiquibase } from "./lib/run-liquibase.mjs";

const count = parsePositiveInteger(process.argv[2], "1");

runLiquibase(["rollbackCount", count]);
