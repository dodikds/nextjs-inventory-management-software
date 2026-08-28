import bcrypt from "bcryptjs";
import { dbPrisma } from "../lib/db";

async function seedAdminUser() {
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

const SUPPLIER_SEED_DATA = [
  { name: "Aurum Trading Co.", city: "Dubai", country: "United Arab Emirates" },
  { name: "Silk Route Imports", city: "Istanbul", country: "Turkey" },
  { name: "Northern Lights Supply", city: "Oslo", country: "Norway" },
  { name: "Pacific Rim Goods", city: "Singapore", country: "Singapore" },
  { name: "Andes Craft Exports", city: "Lima", country: "Peru" },
  { name: "Golden Delta Traders", city: "Ho Chi Minh City", country: "Vietnam" },
  { name: "Highland Textiles", city: "Edinburgh", country: "United Kingdom" },
  { name: "Sahara Sourcing LLC", city: "Cairo", country: "Egypt" },
  { name: "Maple Leaf Wholesale", city: "Toronto", country: "Canada" },
  { name: "Cedar & Stone Supply", city: "Beirut", country: "Lebanon" },
  { name: "Ivory Coast Naturals", city: "Abidjan", country: "Côte d'Ivoire" },
  { name: "Baltic Amber Traders", city: "Riga", country: "Latvia" },
  { name: "Kyoto Craft Works", city: "Kyoto", country: "Japan" },
  { name: "Outback Mineral Supply", city: "Perth", country: "Australia" },
  { name: "Alpine Precision Parts", city: "Zurich", country: "Switzerland" },
  { name: "Savanna Textile Group", city: "Nairobi", country: "Kenya" },
  { name: "Monsoon Spice Traders", city: "Kochi", country: "India" },
  { name: "Nordic Timber Exports", city: "Helsinki", country: "Finland" },
  { name: "Copper Basin Metals", city: "Santiago", country: "Chile" },
  { name: "Fjord Seafood Supply", city: "Bergen", country: "Norway" },
  { name: "Sundance Leather Co.", city: "Austin", country: "United States" },
  { name: "Lotus Ceramics Ltd.", city: "Jingdezhen", country: "China" },
  { name: "Atlas Mountain Goods", city: "Marrakesh", country: "Morocco" },
  { name: "Danube Glassworks", city: "Vienna", country: "Austria" },
  { name: "Coral Bay Packaging", city: "Cape Town", country: "South Africa" },
] as const;

// Built from numeric char codes (Unicode combining diacritical marks block,
// U+0300–U+036F) rather than a literal escape sequence in source, since
// that range is otherwise awkward to embed unambiguously as plain text.
const DIACRITIC_MARKS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITIC_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function seedSuppliers() {
  let created = 0;

  for (const [index, supplier] of SUPPLIER_SEED_DATA.entries()) {
    const slug = slugify(supplier.name);
    const email = `contact@${slug}.com`;

    await dbPrisma.supplier.upsert({
      where: { email },
      update: {},
      create: {
        name: supplier.name,
        email,
        phone: `+1-555-${String(1000 + index).padStart(4, "0")}`,
        country: supplier.country,
        city: supplier.city,
        address: `${100 + index} Market Street, ${supplier.city}`,
      },
    });
    created += 1;
  }

  console.log(`Seeded ${created} suppliers`);
}

// The POS falls back to this record when no specific customer is selected,
// so it must always exist. Looked up by `isDefault` rather than a unique
// email/name (Customer has neither constraint) since those fields stay
// editable and aren't guaranteed unique.
async function seedDefaultCustomer() {
  const existing = await dbPrisma.customer.findFirst({ where: { isDefault: true } });
  if (existing) {
    console.log(`Default customer already exists: ${existing.name}`);
    return;
  }

  const customer = await dbPrisma.customer.create({
    data: {
      name: "direct-customer",
      email: "customer@gildedglow.com",
      phoneNumber: "123456789",
      country: "N/A",
      city: "N/A",
      address: "N/A",
      isDefault: true,
    },
  });

  console.log(`Seeded default customer: ${customer.name}`);
}

// Seeds the fixed set of role names the Users create/edit form's Role
// dropdown reads from (see app/(dashboard)/users/queries.ts::getRoles).
// "admin" must exist since seedAdminUser() assigns it above.
const ROLE_SEED_DATA = ["admin", "manager", "cashier"] as const;

async function seedRoles() {
  for (const name of ROLE_SEED_DATA) {
    await dbPrisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(`Seeded ${ROLE_SEED_DATA.length} roles`);
}

// Seeds the fixed set of unit names the Products create/edit form's Product
// Unit dropdown reads from (see app/(dashboard)/products/queries.ts::getUnits).
const UNIT_SEED_DATA = ["Piece", "Kilogram", "Meter"] as const;

async function seedUnits() {
  for (const name of UNIT_SEED_DATA) {
    await dbPrisma.unit.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(`Seeded ${UNIT_SEED_DATA.length} units`);
}

async function main() {
  await seedAdminUser();
  await seedRoles();
  await seedUnits();
  await seedSuppliers();
  await seedDefaultCustomer();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbPrisma.$disconnect();
  });
