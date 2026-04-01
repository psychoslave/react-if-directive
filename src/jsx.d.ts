/**
 * TypeScript declarations for if-react directives.
 *
 * Import this file in your project to get TypeScript support:
 *
 * @example
 * ```ts
 * // In your src/vite-env.d.ts or a global.d.ts file:
 * /// <reference types="if-react/types" />
 * ```
 *
 * Or add to tsconfig.json:
 * ```json
 * {
 *     "compilerOptions": {
 *         "types": ["if-react/types"]
 *     }
 * }
 * ```
 */

import "react";

declare module "react" {
    interface HTMLAttributes<T> {
        /**
         * Conditionally render this element.
         *
         * @example
         * ```tsx
         * <div r-if={isVisible}>Visible content</div>
         * ```
         */
        "r-if"?: boolean | unknown;
        "if"?: boolean | unknown;

        /**
         * Render this element if the previous `r-if` or `r-else-if` was false.
         * Must immediately follow an element with `r-if` or `r-else-if`.
         *
         * @example
         * ```tsx
         * <div r-if={status === "loading"}>Loading...</div>
         * <div r-else-if={status === "error"}>Error occurred</div>
         * ```
         */
        "r-else-if"?: boolean | unknown;
        "else-if"?: boolean | unknown;

        /**
         * Render this element if all previous `r-if` and `r-else-if` conditions were false.
         * Must immediately follow an element with `r-if` or `r-else-if`.
         * Must be the last element in a conditional chain.
         *
         * @example
         * ```tsx
         * <div r-if={status === "loading"}>Loading...</div>
         * <div r-else-if={status === "error"}>Error</div>
         * <div r-else>Content loaded</div>
         * ```
         */
        "r-else"?: boolean;
        "else"?: boolean;
    }

    interface SVGAttributes<T> {
        /**
         * Conditionally render this SVG element.
         */
        "r-if"?: boolean | unknown;
        "if"?: boolean | unknown;

        /**
         * Render this SVG element if the previous `r-if` or `r-else-if` was false.
         */
        "r-else-if"?: boolean | unknown;
        "else-if"?: boolean | unknown;

        /**
         * Render this SVG element if all previous conditions were false.
         */
        "r-else"?: boolean;
        "else"?: boolean;
    }
}

// Also extend IntrinsicElements for custom components
declare global {
    namespace JSX {
        interface IntrinsicAttributes {
            /**
             * Conditionally render this component.
             */
            "r-if"?: boolean | unknown;
            "if"?: boolean | unknown;

            /**
             * Render this component if the previous `r-if` or `r-else-if` was false.
             */
            "r-else-if"?: boolean | unknown;
            "else-if"?: boolean | unknown;

            /**
             * Render this component if all previous conditions were false.
             */
            "r-else"?: boolean;
            "else"?: boolean;
        }
    }
}

export {};
