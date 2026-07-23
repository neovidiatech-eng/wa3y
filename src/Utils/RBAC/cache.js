import { redis } from "../Radis/Connection.js";
import * as db from "../../database/dbService.js";

const CACHE_TTL = 3600; // Cache permissions for 1 hour

export const rbacCache = {
  getRolePermissionsKey(roleId) {
    return `rbac:role:${roleId}:permissions`;
  },

  async getRolePermissions(roleId) {
    try {
      const data = await redis.get(this.getRolePermissionsKey(roleId));
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.error("Redis get error:", err);
      return null;
    }
  },

  async setRolePermissions(roleId, permissions) {
    try {
      await redis.set(
        this.getRolePermissionsKey(roleId),
        JSON.stringify(permissions),
        { EX: CACHE_TTL }
      );
    } catch (err) {
      console.error("Redis set error:", err);
    }
  },

  async invalidateUserCache(userId) {
    try {
      if (userId) {
        await redis.del(`user:${userId}`);
      }
    } catch (err) {
      console.error("Redis invalidate user error:", err);
    }
  },

  async invalidateRoleCache(roleId) {
    try {
      await redis.del(this.getRolePermissionsKey(roleId));
      if (roleId) {
        const users = await db.findMany({
          model: "user",
          where: { roleId },
          select: { id: true },
        });
        for (const u of users) {
          await redis.del(`user:${u.id}`);
        }
      }
    } catch (err) {
      console.error("Redis invalidate role error:", err);
    }
  },
};

