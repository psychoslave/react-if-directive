/**
 * if-react - React conditional rendering directives
 *
 * Use `r-if`, `r-else-if`, and `r-else` attributes directly in JSX
 * for cleaner conditional rendering.
 *
 * @example
 * ```tsx
 * <div r-if={isLoading}>Loading...</div>
 * <div r-else-if={error}>Error: {error.message}</div>
 * <div r-else>Content loaded!</div>
 * ```
 *
 * @packageDocumentation
 */

// Re-export Vite plugin
export { ifReact, type IfReactPluginOptions } from "./vite";

// Re-export ESLint plugin
export { default as eslintPlugin, validDirectivesRule } from "./eslint";

// Type-only export for JSX augmentation
export type {} from "./jsx";
