import express from "express";
import { deviceController } from "../controllers/device.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.get("/", authenticateToken, deviceController.getAllDevices);
router.get("/status", authenticateToken, deviceController.getStatusSummary);
router.get("/:code", authenticateToken, deviceController.findDeviceByCode);
router.post("/", authenticateToken, deviceController.createDevice);
router.put("/:id", authenticateToken, deviceController.updateDevice);
router.delete("/:id", authenticateToken, deviceController.deleteDevice);
