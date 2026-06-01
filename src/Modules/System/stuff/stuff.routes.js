import { Router } from "express";
import { validation } from "../../../Middlewares/Validation.js";
import {
  addParentSchema,
  createStuffUserSchema,
  deleteStuffUserSchema,
  getAllStuffSchema,
  getStuffByIdSchema,
  updateStuffUserSchema,
} from "./stuff.validation.js";
import * as stuffController from "./stuff.controller.js";
import { authentication } from "../../../Middlewares/Authentication.js";
import { authorizeResource } from "../../../Middlewares/AuthorizationMiddleware.js";

const router = Router();

router.get(
  "/",
  authentication(),
  authorizeResource("users"),
  validation(getAllStuffSchema),
  stuffController.getAllStuff,
);
router.get(
  "/:id",
  authentication(),
  authorizeResource("users"),
  validation(getStuffByIdSchema),
  stuffController.getStuffById,
);
router.post(
  "/create",
  authentication(),
  authorizeResource("users"),
  validation(createStuffUserSchema),
  stuffController.createStuffUser,
);
router.patch(
  "/update/:id",
  authentication(),
  authorizeResource("users"),
  validation(updateStuffUserSchema),
  stuffController.updateStuffUser,
);
router.delete(
  "/delete/:id",
  authentication(),
  authorizeResource("users"),
  validation(deleteStuffUserSchema),
  stuffController.deleteStuffUser,
);

router.post("/create-parent", validation(addParentSchema), stuffController.registerParent);

export default router;
