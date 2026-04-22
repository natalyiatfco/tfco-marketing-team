import { Router, type IRouter } from "express";
import healthRouter from "./health";
import propertiesRouter from "./properties";
import agentsRouter from "./agents";
import tasksRouter from "./tasks";
import reviewsRouter from "./reviews";
import dashboardRouter from "./dashboard";
import publishRouter from "./publish";

const router: IRouter = Router();

router.use(healthRouter);
router.use(propertiesRouter);
router.use(agentsRouter);
router.use(tasksRouter);
router.use(reviewsRouter);
router.use(dashboardRouter);
router.use(publishRouter);

export default router;
