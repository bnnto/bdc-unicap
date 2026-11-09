import tseslint from "typescript-eslint";
import vitest from "@vitest/eslint-plugin";

export default tseslint.config(
  {
    files: ["tests/**/*.{ts,tsx}"],
    extends: [tseslint.configs.base],
    plugins: { vitest },
    rules: {
      // Empty Test / Unknown Test
      "vitest/expect-expect": [
        "warn",
        { assertFunctionNames: ["expect", "expect*", "assert*"] },
      ],

      // Conditional Test Logic
      "vitest/no-conditional-in-test": "warn",
      "vitest/no-conditional-expect": "warn",

      // Assertion Roulette (ajuste o limite conforme o seu critério)
      "vitest/max-expects": ["warn", { max: 3 }],

      // Ignored Test
      "vitest/no-disabled-tests": "warn",
      "vitest/no-focused-tests": "error",
      "vitest/no-commented-out-tests": "warn",

      // Duplicate Test / Duplicate hooks
      "vitest/no-identical-title": "warn",
      "vitest/no-duplicate-hooks": "warn",

      // Print Statement
      "no-console": "warn",

      // Magic Number Test
      "no-magic-numbers": ["warn", {
        ignore: [0, 1, 2, 3, -1],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreClassFieldInitialValues: true,
        detectObjects: false,
      }],

      // Sleepy Test
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.name='setTimeout']",
          message: "Sleepy Test: use vi.useFakeTimers() ou waitFor.",
        },
      ],
    },
  },
);