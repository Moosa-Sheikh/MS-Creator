import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { UploadZone } from "./UploadZone";

type UploadedFile = {
  objectPath: string;
  previewUrl: string;
  name: string;
};

type Props = {
  option: "A" | "B";
  photoMode: "single" | "multiple";
  productImages: UploadedFile[];
  referenceImage: UploadedFile[];
  onPhotoModeChange: (mode: "single" | "multiple") => void;
  onProductImagesChange: (files: UploadedFile[]) => void;
  onReferenceImageChange: (files: UploadedFile[]) => void;
};

export function Step3PhotoUpload({
  option,
  photoMode,
  productImages,
  referenceImage,
  onPhotoModeChange,
  onProductImagesChange,
  onReferenceImageChange,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">
          {option === "A" ? "Upload Your Product Photo(s)" : "Upload Your Photos"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {option === "A"
            ? "Upload the photo(s) of your product that AI will use to create your mockup."
            : "Upload your product photo(s) and the reference mockup you want AI to analyze."}
        </p>
      </div>

      <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/10">
        <div className="flex items-center gap-3">
          <Switch
            id="photo-mode"
            checked={photoMode === "multiple"}
            onCheckedChange={(checked) => {
              onPhotoModeChange(checked ? "multiple" : "single");
              if (!checked && productImages.length > 1) {
                onProductImagesChange(productImages.slice(0, 1));
              }
            }}
          />
          <Label htmlFor="photo-mode" className="cursor-pointer">
            {photoMode === "single" ? "Single photo" : "Multiple photos"}
          </Label>
        </div>
        <UploadZone
          label="Your Product Photo(s)"
          maxFiles={photoMode === "single" ? 1 : 8}
          value={productImages}
          onChange={onProductImagesChange}
        />
      </div>

      {option === "B" && (
        <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/10">
          <UploadZone
            label="Reference Mockup Image"
            description="This is the successful mockup image you want AI to analyze — e.g., a competitor's Etsy listing photo, an expert sample, or any mockup you admire."
            maxFiles={1}
            value={referenceImage}
            onChange={onReferenceImageChange}
          />
        </div>
      )}
    </div>
  );
}
