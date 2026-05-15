import { runLiquibase } from "./lib/run-liquibase.mjs";

runLiquibase(process.argv.slice(2));
