import { Router } from "express";
import {
  getSettings,
  updateSettings,
  callNextPatient,
  resetQueue
} from "../controllers/queueController";

const router = Router();

router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.post("/next", callNextPatient);
router.post("/reset", resetQueue);

export default router;
