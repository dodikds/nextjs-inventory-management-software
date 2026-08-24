"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { dbPrisma } from "@/lib/db";
import { isWarehouseInUse } from "./queries";

const warehouseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email address"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  zipCode: z.string().min(1, "Zip code is required"),
});

const idSchema = z.string().min(1, "Invalid warehouse id");

export type WarehouseActionResult = { success: true } | { success: false; error: string };

function parseWarehouseFormData(formData: FormData) {
  return warehouseSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber"),
    country: formData.get("country"),
    city: formData.get("city"),
    zipCode: formData.get("zipCode"),
  });
}

export async function createWarehouse(formData: FormData): Promise<WarehouseActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_warehouses")) {
    return { success: false, error: "You don't have permission to manage warehouses" };
  }

  const parsed = parseWarehouseFormData(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await dbPrisma.warehouse.create({ data: parsed.data });

  revalidatePath("/warehouse");

  return { success: true };
}

// `id` is bound server-side via `updateWarehouse.bind(null, id)` in the edit
// page (a Server Component, so `id` there comes from the trusted URL route
// param) rather than read from `formData`. That's deliberate: a hidden
// `<input name="id">` would be part of the rendered HTML and editable via
// devtools, letting a client point the update at a different warehouse than
// the one it was authorized to edit. A bound argument can't be tampered with
// that way.
export async function updateWarehouse(id: string, formData: FormData): Promise<WarehouseActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_warehouses")) {
    return { success: false, error: "You don't have permission to manage warehouses" };
  }

  const parsed = parseWarehouseFormData(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const existing = await dbPrisma.warehouse.findFirst({ where: { id, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Warehouse not found" };
  }

  await dbPrisma.warehouse.update({ where: { id }, data: parsed.data });

  revalidatePath("/warehouse");
  revalidatePath(`/warehouse/${id}/edit`);

  return { success: true };
}

// Called directly as `deleteWarehouse(id)` from the row's delete button
// rather than via `.bind()` — unlike the edit form, there's no hidden form
// field here for a client to tamper with in the DOM; `id` is just a plain
// argument passed from data the server already rendered. The action still
// never trusts that the id is real or current: it re-fetches and validates
// it itself (existing, not already soft-deleted, not in use) before acting.
export async function deleteWarehouse(id: string): Promise<WarehouseActionResult> {
  const session = await auth();
  if (!hasPermission(session, "manage_warehouses")) {
    return { success: false, error: "You don't have permission to manage warehouses" };
  }

  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return { success: false, error: parsedId.error.issues[0].message };
  }

  const existing = await dbPrisma.warehouse.findFirst({ where: { id: parsedId.data, deletedAt: null } });
  if (!existing) {
    return { success: false, error: "Warehouse not found" };
  }

  if (await isWarehouseInUse(parsedId.data)) {
    return { success: false, error: "This warehouse has related records and can't be deleted" };
  }

  await dbPrisma.warehouse.update({ where: { id: parsedId.data }, data: { deletedAt: new Date() } });

  revalidatePath("/warehouse");

  return { success: true };
}
