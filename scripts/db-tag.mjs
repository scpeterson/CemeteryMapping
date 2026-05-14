import { requireArgument, runLiquibase } from "./lib/run-liquibase.mjs";

const tag = requireArgument(process.argv[2], "Usage: npm run db:tag -- <tag>");

runLiquibase(["tag", tag]);
