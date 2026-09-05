import * as db from "../../database/dbService.js";
import { baseRoles } from "../../Utils/Enums/roles.js";
import { encryptPassword } from "../../Utils/Security/index.js";

export const getAllModerators = async (req) => {
  const {
    page = 1,
    limit = 10,
    search,
    orderBy: orderByQuery,
    order,
  } = req.query;
  const where = {};
  let orderBy = {};

  if (search?.trim()) {
    const value = search.trim();
    where.user = {
      OR: [
        { name: { contains: value, mode: "insensitive" } },
        { email: { contains: value, mode: "insensitive" } },
      ],
    };
  }

  if (orderByQuery === "createdAt") {
    orderBy = {
      createdAt: order === "asc" ? "asc" : "desc",
    };
  } else if (orderByQuery === "active") {
    orderBy = {
      status: order === "asc" ? "asc" : "desc",
    };
  } else {
    // Default sorting
    orderBy = {
      createdAt: "desc",
    };
  }

  const moderators = await db.findManyWithPaginationAndCount({
    model: "moderator",
    page,
    limit,
    where,
    orderBy,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      },
      studentModerators: {
        include: {
          student: true,
        },
      },
    },
  });
  return moderators;
};

export const getModeratorById = async (req) => {
  const { id } = req.params;
  const moderator = await db.findOne({
    model: "moderator",
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          age: true,
          code_country: true,
          status: true,
          createdAt: true,
        },
      },
      studentModerators: {
        include: {
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!moderator) {
    const error = new Error("MODERATOR_NOT_FOUND");
    error.cause = 404;
    error.statusCode = 404;
    throw error;
  }

  return moderator;
};

export const createModerator = async (req) => {
  const {
    name,
    email,
    password,
    phone,
    age,
    gender,
    studentIds,
    codeCountry: code_country,
  } = req.body;

  const [existingUser, role, students] = await Promise.all([
    db.findOne({ model: "user", where: { email } }),
    db.findOne({ model: "role", where: { name: baseRoles.MODERATOR } }),
    db.findMany({ model: "student", where: { id: { in: studentIds } } }),
  ]);
 if (students.length !== studentIds.length) {
  const missingStudents = studentIds.filter((id) => !students.some((s) => s.id === id));
  const error = new Error("STUDENTS_NOT_FOUND");
  error.cause = 404;
  error.statusCode = 404;
  throw error;
 }  


  if (existingUser) {
    const error = new Error("EMAIL_EXISTS");
    error.cause = 400;
    error.statusCode = 400;
    throw error;
  }

  if (!role) {
    const error = new Error("ROLE_NOT_FOUND");
    error.cause = 400;
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = password ? encryptPassword({ password }) : undefined;
  const mappedStudents = students.map((student) => ({
    studentId: student.id,
  }));

  const moderator = await db.create({
    model: "moderator",
    data: {
      gender,
      user: {
        create: {
          name,
          email,
          password: hashedPassword,
          phone,
          age,
          code_country,
          status: "active",
          confirmAt: new Date(),
          role: {
            connect: {
              id: role.id,
            },
          },
        },
      },
      studentModerators: {
        create: mappedStudents,
      },
    },
  });

  return moderator;
};

export const updateModerator = async (req) => {
  const { id } = req.params;
  const {
    name,
    email,
    password,
    phone,
    age,
    gender,
    status,
    studentIds,
    codeCountry: code_country,
  } = req.body;

  const moderator = await db.findOne({
    model: "moderator",
    where: { id },
    include: { user: true },
  });

  if (!moderator) {
    const error = new Error("MODERATOR_NOT_FOUND");
    error.cause = 404;
    error.statusCode = 404;
    throw error;
  }

  if (email && email !== moderator.user.email) {
    const existingUser = await db.findOne({ model: "user", where: { email } });
    if (existingUser) {
      const error = new Error("EMAIL_EXISTS");
      error.cause = 400;
      error.statusCode = 400;
      throw error;
    }
  }

  // Update user model fields
  const userDataToUpdate = {};
  if (name !== undefined) userDataToUpdate.name = name;
  if (email !== undefined) userDataToUpdate.email = email;
  if (phone !== undefined) userDataToUpdate.phone = phone;
  if (age !== undefined) userDataToUpdate.age = age;
  if (code_country !== undefined) userDataToUpdate.code_country = code_country;
  if (status !== undefined) userDataToUpdate.status = status;
  if (password) {
    userDataToUpdate.password = encryptPassword({ password });
  }

  if (Object.keys(userDataToUpdate).length > 0) {
    await db.update({
      model: "user",
      where: { id: moderator.userId },
      data: userDataToUpdate,
    });
  }

  // Update moderator model fields
  const modDataToUpdate = {};
  if (gender !== undefined) modDataToUpdate.gender = gender;
  if (status !== undefined) modDataToUpdate.status = status;

  if (Object.keys(modDataToUpdate).length > 0) {
    await db.update({
      model: "moderator",
      where: { id },
      data: modDataToUpdate,
    });
  }

  // Sync studentModerators if studentIds provided
  if (Array.isArray(studentIds)) {
    await db.deleteMany({
      model: "student_moderator",
      where: { moderatorId: id },
    });

    if (studentIds.length > 0) {
      const students = await db.findMany({
        model: "student",
        where: { id: { in: studentIds } },
      });

      for (const student of students) {
        await db.create({
          model: "student_moderator",
          data: {
            moderatorId: id,
            studentId: student.id,
          },
        });
      }
    }
  }

  return await getModeratorById(req);
};

export const deleteModerator = async (req) => {
  const { id } = req.params;

  const moderator = await db.findOne({
    model: "moderator",
    where: { id },
  });

  if (!moderator) {
    const error = new Error("MODERATOR_NOT_FOUND");
    error.cause = 404;
    error.statusCode = 404;
    throw error;
  }

  // Deleting user automatically cascades to moderator & student_moderator
  await db.deleteOne({
    model: "user",
    where: { id: moderator.userId },
  });

  return { id };
};
