import { downloadBlob } from "@/lib/utils";

const FILES = [
  "manifest.json",
  "background.js",
  "content.js",
  "popup.html",
  "popup.js",
  "icon.svg",
  "icon-48.png",
  "icon-128.png",
] as const;

/** Pack the companion as an unsigned .xpi (zip of the extension root). */
export async function downloadFieldKitXpi(): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const name of FILES) {
    const res = await fetch(`/spammeraegis-extension/${name}`);
    if (!res.ok) throw new Error(`Missing ${name}`);
    zip.file(name, await res.arrayBuffer());
  }
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/x-xpinstall",
    compression: "DEFLATE",
  });
  downloadBlob("spammeraegis-field-kit-0.1.0.xpi", blob);
}
