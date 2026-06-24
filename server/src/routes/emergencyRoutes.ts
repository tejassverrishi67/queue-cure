import { Router } from "express";
import {
  getEmergencies,
  submitEmergency,
  reviewEmergency
} from "../controllers/emergencyController";

const router = Router();

router.get("/", getEmergencies);
router.post("/", submitEmergency);
router.post("/review", reviewEmergency);

export default router;
