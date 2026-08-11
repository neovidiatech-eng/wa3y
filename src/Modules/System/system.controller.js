
import {
  asyncHandler,
  errorResponse,
  successResponse,
} from "../../Utils/Response.js";
import * as db from "../../database/dbService.js";
import { formatSchedules } from "../../Utils/Date/time.js";
import { rbacCache } from "../../Utils/RBAC/cache.js";
import dayjs from "dayjs";

export const getAllRoles = asyncHandler(async (req, res, next) => {
  const { search } = req.query;
  let where = {};
  if (search) {
    where.name = {
      contains: search,
    };
  }
  const include = {
    rolePermissions: {
      include: {
        permission: true,
      },
    },
  };
  const roles = await db.findMany({ model: "role", where, include });
  const mappedRoles = roles.map((role) => ({
    id: role.id,
    name: role.name,
    permissions: role.rolePermissions.map((rp) => ({
      id: rp.permission.id,
      name: rp.permission.name,
      code: rp.permission.code,
      resource: rp.permission.resource,
      method: rp.permission.method,
    })),
  }));
  return successResponse({
    res,
    req,
    status: 200,
    message: "FETCH_SUCCESS",
    data: mappedRoles,
  });
});
export const createRole = asyncHandler(async (req, res, next) => {
  const { name, permissionIds } = req.body;
  if (!name) {
    return errorResponse({
      req,
      next,
      message: "MISSING_NAME",
      status: 400,
    });
  }
  const existsRole = await db.findOne({
    model: "role",
    where: {
      name,
    },
  });
  if (existsRole) {
    return errorResponse({
      req,
      next,
      message: "ROLE_EXISTS",
      status: 400,
    });
  }

  const newRole = await db.transaction(async (tx) => {
    const role = await tx.create({
      model: "role",
      data: {
        name,
      },
    });

    if (
      permissionIds &&
      Array.isArray(permissionIds) &&
      permissionIds.length > 0
    ) {
      const rolePermissionsData = permissionIds.map((permId) => ({
        roleId: role.id,
        permissionId: permId,
      }));

      await tx.createMany({
        model: "rolePermission",
        data: rolePermissionsData,
      });
    }

    return role;
  });

  return successResponse({
    res,
    req,
    status: 200,
    message: "CREATE_SUCCESS",
    data: newRole,
  });
});

export const assignRoleToUser = asyncHandler(async (req, res, next) => {
  const { user_id } = req.params;
  const { role_id } = req.body;

  if (!role_id) {
    return errorResponse({
      req,
      next,
      message: "MISSING_ROLE_ID",
      status: 400,
    });
  }
  const existsRole = await db.findOne({
    model: "role",
    where: {
      id: role_id,
    },
  });
  if (!existsRole) {
    return errorResponse({
      req,
      next,
      message: "ROLE_NOT_FOUND",
      status: 400,
    });
  }
  const newRole = await db.updateOne({
    model: "user",
    where: {
      id: user_id,
    },
    data: {
      roleId: role_id,
    },
    include: {
      role: true,
    },
  });

  // Invalidate permissions cache for the user
  await rbacCache.invalidateUserCache(user_id);

  return successResponse({
    res,
    req,
    status: 200,
    message: "ROLE_ASSIGNED_SUCCESS",
    data: {
      newRole,
    },
  });
});

export const updateRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) {
    return errorResponse({ req, next, message: "MISSING_NAME", status: 400 });
  }

  const role = await db.findOne({
    model: "role",
    where: { id },
  });

  if (!role) {
    return errorResponse({
      req,
      next,
      message: "ROLE_NOT_FOUND",
      status: 404,
    });
  }

  if (name) {
    const existsRole = await db.findOne({
      model: "role",
      where: { name },
    });

    if (existsRole && existsRole.id !== id) {
      return errorResponse({
        req,
        next,
        message: "ROLE_EXISTS",
        status: 400,
      });
    }
  }

  const updatedRole = await db.updateOne({
    model: "role",
    where: { id },
    data: { name },
  });

  // Invalidate permissions cache on role update
  await rbacCache.invalidateRoleCache(id);

  return successResponse({
    res,
    req,
    status: 200,
    message: "UPDATE_SUCCESS",
    data: updatedRole,
  });
});

export const deleteRole = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const role = await db.findOne({
    model: "role",
    where: { id },
  });

  if (!role) {
    return errorResponse({
      req,
      next,
      message: "ROLE_NOT_FOUND",
      status: 404,
    });
  }

  await db.deleteOne({
    model: "role",
    where: { id },
  });

  // Invalidate permissions cache on role deletion
  await rbacCache.invalidateRoleCache(id);

  return successResponse({
    res,
    req,
    status: 200,
    message: "DELETE_SUCCESS",
  });
});

export const getDashboard = asyncHandler(async (req, res, next) => {
  const now = dayjs().tz(req.timezone || "Africa/Cairo");
  const startOfDay = now.startOf("day").utc().toDate();
  const endOfDay = now.endOf("day").utc().toDate();
  const sevenDaysAgo = now.subtract(7, "day").startOf("day").utc().toDate();
  const startOfMonth = now.startOf("month").utc().toDate();
  const endOfMonth = now.endOf("month").utc().toDate();

  const [
    studentsCount,
    teachersCount,
    stuffCount,
    parentsCount,
    pendingRequestsCount,
    todaySessionsCount,
    totalRevenueAgg,
    monthlyRevenueAgg,
    allSubscriptions,
    upcomingSessions,
    lastSevenDaysSessions,
  ] = await Promise.all([
    db.count({ model: "student" }),
    db.count({ model: "teacher" }),
    db.count({ model: "stuff" }),
    db.count({
      model: "user",
      where: {
        OR: [
          { parentStudents: { some: {} } },
          { role: { name: { equals: "parent", mode: "insensitive" } } },
        ],
      },
    }),
    db.count({ model: "session_request", where: { status: "pending" } }),
    db.count({
      model: "schedule",
      where: { start_time: { gte: startOfDay, lte: endOfDay } },
    }),

    // Total Revenue (all-time completed revenue)
    db.aggregate({
      model: "transaction",
      where: {
        status: "completed",
        type: { in: ["subscription", "credit"] },
      },
      _sum: { amount: true },
    }),

    // Monthly Revenue (current month completed revenue)
    db.aggregate({
      model: "transaction",
      where: {
        status: "completed",
        type: { in: ["subscription", "credit"] },
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    }),

    // All Subscriptions to analyze statuses
    db.findMany({
      model: "Subscription",
      include: {
        plan: { select: { name_en: true, name_ar: true, duration: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            student: { select: { sessions_remaining: true } },
          },
        },
      },
    }),

    // Upcoming Sessions (Today only)
    db.findMany({
      model: "schedule",
      where: {
        start_time: { gte: startOfDay, lte: endOfDay },
        status: { not: "cancelled" },
      },
      orderBy: { start_time: "asc" },
      include: {
        subject: true,
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      },
    }),

    // Sessions for last 7 days
    db.findMany({
      model: "schedule",
      where: { start_time: { gte: sevenDaysAgo } },
      select: { start_time: true },
    }),
  ]);

  const totalRevenue = Number((totalRevenueAgg?._sum?.amount || 0).toFixed(2));
  const monthlyRevenue = Number((monthlyRevenueAgg?._sum?.amount || 0).toFixed(2));

  // Analyze Subscription Statuses & Collect Expiring Subscriptions (<= 7 days)
  let activeSubscriptionsCount = 0;
  let expiringSoonSubscriptionsCount = 0;
  let expiredSubscriptionsCount = 0;
  const expiringSoonSubscriptionsList = [];

  for (const sub of allSubscriptions) {
    const durationDays = sub.plan?.duration || 30;
    const startDate = dayjs(sub.startDate || sub.createdAt);
    const endDate = startDate.add(durationDays, "day");
    const daysLeft = endDate.diff(now, "day");
    const sessionsRemaining = sub.user?.student?.sessions_remaining ?? 0;
    const planName = sub.plan?.name_en || sub.plan?.name_ar || "Plan";
    const userName = sub.user?.name || "Student";

    if (sub.status === "expired" || daysLeft <= 0 || sessionsRemaining <= 0) {
      expiredSubscriptionsCount++;
    } else if (daysLeft <= 7 || sessionsRemaining <= 2) {
      expiringSoonSubscriptionsCount++;
      expiringSoonSubscriptionsList.push({
        id: sub.id,
        userName,
        planName,
        daysLeft,
        sessionsRemaining,
        endDate: endDate.toDate(),
      });
    } else if (sub.status === "active") {
      activeSubscriptionsCount++;
    } else {
      expiredSubscriptionsCount++;
    }
  }

  const subscriptionsStatus = {
    active: activeSubscriptionsCount,
    expiringSoon: expiringSoonSubscriptionsCount,
    expired: expiredSubscriptionsCount,
  };

  // Process Sessions per Day
  const sessionsPerDay = [];
  for (let i = 6; i >= 0; i--) {
    const date = now.subtract(i, "day").format("YYYY-MM-DD");
    const count = lastSevenDaysSessions.filter(
      (s) => dayjs.utc(s.start_time).tz(req.timezone || "Africa/Cairo").format("YYYY-MM-DD") === date,
    ).length;
    sessionsPerDay.push({ date, count });
  }

  // Activity Feed (ONLY expiring subscriptions within 7 days)
  const activityFeed = expiringSoonSubscriptionsList
    .map((sub) => ({
      id: sub.id,
      type: "subscription_expiring",
      title: `Subscription for ${sub.userName} (${sub.planName}) will expire in ${sub.daysLeft} day(s)`,
      time: sub.endDate,
      user: sub.userName,
      daysLeft: sub.daysLeft,
      sessionsRemaining: sub.sessionsRemaining,
      avatar: null,
    }))
    .sort((a, b) => new Date(a.time) - new Date(b.time));

  return successResponse({
    res,
    req,
    data: {
      stats: {
        totalStudents: studentsCount,
        totalTeachers: teachersCount,
        pendingRequests: pendingRequestsCount,
        todaySessions: todaySessionsCount,
        totalRevenue,
        monthlyRevenue,
        subscriptions: subscriptionsStatus,
      },
      subscriptionsStatus,
      sessionsPerDay,
      upcomingSessions: upcomingSessions.map((s) => ({
        id: s.id,
        title: s.title,
        subject: s.subject?.name_en || "Subject",
        time: s.start_time,
        ...formatSchedules(s, req.timezone),
        teacher: s.teacher?.user?.name || "Teacher",
        student: s.student?.user?.name || "Student",
      })),
      activityFeed,
      activeUsers: {
        students: studentsCount,
        instructors: teachersCount,
        admins: stuffCount,
        parents: parentsCount,
      },
    },
    status: 200,
    message: "FETCH_SUCCESS",
  });
});

// --- Permission CRUD & Assignment ---

export const createPermission = asyncHandler(async (req, res, next) => {
  const { name, resource, method } = req.body;
  if (!name || !resource || !method) {
    return errorResponse({
      req,
      next,
      message: "MISSING_FIELDS",
      status: 400,
    });
  }

  const existsPermission = await db.findFirst({
    model: "permission",
    where: {
      resource: resource.toLowerCase(),
      method: method.toUpperCase(),
    },
  });

  if (existsPermission) {
    return errorResponse({
      req,
      next,
      message: "PERMISSION_EXISTS",
      status: 400,
    });
  }

  const newPermission = await db.create({
    model: "permission",
    data: {
      name,
      resource: resource.toLowerCase(),
      method: method.toUpperCase(),
    },
  });

  return successResponse({
    res,
    req,
    status: 201,
    message: "CREATE_SUCCESS",
    data: newPermission,
  });
});

export const getPermissions = asyncHandler(async (req, res, next) => {
  const permissions = await db.findMany({
    model: "permission",
  });

  // Group permissions by resource
  const grouped = permissions.reduce((acc, perm) => {
    const resource = perm.resource || "general";
    if (!acc[resource]) {
      acc[resource] = [];
    }
    acc[resource].push(perm);
    return acc;
  }, {});

  return successResponse({
    res,
    req,
    status: 200,
    message: "FETCH_SUCCESS",
    data: grouped,
  });
});

export const deletePermission = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const permission = await db.findOne({
    model: "permission",
    where: { id },
  });

  if (!permission) {
    return errorResponse({
      req,
      next,
      message: "PERMISSION_NOT_FOUND",
      status: 404,
    });
  }

  // Find roles that had this permission before deleting
  const rolePermissions = await db.findMany({
    model: "rolePermission",
    where: { permissionId: id },
  });

  await db.deleteOne({
    model: "permission",
    where: { id },
  });

  for (const rp of rolePermissions) {
    await rbacCache.invalidateRoleCache(rp.roleId);
  }

  return successResponse({
    res,
    req,
    status: 200,
    message: "DELETE_SUCCESS",
  });
});

export const assignPermissionsToRole = asyncHandler(async (req, res, next) => {
  const { roleId, permissionIds } = req.body;
  if (!roleId || !permissionIds || !Array.isArray(permissionIds)) {
    return errorResponse({
      req,
      next,
      message: "MISSING_FIELDS",
      status: 400,
    });
  }

  const role = await db.findOne({
    model: "role",
    where: { id: roleId },
  });

  if (!role) {
    return errorResponse({
      req,
      next,
      message: "ROLE_NOT_FOUND",
      status: 404,
    });
  }

 const newMappings = await db.transaction(async (tx) => {
    await tx.deleteMany({
      model: "rolePermission",
      where: { roleId },
    });

    if (permissionIds.length > 0) {
      const mappings = permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      }));
      await tx.createMany({
        model: "rolePermission",
        data: mappings,
      });
    }
  });

  // Invalidate cache for this role
  await rbacCache.invalidateRoleCache(roleId);

  return successResponse({
    res,
    req,
    status: 200,
    message: "ASSIGN_SUCCESS",
    data: newMappings,
  });
});

export const revokePermissionsFromRole = asyncHandler(async (req, res, next) => {
  const { roleId, permissionIds } = req.body;
  if (!roleId || !permissionIds) {
    return errorResponse({
      req,
      next,
      message: "MISSING_FIELDS",
      status: 400,
    });
  }

  const exists = await db.findMany({
    model: "rolePermission",
    where: { roleId, permissionId: {in: permissionIds} },
  });

  if (exists.length === 0) {
    return errorResponse({
      req,
      next,
      message: "MAPPING_NOT_FOUND",
      status: 404,
    });
  }

  await db.deleteMany({
    model: "rolePermission",
    where: {
      id: {in: exists.map(r => r.id)},
    },
  });

  // Invalidate cache for this role
  await rbacCache.invalidateRoleCache(roleId);

  return successResponse({
    res,
    req,
    status: 200,
    message: "REVOKE_SUCCESS",
  });
});
