import bcrypt from "bcryptjs";
import { dbPrisma } from "../lib/db";

async function main() {
  const hashedPassword = await bcrypt.hash("12345678", 10);

  const admin = await dbPrisma.user.upsert({
    where: { email: "dodikds@gmail.com" },
    update: {
      firstName: "Dodik",
      lastName: "Dwi Sancoko",
      password: hashedPassword,
      role: "admin",
    },
    create: {
      firstName: "Dodik",
      lastName: "Dwi Sancoko",
      email: "dodikds@gmail.com",
      password: hashedPassword,
      phoneNumber: null,
      image: null,
      role: "admin",
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbPrisma.$disconnect();
  });
