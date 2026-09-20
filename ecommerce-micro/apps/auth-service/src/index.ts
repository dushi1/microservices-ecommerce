import express from "express";
import { ROUTES } from "@ecommerce/contracts";
import { createLogger } from "@ecommerce/common";
import { checkDb } from "./db.js";
import { asyncHandler, errorHandler } from "./middleware.js";
import { register, login, refresh, me } from "./handlers.js";

const log = createLogger("auth-service");
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const db = await checkDb();
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db });
});

// Request bodies are validated against the contract schemas before the handler runs.
app.post(ROUTES.auth.register, asyncHandler(register));
app.post(ROUTES.auth.login, asyncHandler(login));
app.post(ROUTES.auth.refresh, asyncHandler(refresh));
// /me requires a valid access token — verify it here, then let the handler load the user.
app.get(ROUTES.auth.me, asyncHandler(me));

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => log.info(`auth-service listening on :${port}`));
