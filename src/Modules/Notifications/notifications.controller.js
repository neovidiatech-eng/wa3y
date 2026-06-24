import { asyncHandler, successResponse, errorResponse } from "../../Utils/Response.js";
import * as db from "../../database/dbService.js";
import { getIO } from "../../Utils/Socket/index.js";

// GET /admin/notifications
export const getAdminNotifications = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, isRead, search, type, category } = req.query;
  const adminId = req.user.id;

  let where = {
    AND: [
      {
        OR: [
          { userId: adminId },
          { userId: "admin" },
        ],
      },
    ],
  };

  if (isRead !== undefined) {
    const isReadBool = isRead === "true" || isRead === true;
    where.AND.push({ isRead: isReadBool });
  }

  if (search) {
    where.AND.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (type) {
    where.AND.push({ type });
  }

  if (category) {
    if (category === "students") {
      where.AND.push({ type: "new_student" });
    } else if (category === "teachers") {
      where.AND.push({ type: "new_teacher" });
    } else if (category === "sessions") {
      where.AND.push({
        type: {
          in: [
            "session_created",
            "session_cancelled",
            "session_updated",
            "session_missed",
            "teacher_late",
            "session_request_created",
            "session_request_approved",
            "session_request_rejected"
          ]
        }
      });
    }
  }

  const { items: notifications, pagination } = await db.findManyWithPaginationAndCount({
    model: "notification",
    where,
    page: parseInt(page),
    limit: parseInt(limit),
    orderBy: { createdAt: "desc" },
  });

  // Global unread notifications count for the admin
  const totalUnreadCount = await db.count({
    model: "notification",
    where: {
      OR: [
        { userId: adminId },
        { userId: "admin" },
      ],
      isRead: false,
    },
  });

  // Filtered unread notifications count
  const filteredUnreadWhere = {
    ...where,
    AND: [
      ...where.AND.filter(cond => cond.isRead === undefined),
      { isRead: false }
    ]
  };
  const unreadCount = await db.count({
    model: "notification",
    where: filteredUnreadWhere,
  });

  return successResponse({
    res,
    req,
    message: "FETCH_SUCCESS",
    data: {
      notifications,
      pagination,
      unreadCount,
      totalUnreadCount,
    },
  });
});

// PATCH /admin/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res, next) => {
  const adminId = req.user.id;

  await db.updateMany({
    model: "notification",
    where: {
      OR: [
        { userId: adminId },
        { userId: "admin" },
      ],
      isRead: false,
    },
    data: { isRead: true },
  });

  return successResponse({
    res,
    req,
    message: "UPDATE_SUCCESS",
  });
});

// PATCH /admin/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user.id;

  const notification = await db.findFirst({
    model: "notification",
    where: {
      id,
      OR: [
        { userId: adminId },
        { userId: "admin" },
      ],
    },
  });

  if (!notification) {
    return errorResponse({ req, next, message: "NOTIFICATION_NOT_FOUND", status: 404 });
  }

  const updatedNotification = await db.updateOne({
    model: "notification",
    where: { id },
    data: { isRead: true },
  });

  return successResponse({
    res,
    req,
    message: "UPDATE_SUCCESS",
    data: updatedNotification,
  });
});

// DELETE /admin/notifications/:id
export const deleteNotification = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const adminId = req.user.id;

  const notification = await db.findFirst({
    model: "notification",
    where: {
      id,
      OR: [
        { userId: adminId },
        { userId: "admin" },
      ],
    },
  });

  if (!notification) {
    return errorResponse({ req, next, message: "NOTIFICATION_NOT_FOUND", status: 404 });
  }

  await db.deleteOne({
    model: "notification",
    where: { id },
  });

  return successResponse({
    res,
    req,
    message: "DELETE_SUCCESS",
  });
});

// POST /admin/notifications
export const sendNotification = asyncHandler(async (req, res, next) => {
  const { title, message, type, targetType, userId } = req.body;

  let targetUserIds = [];

  if (targetType === "single") {
    const targetUser = await db.findOne({
      model: "user",
      where: { id: userId },
    });

    if (!targetUser) {
      return errorResponse({ req, next, message: "USER_NOT_FOUND", status: 404 });
    }

    targetUserIds = [userId];
  } else {
    // Find role to target
    let roleName = "";
    if (targetType === "teachers") roleName = "teacher";
    else if (targetType === "students") roleName = "student";
    else if (targetType === "parents") roleName = "parent";

    let whereClause = { status: "active" };

    if (roleName) {
      const role = await db.findFirst({
        model: "role",
        where: { name: { equals: roleName, mode: "insensitive" } },
      });

      if (!role) {
        return errorResponse({ req, next, message: "ROLE_NOT_FOUND", status: 404 });
      }

      whereClause.roleId = role.id;
    }

    const targetUsers = await db.findMany({
      model: "user",
      where: whereClause,
      select: { id: true },
    });

    targetUserIds = targetUsers.map(u => u.id);
  }

  if (targetUserIds.length === 0) {
    return errorResponse({ req, next, message: "NO_TARGET_USERS_FOUND", status: 404 });
  }

  const notificationData = targetUserIds.map(uid => ({
    userId: uid,
    title,
    message,
    type: type || "system_broadcast",
  }));

  await db.createMany({
    model: "notification",
    data: notificationData,
  });

  // Real-time socket push to target users
  const io = getIO();
  if (io) {
    targetUserIds.forEach(uid => {
      io.to(`user_${uid}`).emit("notification", {
        title,
        message,
        type: type || "system_broadcast",
        createdAt: new Date(),
      });
    });
  }

  return successResponse({
    res,
    req,
    status: 201,
    message: "CREATE_SUCCESS",
    data: {
      sentCount: targetUserIds.length,
    },
  });
});

export const createAdminNotification = async ({ title, message, type }) => {
  try {
    const notification = await db.create({
      model: "notification",
      data: {
        userId: "admin",
        title,
        message,
        type,
      },
    });

    const io = getIO();
    if (io) {
      io.to("user_admin").emit("notification", notification);
    }
    return notification;
  } catch (error) {
    console.error("Failed to create admin notification:", error);
  }
};

