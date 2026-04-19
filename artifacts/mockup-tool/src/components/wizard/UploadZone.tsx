import { useRef, useState, useCallback } from "react";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadedFile = {
  objectPath: string;
  previewUrl: string;
  name: string;
};

type Props = {
  label: string;
  description?: string;
  maxFiles?: number;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  disabled?: boolean;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

function objectPathToUrl(objectPath: string): string {
  const filename = objectPath.replace("/objects/", "");
  return `/api/storage/objects/${filename}`;
}

export function UploadZone({ label, description, maxFiles = 1, value, onChange, disabled }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const requestUrl = useRequestUploadUrl();

  const uploadFile = useCallback(
    async (file: File): Promise<UploadedFile | null> => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG, and WEBP files are accepted.");
        return null;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError("File must be under 10MB.");
        return null;
      }
      try {
        const { uploadURL, objectPath } = await requestUrl.mutateAsync({
          data: { name: file.name, size: file.size, contentType: file.type },
        });
        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        return {
          objectPath,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        };
      } catch {
        setError("Upload failed. Please try again.");
        return null;
      }
    },
    [requestUrl]
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const remaining = maxFiles - value.length;
      if (remaining <= 0) return;
      const toUpload = files.slice(0, remaining);
      setUploadingCount(toUpload.length);
      const results = await Promise.all(toUpload.map(uploadFile));
      const succeeded = results.filter((r): r is UploadedFile => r !== null);
      setUploadingCount(0);
      onChange([...value, ...succeeded]);
    },
    [maxFiles, value, uploadFile, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [disabled, handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      handleFiles(files);
      e.target.value = "";
    },
    [handleFiles]
  );

  const removeFile = (objectPath: string) => {
    onChange(value.filter((f) => f.objectPath !== objectPath));
  };

  const canAddMore = value.length < maxFiles && !disabled;
  const isUploading = uploadingCount > 0;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      {canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors text-center",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/30"
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Uploading {uploadingCount} file{uploadingCount > 1 ? "s" : ""}…
              </p>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {isDragOver ? "Drop to upload" : "Drag & drop or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  JPG, PNG, WEBP — max 10MB{maxFiles > 1 ? ` — up to ${maxFiles} files` : ""}
                </p>
              </div>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept={ACCEPTED_TYPES.join(",")}
            multiple={maxFiles > 1}
            onChange={handleInputChange}
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {value.length > 0 && (
        <div className={cn("grid gap-2", maxFiles === 1 ? "grid-cols-1" : "grid-cols-3 sm:grid-cols-4")}>
          {value.map((file) => (
            <div key={file.objectPath} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
              <img
                src={file.previewUrl || objectPathToUrl(file.objectPath)}
                alt={file.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeFile(file.objectPath)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 && !canAddMore && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-lg border border-border bg-muted/30 text-muted-foreground">
          <ImageIcon className="h-4 w-4" />
          <span className="text-sm">Max {maxFiles} file{maxFiles > 1 ? "s" : ""} reached</span>
        </div>
      )}
    </div>
  );
}
