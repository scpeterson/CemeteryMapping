import { requireArgument, runLiquibase } from "./lib/run-liquibase.mjs";

const tag = requireArgument(process.argv[2], "Usage: npm run db:rollback:tag -- <tag>");

runLiquibase(["rollback", tag]);
