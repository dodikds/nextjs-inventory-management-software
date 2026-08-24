"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/auth";
import { dbPrisma } from "@/lib/db";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordResult = { success: true } | { success: false; error: string };

export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "You must be signed in to do that" };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await dbPrisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { success: false, error: "You must be signed in to do that" };
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return { success: false, error: "Current password is incorrect" };
  }

  const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
  if (isSameAsCurrent) {
    return { success: false, error: "New password must be different from your current password" };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await dbPrisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Possible future enhancement: sign the user out here (or otherwise
  // invalidate their current session) so they have to re-authenticate with
  // the new password. Not implemented yet — the existing session stays
  // valid after this call.

  return { success: true };
}
