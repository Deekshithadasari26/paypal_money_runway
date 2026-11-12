import "dotenv/config";
import { openDb, seed } from "./db.js";
import { seedPlanner } from "./planner.js";
const db = openDb();
seed(db);
seedPlanner(db);
db.close();
console.log("Demo profile ready (existing data preserved).");
