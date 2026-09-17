import { writeFileSync } from "node:fs";

import {
  createReleaseSourceManifest,
  releaseSourceManifestPath,
  serializeReleaseSourceManifest,
} from "./release-fingerprint";

const manifest = createReleaseSourceManifest();

writeFileSync(releaseSourceManifestPath, serializeReleaseSourceManifest(manifest));
console.log(`[release] Updated ${releaseSourceManifestPath} (${manifest.files.length} files).`);
