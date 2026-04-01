/**
 * Next.js plugin for transforming r-if, r-else-if, and r-else directives
 * into standard React conditional rendering.
 *
 * This plugin integrates with Next.js by hooking into the webpack/turbopack
 * configuration and using a Babel loader.
 *
 * @example
 * ```ts
 * // next.config.js or next.config.mjs
 * import { withIfReact } from 'react-if-directive/nextjs';
 *
 * export default withIfReact(nextConfig, {
 *   strict: false
 * });
 * ```
 *
 * @example
 * ```ts
 * // next.config.mjs (for ESM)
 * import { withIfReact } from 'react-if-directive/nextjs';
 *
 * const config = {
 *   // your Next.js config here
 * };
 *
 * export default withIfReact(config);
 * ```
 */

export interface WithIfReactOptions {
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), only log warnings.
     * @default false
     */
    strict?: boolean;
}

/**
 * Higher-order function that wraps a Next.js config to add if-react support.
 *
 * @param nextConfig - The Next.js configuration object
 * @param options - Plugin options
 * @returns Modified Next.js configuration with if-react support
 *
 * @example
 * ```ts
 * import { withIfReact } from 'react-if-directive/nextjs';
 *
 * const nextConfig = {
 *   reactStrictMode: true,
 * };
 *
 * export default withIfReact(nextConfig);
 * ```
 */
export function withIfReact(
    nextConfig: any = {},
    options: WithIfReactOptions = {}
): any {
    const { strict = false } = options;

    return {
        ...nextConfig,
        webpack(config: any, context: any) {
            // Add Babel loader for JSX/TSX files with if-react plugin
            config.module.rules.push({
                test: /\.[jt]sx$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: [
                            [
                                "next/babel",
                                {
                                    // Let Next.js handle the base preset
                                },
                            ],
                        ],
                        plugins: [
                            [
                                "react-if-directive/babel",
                                {
                                    strict,
                                },
                            ],
                        ],
                    },
                },
            });

            // Call the original webpack config function if it exists
            if (typeof nextConfig.webpack === "function") {
                return nextConfig.webpack(config, context);
            }

            return config;
        },
    };
}

export default withIfReact;
