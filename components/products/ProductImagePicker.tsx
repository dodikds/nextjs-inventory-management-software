"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import styles from "./ProductImagePicker.module.css";

export type ExistingProductImage = { id: string; path: string };

type NewImageEntry = { key: string; file: File; previewUrl: string };

type ProductImagePickerProps = {
  // Only ever non-empty in edit mode. Each stays included in the submitted
  // `keepImageIds` list (a hidden input per image) unless removed here —
  // the server only deletes rows whose id is *not* in that list, so an
  // update that changes nothing about images doesn't need this component
  // to do anything special to "keep" them.
  existingImages?: ExistingProductImage[];
  // Lets ProductForm fold "has the image selection changed" into its own
  // Cancel-confirmation dirty check, without needing to own this
  // component's file/removal state itself.
  onDirtyChange?: (dirty: boolean) => void;
};

export default function ProductImagePicker({ existingImages = [], onDirtyChange }: ProductImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removedExistingIds, setRemovedExistingIds] = useState<Set<string>>(new Set());
  const [newImages, setNewImages] = useState<NewImageEntry[]>([]);

  useEffect(() => {
    // Revoke every still-live preview URL on unmount — the same cleanup
    // ProfileForm/UserForm do for their single-avatar preview, just for a
    // whole list here.
    return () => {
      for (const entry of newImages) URL.revokeObjectURL(entry.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount-only cleanup, not meant to re-run when newImages changes
  }, []);

  // A native multi-file <input> *replaces* its FileList on every pick
  // rather than accumulating — so "select a few, then select a few more"
  // would otherwise silently drop the first batch, and there'd be no way
  // to remove a single already-picked file at all. Rebuilding the input's
  // own `.files` from a DataTransfer after every add/remove keeps the
  // browser's FileList in sync with `newImages`, so the surrounding
  // <form>'s native submission still just works — the server (which reads
  // `formData.getAll("images")`) needs no changes for any of this.
  function syncInputFiles(next: NewImageEntry[]) {
    const dataTransfer = new DataTransfer();
    for (const entry of next) dataTransfer.items.add(entry.file);
    if (inputRef.current) inputRef.current.files = dataTransfer.files;
  }

  // Each handler below reads current state via closure and calls setState
  // directly (a plain event handler, not an effect) — including notifying
  // the parent via `onDirtyChange`, right alongside the state update that
  // caused it, rather than watching for the change from an effect. See
  // https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers,
  // which specifically calls out "passing data to the parent" via an Effect
  // as the pattern to avoid.
  function handleFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;

    const added = picked.map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    const next = [...newImages, ...added];
    syncInputFiles(next);
    setNewImages(next);
    onDirtyChange?.(next.length > 0 || removedExistingIds.size > 0);
  }

  function removeNewImage(key: string) {
    const target = newImages.find((entry) => entry.key === key);
    if (target) URL.revokeObjectURL(target.previewUrl);

    const next = newImages.filter((entry) => entry.key !== key);
    syncInputFiles(next);
    setNewImages(next);
    onDirtyChange?.(next.length > 0 || removedExistingIds.size > 0);
  }

  function toggleRemoveExisting(id: string) {
    const next = new Set(removedExistingIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setRemovedExistingIds(next);
    onDirtyChange?.(newImages.length > 0 || next.size > 0);
  }

  const visibleExisting = existingImages.filter((image) => !removedExistingIds.has(image.id));
  const totalCount = visibleExisting.length + newImages.length;

  return (
    <div className="gg-field">
      <label className="gg-label" htmlFor="images">
        Multiple Image
      </label>
      <div className={styles["gg-file"]}>
        <label htmlFor="images" className={styles["gg-file-btn"]}>
          Choose Files
        </label>
        <span className={styles["gg-file-name"]}>
          {totalCount > 0 ? `${totalCount} image${totalCount > 1 ? "s" : ""}` : "No file chosen"}
        </span>
      </div>
      <input
        ref={inputRef}
        id="images"
        name="images"
        type="file"
        accept="image/*"
        multiple
        className="file-input"
        onChange={handleFilesPicked}
      />

      {existingImages.map((image) =>
        removedExistingIds.has(image.id) ? null : (
          <input key={image.id} type="hidden" name="keepImageIds" value={image.id} />
        ),
      )}

      {totalCount > 0 && (
        <div className={styles.grid}>
          {visibleExisting.map((image) => (
            <div key={image.id} className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element -- locally uploaded product image, not an optimizable remote asset */}
              <img src={image.path} alt="" />
              <button
                type="button"
                className={styles.remove}
                title="Remove image"
                onClick={() => toggleRemoveExisting(image.id)}
              >
                <X />
              </button>
            </div>
          ))}
          {newImages.map((entry) => (
            <div key={entry.key} className={styles.thumb}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a not-yet-uploaded file */}
              <img src={entry.previewUrl} alt="" />
              <button
                type="button"
                className={styles.remove}
                title="Remove image"
                onClick={() => removeNewImage(entry.key)}
              >
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
