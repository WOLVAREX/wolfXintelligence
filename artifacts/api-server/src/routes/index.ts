import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth.js";
import authRouter from "./auth.js";
import healthRouter from "./health.js";
import modelsRouter from "./models.js";
import agentsRouter from "./agents.js";
import conversationsRouter from "./conversations.js";
import messagesRouter from "./messages.js";
import settingsRouter from "./settings.js";
import statsRouter from "./stats.js";
import adminRouter from "./admin.js";
import usersRouter from "./users.js";

const router: IRouter = Router();

// Public — no auth required
router.use(authRouter);

// Protected — require valid JWT for everything below
router.use(requireAuth);
router.use(healthRouter);
router.use(modelsRouter);
router.use(agentsRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(settingsRouter);
router.use(statsRouter);
router.use(adminRouter);
router.use(usersRouter);

export default router;
