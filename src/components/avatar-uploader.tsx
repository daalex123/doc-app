"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientAvatar } from "@/components/patient-avatar";
import { SubmitButton } from "@/components/form-bits";
import type { AvatarActionState } from "@/app/actions/avatars";

type UploadAction = (prev: AvatarActionState, formData: FormData) => Promise<AvatarActionState>;
type RemoveAction = () => Promise<AvatarActionState>;

const SIZE = 512;
const ACCEPT = "image/jpeg,image/png,image/webp";

/** Centre-crop to a square and downscale to 512px JPEG. */
async function squareJpeg(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

export function AvatarUploader({
  name,
  currentUrl,
  hasPhoto,
  uploadAction,
  removeAction,
}: {
  name: string;
  currentUrl: string | null;
  hasPhoto: boolean;
  uploadAction: UploadAction;
  removeAction: RemoveAction;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const reset = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };
  // After a successful save/remove the page re-renders with a fresh signed URL.
  const [upState, upForm] = useActionState(
    async (prev: AvatarActionState, fd: FormData) => {
      const r = await uploadAction(prev, fd);
      if (r.ok) reset();
      return r;
    },
    {},
  );
  const [rmState, rmForm] = useActionState(
    async () => {
      const r = await removeAction();
      if (r.ok) reset();
      return r;
    },
    {},
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Release the object URL when the preview changes or the component unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setLocalError(null);
    if (!file) return setPreview(null);
    setProcessing(true);
    try {
      const processed = await squareJpeg(file);
      const dt = new DataTransfer();
      dt.items.add(processed);
      input.files = dt.files;
      setPreview(URL.createObjectURL(processed));
    } catch {
      input.value = "";
      setPreview(null);
      setLocalError("That file could not be read as an image.");
    } finally {
      setProcessing(false);
    }
  }

  const error = localError ?? upState.error ?? rmState.error;
  const shown = preview ?? currentUrl;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Photo</CardTitle>
        <CardDescription>
          Optional. The photo is cropped to a square and stored privately.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {upState.ok && !error ? (
          <p role="status" className="text-sm text-muted-foreground">Photo saved.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <PatientAvatar name={name} src={shown} size="lg" />
          <form action={upForm} className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              id="avatar"
              name="avatar"
              type="file"
              accept={ACCEPT}
              onChange={onPick}
              aria-label="Choose a photo"
              className="max-w-56 text-sm file:mr-2 file:rounded-md file:border file:bg-secondary file:px-2.5 file:py-1.5 file:text-sm"
            />
            {processing ? (
              <Loader2Icon className="size-4 animate-spin text-muted-foreground" aria-label="Processing" />
            ) : null}
            {preview ? (
              <SubmitButton pendingText="Uploading...">
                <UploadIcon /> Save photo
              </SubmitButton>
            ) : null}
          </form>
          {hasPhoto && !preview ? (
            <form action={rmForm}>
              <SubmitButton variant="outline" pendingText="Removing...">
                <Trash2Icon /> Remove photo
              </SubmitButton>
            </form>
          ) : null}
          {preview ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPreview(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
