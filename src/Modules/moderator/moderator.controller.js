import { asyncHandler, successResponse } from "../../Utils/Response.js";
import * as moderatorService from "./moderator.service.js";

export const getAllModerators = asyncHandler(async (req, res, next) => {
  const data = await moderatorService.getAllModerators(req);
  return successResponse({
    req,
    res,
    data,
    message: "success",
    statusCode: 200,
    messageKey: "all_moderators_fetched_successfully",
  });
});

export const getModeratorById = asyncHandler(async (req, res, next) => {
  const data = await moderatorService.getModeratorById(req);
  return successResponse({
    req,
    res,
    data,
    message: "success",
    statusCode: 200,
    messageKey: "MODERATOR_FETCHED_SUCCESS",
  });
});

export const createModerator = asyncHandler(async (req, res, next) => {
  const data = await moderatorService.createModerator(req);
  return successResponse({
    req,
    res,
    data,
    message: "success",
    statusCode: 201,
    messageKey: "MODERATOR_CREATED_SUCCESS",
  });
});

export const updateModerator = asyncHandler(async (req, res, next) => {
  const data = await moderatorService.updateModerator(req);
  return successResponse({
    req,
    res,
    data,
    message: "success",
    statusCode: 200,
    messageKey: "MODERATOR_UPDATED_SUCCESS",
  });
});

export const deleteModerator = asyncHandler(async (req, res, next) => {
  const data = await moderatorService.deleteModerator(req);
  return successResponse({
    req,
    res,
    data,
    message: "success",
    statusCode: 200,
    messageKey: "MODERATOR_DELETED_SUCCESS",
  });
});
