import { runLiquibase } from "./lib/run-liquibase.mjs";

runLiquibase(["updateTestingRollback"]);
