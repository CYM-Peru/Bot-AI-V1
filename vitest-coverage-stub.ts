import type { CoverageProvider, CoverageProviderModule } from "vitest";

class NoopCoverageProvider implements CoverageProvider {
  name = "noop";

  initialize() {}

  resolveOptions() {
    return {
      provider: "custom",
      enabled: false,
      clean: false,
      cleanOnRerun: false,
      reportsDirectory: "coverage",
      reporter: [["text", {}]],
      exclude: [],
      extension: [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs"],
      reportOnFailure: false,
      allowExternal: false,
      processingConcurrency: 1,
    };
  }

  clean() {}

  onAfterSuiteRun() {}

  reportCoverage() {}
}

const module: CoverageProviderModule = {
  getProvider() {
    return new NoopCoverageProvider();
  },
};

export default module;
