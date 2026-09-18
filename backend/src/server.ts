import "dotenv/config";
import { buildApp } from "./app";

// Belt-and-suspenders: express-async-errors (see app.ts) forwards rejections
// from inside a route handler to the error middleware, but anything that
// rejects outside the request lifecycle (a fire-and-forget call, a timer
// callback) wouldn't go through Express at all — without this, that would
// crash the process silently with no explanation in the logs.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();

app.listen(port, () => {
  console.log(`Crux Talent CRM API listening on port ${port}`);
});
