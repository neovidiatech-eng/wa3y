import { Router } from "express";
import { authorize } from "../../Middlewares/AuthorizationMiddleware.js";
import { authentication } from "../../Middlewares/Authentication.js";
import { PERMISSIONS_V2 } from "../../Constants/permissions.constants.js";
import * as moderatorController from "./moderator.controller.js";
import { validation } from "../../Middlewares/Validation.js";
import * as schemas from "./moderator.validation.js";

const router = Router();

router.get(
  "/",
  authentication(),
  authorize(PERMISSIONS_V2.MODERATORS.READ),
  validation(schemas.getAllModerators),
  moderatorController.getAllModerators
);

router.post(
  "/",
  authentication(),
  authorize(PERMISSIONS_V2.MODERATORS.CREATE),
  validation(schemas.createModerator),
  moderatorController.createModerator
);

router.get(
  "/:id",
  authentication(),
  authorize(PERMISSIONS_V2.MODERATORS.READ),
  validation(schemas.getModeratorById),
  moderatorController.getModeratorById
);

router.put(
  "/:id",
  authentication(),
  authorize(PERMISSIONS_V2.MODERATORS.UPDATE),
  validation(schemas.updateModerator),
  moderatorController.updateModerator
);

router.delete(
  "/:id",
  authentication(),
  authorize(PERMISSIONS_V2.MODERATORS.DELETE),
  validation(schemas.deleteModerator),
  moderatorController.deleteModerator
);

export default router;