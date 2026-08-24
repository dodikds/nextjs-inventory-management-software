"use server";

import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.email("Enter a valid email address"),
  phoneNumber: z.string().optional(),
});

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export type UpdateProfileResult =
  | {
      success: true;
      user: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string | null;
        image: string | null;
      };
    }
  | { success: false; error: string };

export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "You must be signed in to do that" };
  }

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phoneNumber: formData.get("phoneNumber") || undefined,
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { firstName, lastName, email, phoneNumber } = parsed.data;

  // NOTE: Role is intentionally never read from this form. This is a
  // self-service profile page, so allowing a role value here would let any
  // user promote themselves (e.g. to "admin"). Role changes must go through
  // the admin Users page, acting on a *different* user's record.

  const existing = await dbPrisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    return { success: false, error: "That email is already in use" };
  }

  let imagePath: string | undefined;
  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    const ext = ALLOWED_IMAGE_TYPES[imageFile.type];
    if (!ext) {
      return { success: false, error: "Please upload a JPG, PNG, WEBP, or GIF image" };
    }

    const bytes = await imageFile.arrayBuffer();
    const filename = `${userId}-${Date.now()}${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    imagePath = `/uploads/avatars/${filename}`;
  }

  const updated = await dbPrisma.user.update({
    where: { id: userId },
    data: {
      firstName,
      lastName,
      email,
      phoneNumber: phoneNumber || null,
      ...(imagePath ? { image: imagePath } : {}),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return {
    success: true,
    user: {
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      phoneNumber: updated.phoneNumber,
      image: updated.image,
    },
  };
}
