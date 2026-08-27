"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, CircleAlert, Image as ImageIcon, Pencil, X } from "lucide-react";
import {
  useMasterDataModal,
  type MasterDataActionResult,
  type MasterDataFieldErrors,
} from "./MasterDataModalContext";

type MasterDataModalProps = {
  // e.g. "Brand", "Product Category" — used for the "Create {x}"/"Edit {x}"
  // title and the success toast.
  entityLabel: string;
  createAction: (formData: FormData) => Promise<MasterDataActionResult>;
  updateAction: (id: string, formData: FormData) => Promise<MasterDataActionResult>;
};

export default function MasterDataModal({ entityLabel, createAction, updateAction }: MasterDataModalProps) {
  const router = useRouter();
  const { state, close } = useMasterDataModal();
  const isOpen = state.mode !== "closed";
  const isEdit = state.mode === "edit";

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<MasterDataFieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset the form's local fields (including any error left over from a
  // previous attempt) whenever the modal is opened for a different target —
  // a fresh Create, or a *different* row's Edit — keyed off `state` itself
  // (a new object on every openCreate/openEdit/close) rather than just
  // `isOpen`, since switching straight from editing one row to editing
  // another must also reset the fields. Adjusting state during render
  // (rather than in a useEffect) per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    setName(state.mode === "edit" ? state.row.name : "");
    setLogoFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setErrors({});
    setFormMessage(null);
  }

  // Focusing the name field is a real side effect (an imperative DOM call),
  // so it stays in an effect rather than joining the state adjustment above.
  useEffect(() => {
    if (state.mode !== "closed") nameInputRef.current?.focus();
  }, [state]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  function handleLogoClick() {
    fileInputRef.current?.click();
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const formData = new FormData();
    formData.set("name", name);
    if (logoFile) formData.set("logo", logoFile);

    startTransition(async () => {
      const result = state.mode === "edit" ? await updateAction(state.row.id, formData) : await createAction(formData);

      if (!result.success) {
        setErrors(result.errors ?? {});
        setFormMessage(result.message ?? (result.errors ? "Please fix the errors below" : null));
        return;
      }

      toast.success(isEdit ? `${entityLabel} updated` : `${entityLabel} created`);
      close();
      router.refresh();
    });
  }

  const existingLogo = state.mode === "edit" ? state.row.logo : null;
  const avatarSrc = previewUrl ?? existingLogo;

  return (
    <div
      className={`gg-overlay${isOpen ? " is-open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="gg-modal" role="dialog" aria-modal="true">
        <div className="gg-modal-head">
          <span className="gg-card-title">{isEdit ? `Edit ${entityLabel}` : `Create ${entityLabel}`}</span>
          <button className="gg-modal-close" type="button" onClick={close}>
            <X />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gg-modal-body">
            {formMessage && !errors.name && (
              <p className="field-error">
                <CircleAlert /> {formMessage}
              </p>
            )}
            <div className="gg-field">
              <label className="gg-label" htmlFor="master-data-name">
                Name <span className="gg-req">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="master-data-name"
                name="name"
                className={`gg-input${errors.name ? " is-error" : ""}`}
                placeholder="Enter Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => (prev.name ? { ...prev, name: undefined } : prev));
                }}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "master-data-name-error" : undefined}
                required
              />
              {errors.name && (
                <span id="master-data-name-error" className="field-error">
                  <CircleAlert /> {errors.name}
                </span>
              )}
            </div>
            <div className="gg-field">
              <label className="gg-label">Change Logo</label>
              <div className="logo-drop">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element -- locally uploaded logo, not an optimizable remote asset
                  <img src={avatarSrc} alt="" />
                ) : (
                  <ImageIcon className="ph" />
                )}
                <button type="button" className="logo-edit" title="Change logo" onClick={handleLogoClick}>
                  <Pencil />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="file-input"
                  onChange={handleLogoChange}
                />
              </div>
            </div>
          </div>
          <div className="gg-modal-foot">
            <button className="gg-btn gg-btn--primary" type="submit" disabled={isPending}>
              <Check /> {isPending ? "Saving..." : "Save"}
            </button>
            <button className="gg-btn gg-btn--secondary" type="button" onClick={close} disabled={isPending}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
