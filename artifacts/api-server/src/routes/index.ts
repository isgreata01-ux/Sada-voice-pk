import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountRouter from "./voice-studio/account";
import voiceRouter from "./voice-studio/voices";
import adminRouter from "./voice-studio/admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountRouter);
router.use(voiceRouter);
router.use(adminRouter);

export default router;
