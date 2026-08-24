"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { UserRound, Pencil, Check } from "lucide-react";
import { updateProfile } from "@/app/(dashboard)/profile/actions";
import styles from "./ProfileForm.module.css";

type SavedProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  image: string | null;
};

type ProfileFormProps = {
  initialData: SavedProfile & { role: string };
};

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const { update } = useSession();

  // The last-known-good values (initial load, or after a successful save) —
  // Cancel reverts the editable fields back to this, not to `initialData`,
  // since `initialData` is a one-time prop that won't reflect a save that
  // already happened without a full remount.
  const [savedData, setSavedData] = useState<SavedProfile>(initialData);

  const [firstName, setFirstName] = useState(initialData.firstName);
  const [lastName, setLastName] = useState(initialData.lastName);
  const [email, setEmail] = useState(initialData.email);
  const [phoneNumber, setPhoneNumber] = useState(initialData.phoneNumber ?? "");
  const [currentImage, setCurrentImage] = useState(initialData.image);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleImageClick() {
    fileInputRef.current?.click();
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.set("firstName", firstName);
      formData.set("lastName", lastName);
      formData.set("email", email);
      formData.set("phoneNumber", phoneNumber);
      if (imageFile) formData.set("image", imageFile);

      const result = await updateProfile(formData);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSavedData(result.user);
      setFirstName(result.user.firstName);
      setLastName(result.user.lastName);
      setEmail(result.user.email);
      setPhoneNumber(result.user.phoneNumber ?? "");
      setCurrentImage(result.user.image);
      setImageFile(null);

      await update({
        name: `${result.user.firstName} ${result.user.lastName}`,
        image: result.user.image,
      });

      toast.success("Profile updated successfully");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    setFirstName(savedData.firstName);
    setLastName(savedData.lastName);
    setEmail(savedData.email);
    setPhoneNumber(savedData.phoneNumber ?? "");
    setCurrentImage(savedData.image);
    setImageFile(null);
    setPreviewUrl(null);
  }

  const avatarSrc = previewUrl ?? currentImage;

  return (
    <div className="gg-card gg-card-pad">
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles["user-ava-wrap"]}>
          <label className="gg-label" style={{ display: "block", marginBottom: "var(--sp-3)" }}>
            Change Image
          </label>
          <div className={styles["user-ava"]}>
            <div className={styles.circ}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element -- locally uploaded avatar, not an optimizable remote asset
                <img src={avatarSrc} alt="Profile" />
              ) : (
                <UserRound />
              )}
            </div>
            <button type="button" className={styles.edit} title="Change image" onClick={handleImageClick}>
              <Pencil />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles["file-input"]}
              onChange={handleImageChange}
            />
          </div>
        </div>

        <div className="gg-form-grid">
          <div className="gg-field">
            <label className="gg-label">
              First Name <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Last Name <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              placeholder="Enter Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">
              Email <span className="gg-req">*</span>
            </label>
            <input
              className="gg-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">Phone Number</label>
            <input
              className="gg-input"
              placeholder="Enter Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          </div>
          <div className="gg-field">
            <label className="gg-label">Role</label>
            {/*
              Read-only by design: this is a self-service profile form, so a
              user must never be able to change their own role here (that
              would let anyone promote themselves to admin). Role changes
              belong on the admin Users page, editing a *different* user's
              record. The server action also never reads a role value from
              this form, even if this field were tampered with client-side.
            */}
            <input className="gg-input" value={initialData.role} disabled />
          </div>
        </div>

        <div className="gg-form-actions">
          <button className="gg-btn gg-btn--primary" type="submit" disabled={isSubmitting}>
            <Check /> {isSubmitting ? "Saving..." : "Save"}
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
