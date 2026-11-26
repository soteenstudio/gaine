import type { NextConfig } from "next";
import { withGaineSpeed } from "@gaine/nextjs/config";

const config: NextConfig = {};

// Speed preset: optimizePackageImports, inline CSS (Tailwind), AVIF/WebP, no X-Powered-By.
// Options: withGaineSpeed(config, { inlineCss: false, immutable: ["fonts"], reactCompiler: true })
export default withGaineSpeed(config);
