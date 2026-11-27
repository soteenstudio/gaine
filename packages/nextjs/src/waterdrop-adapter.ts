/*
 * Copyright 2026 SoTeen Studio
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { join } from "node:path";
import { runWaterdrop, type WaterdropOptions } from "@gaine/core/waterdrop";

interface BuildContext {
  projectDir: string;
  distDir: string;
  config: {
    basePath?: string;
    output?: string;
  };
}

export default {
  name: "gaine-waterdrop",
  async onBuildComplete(ctx: BuildContext) {
    const raw = process.env.GAINE_WATERDROP_OPTIONS;
    const options = raw
      ? (JSON.parse(raw) as WaterdropOptions & { failOnBudget?: boolean; quiet?: boolean })
      : {};
    const exportMode = ctx.config?.output === "export";
    const outDir = exportMode ? join(ctx.projectDir, "out") : ctx.distDir;
    const failOnBudget = options.failOnBudget ?? true;
    const result = await runWaterdrop({
      ...options,
      root: ctx.projectDir,
      outDir,
      mode: "build",
      base: ctx.config?.basePath || "/",
      report: options.report ?? { path: join(outDir, "waterdrop-report.json") },
    });
    if (!options.quiet) {
      console.log(`Waterdrop optimized ${result.report.summary.assets} assets in ${outDir}`);
    }
    if (!result.report.budgetOk && failOnBudget) {
      throw new Error(
        `Waterdrop performance budget exceeded:\n${result.report.budgetFailures.join("\n")}`,
      );
    }
  },
};
