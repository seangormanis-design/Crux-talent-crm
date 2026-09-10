import "dotenv/config";
import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 4000);
const app = buildApp();

app.listen(port, () => {
  console.log(`Crux Talent CRM API listening on port ${port}`);
});
