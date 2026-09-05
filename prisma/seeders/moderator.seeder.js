import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import dotenv from "dotenv";
import { encryptPassword } from "../../src/Utils/Security/index.js";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const moderatorData = [
  {
    name: "Moderator One",
    email: "moderator1@lms.com",
    password: "Password@123",
    phone: "1110001111",
    code_country: "+20",
    roleName: "moderator",
  },
  {
    name: "Moderator Two",
    email: "moderator2@lms.com",
    password: "Password@123",
    phone: "1110002222",
    code_country: "+20",
    roleName: "moderator",
  },
];

export async function seedModerators() {
  console.log("Start seeding moderators...");

  const seededModerators = [];

  for (const item of moderatorData) {
    let role = await prisma.role.findUnique({
      where: { name: item.roleName },
    });

    if (!role) {
      console.warn(`Role ${item.roleName} not found, using null or attempting role lookup.`);
    }

    const encryptedPassword = encryptPassword({ password: item.password });

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: { 
        name: item.name,
        phone: item.phone,
        code_country: item.code_country,
        roleId: role?.id ?? undefined,
        status: "active",
      },
      create: {
        email: item.email,
        password: encryptedPassword,
        name: item.name,
        phone: item.phone,
        code_country: item.code_country,
        status: "active",
        confirmAt: new Date(),
        roleId: role?.id ?? undefined,
      },
    });

    // Upsert moderator
    const moderator = await prisma.moderator.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    });

    seededModerators.push(moderator);
  }

  // Optionally seed student-moderator relationships if students exist
  const students = await prisma.student.findMany({ take: 2 });
  if (students.length > 0 && seededModerators.length > 0) {
    console.log("Seeding student-moderator relationships...");
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const moderator = seededModerators[i % seededModerators.length];

      const existingRelation = await prisma.student_moderator.findFirst({
        where: {
          studentId: student.id,
          moderatorId: moderator.id,
        },
      });

      if (!existingRelation) {
        await prisma.student_moderator.create({
          data: {
            studentId: student.id,
            moderatorId: moderator.id,
          },
        });
      }
    }
  }

  console.log("Seeded moderators successfully.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedModerators()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
