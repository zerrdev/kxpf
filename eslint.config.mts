import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Base JavaScript/Node.js configuration
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // CLI-specific rules
      "no-console": "off", // Allow console for CLI applications
      
      // Essential code quality rules
      "prefer-const": "error",
      "no-var": "error",
      "no-unused-expressions": "error",
      "no-implicit-globals": "error",
      "no-global-assign": "error",
      "dot-notation": "error",
      "no-caller": "error",
      "no-throw-literal": "error",
      "no-eval": "error",
    }
  },
  
  // TypeScript recommended rules (catches common bugs)
  tseslint.configs.recommended,
  
  // TypeScript strict rules (for better type safety)
  tseslint.configs.strict,
  
  // TypeScript stylistic rules (for consistent code style)
  tseslint.configs.stylistic,
  
  // Override specific rules for better developer experience
  {
    rules: {
      // Allow explicit any for error handling and external APIs
      "@typescript-eslint/no-explicit-any": "warn",
      
      // Allow non-null assertion when necessary (with caution)
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // Make unused vars a warning instead of error (easier development)
      "@typescript-eslint/no-unused-vars": "warn",
      
      // Allow empty functions for interface implementations
      "@typescript-eslint/no-empty-function": "off",
      
      // Allow throwing literals in CLI context
      "no-throw-literal": "off",
      
      // Allow implicit any catch for error handling
      "@typescript-eslint/no-implicit-any-catch": "off",
      
      // Ensure proper async/await usage (basic rules only)
      "require-await": "off", // ESLint's basic version doesn't work well with TS
      
      // Prefer readonly for better immutability (disabled - requires type information)
      "@typescript-eslint/prefer-readonly": "off",
      
      // Allow explicit return types on public APIs only
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      
      // Comment rules
      "@typescript-eslint/ban-ts-comment": "warn",
      
      // Disable rules that are too strict for this project
      "@typescript-eslint/no-require-imports": "off", // Allow require for dynamic imports
      "@typescript-eslint/array-type": "off", // Allow both Array<T> and T[] syntax
      "@typescript-eslint/no-extraneous-class": "off", // Allow utility classes
    }
  }
]);
