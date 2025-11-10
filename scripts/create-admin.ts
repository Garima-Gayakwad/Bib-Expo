import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is not set. Add it to your .env file.");
}

// Use the same adapter-based client as the app
const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

// Admin definitions – extend this list to add more admins
const ADMINS: { name: string; phone: string; password: string }[] = [
  {
    name: "Super Admin",
    phone: process.env.ADMIN_PHONE ?? "9987688443",
    password: process.env.ADMIN_PASSWORD ?? "admin123",
  },
  {
    name: "Super Admin 2",
    phone: process.env.ADMIN_PHONE_2 ?? "9820360727",
    password: process.env.ADMIN_PASSWORD_2 ?? "admin123",
  },
];

async function main() {
  for (const adminDef of ADMINS) {
    if (!adminDef.phone.trim()) continue;

    const hashedPassword = await bcrypt.hash(adminDef.password, 10);

    const admin = await prisma.volunteer.upsert({
      where: { phone: adminDef.phone },
      update: {
        name: adminDef.name,
        password: hashedPassword,
        role: "ADMIN",
      },
      create: {
        name: adminDef.name,
        phone: adminDef.phone,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    console.log("Admin ensured:");
    console.log("  Name:", adminDef.name);
    console.log("  Phone:", adminDef.phone);
    console.log("  Password:", adminDef.password);
    console.log("  Id:", admin.id);
    console.log("----");
  }
}

main()
  .catch((err) => {
    console.error("Create-admin error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

