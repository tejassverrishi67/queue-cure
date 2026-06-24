import { Router } from "express";
import { getPatients, registerPatient } from "../controllers/patientController";

const router = Router();

router.get("/", getPatients);
router.post("/", registerPatient);

export default router;
