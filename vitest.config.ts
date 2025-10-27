import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const reactFlowMock = fileURLToPath(new URL("./src/__mocks__/reactflow.tsx", import.meta.url));

export default defineConfig({
  test: {
    alias: {
      reactflow: reactFlowMock,
    },
    coverage: {
      provider: "custom",
      customProviderModule: "./vitest-coverage-stub.ts",
    },
  },
});
