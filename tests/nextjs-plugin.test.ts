import { describe, it, expect } from "vitest";
import { transformSync } from "@babel/core";
import { withIfReact } from "../src/nextjs";
import ifReactBabelPlugin from "../src/babel";

// ---------------------------------------------------------------------------
// Helper: run the Babel plugin the same way @babel/core would inside webpack
// ---------------------------------------------------------------------------
function transform(code: string, options: { strict?: boolean } = {}): string {
    const result = transformSync(code, {
        plugins: [[ifReactBabelPlugin, options]],
        filename: "test.tsx",
        parserOpts: {
            plugins: ["jsx", "typescript"],
        },
        configFile: false,
        babelrc: false,
    });
    if (!result?.code) throw new Error("Transform produced no output");
    return result.code;
}

// ---------------------------------------------------------------------------
// withIfReact config API
// ---------------------------------------------------------------------------
describe("if-react Next.js Plugin", () => {
    describe("withIfReact() config API", () => {
        it("should return an object when called with no arguments", () => {
            const config = withIfReact();
            expect(config).toBeDefined();
            expect(typeof config).toBe("object");
        });

        it("should preserve existing next config properties", () => {
            const config = withIfReact({ reactStrictMode: true, poweredByHeader: false });
            expect(config.reactStrictMode).toBe(true);
            expect(config.poweredByHeader).toBe(false);
        });

        it("should expose a webpack function", () => {
            const config = withIfReact({});
            expect(typeof config.webpack).toBe("function");
        });

        it("should add a babel-loader rule for [jt]sx files", () => {
            const config = withIfReact({});
            const mockWebpackConfig: any = { module: { rules: [] } };
            config.webpack(mockWebpackConfig, {});
            expect(mockWebpackConfig.module.rules).toHaveLength(1);
            const rule = mockWebpackConfig.module.rules[0];
            expect(rule.test?.toString()).toBe("/\\.[jt]sx$/");
            expect(rule.use.loader).toBe("babel-loader");
        });

        it("should include react-if-directive/babel plugin in loader options", () => {
            const config = withIfReact({});
            const mockWebpackConfig: any = { module: { rules: [] } };
            config.webpack(mockWebpackConfig, {});
            const { plugins } = mockWebpackConfig.module.rules[0].use.options;
            const ifReactPlugin = plugins.find(
                (p: any) => Array.isArray(p) && p[0] === "react-if-directive/babel"
            );
            expect(ifReactPlugin).toBeDefined();
        });

        it("should pass strict: false by default to the babel plugin", () => {
            const config = withIfReact({});
            const mockWebpackConfig: any = { module: { rules: [] } };
            config.webpack(mockWebpackConfig, {});
            const { plugins } = mockWebpackConfig.module.rules[0].use.options;
            const ifReactPlugin = plugins.find(
                (p: any) => Array.isArray(p) && p[0] === "react-if-directive/babel"
            );
            expect(ifReactPlugin[1].strict).toBe(false);
        });

        it("should forward strict: true to the babel plugin", () => {
            const config = withIfReact({}, { strict: true });
            const mockWebpackConfig: any = { module: { rules: [] } };
            config.webpack(mockWebpackConfig, {});
            const { plugins } = mockWebpackConfig.module.rules[0].use.options;
            const ifReactPlugin = plugins.find(
                (p: any) => Array.isArray(p) && p[0] === "react-if-directive/babel"
            );
            expect(ifReactPlugin[1].strict).toBe(true);
        });

        it("should still call the original webpack function if one was provided", () => {
            let called = false;
            const originalWebpack = (cfg: any) => {
                called = true;
                return cfg;
            };
            const config = withIfReact({ webpack: originalWebpack });
            config.webpack({ module: { rules: [] } } as any, {});
            expect(called).toBe(true);
        });

        it("should return the result of the original webpack function", () => {
            const sentinel = { module: { rules: [] }, sentinel: true };
            const config = withIfReact({ webpack: () => sentinel });
            const result = config.webpack({ module: { rules: [] } } as any, {});
            expect(result).toBe(sentinel);
        });
    });

    // -------------------------------------------------------------------------
    // Actual JSX transformations (Next.js-style patterns)
    // -------------------------------------------------------------------------
    describe("Next.js JSX Transform", () => {
        // --- Pages Router -------------------------------------------------------

        it("should transform r-if in a Pages Router page component", () => {
            const input = `
                export default function Home({ isLoggedIn }) {
                    return (
                        <main>
                            <h1 r-if={isLoggedIn}>Welcome back!</h1>
                            <h1 r-else>Please log in</h1>
                        </main>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
            expect(output).toContain(":");
        });

        it("should transform directives in a component with getServerSideProps", () => {
            const input = `
                export async function getServerSideProps() {
                    return { props: { user: null } };
                }
                export default function Profile({ user }) {
                    return (
                        <div>
                            <section r-if={user}>
                                <p>Hello, {user?.name}</p>
                            </section>
                            <section r-else>
                                <p>Not found</p>
                            </section>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
            expect(output).toContain("getServerSideProps");
        });

        it("should transform directives in a component with getStaticProps", () => {
            const input = `
                export async function getStaticProps() {
                    return { props: { posts: [] } };
                }
                export default function Blog({ posts }) {
                    return (
                        <ul>
                            <li r-if={posts.length === 0}>No posts yet.</li>
                            <li r-else-if={posts.length === 1}>One post.</li>
                            <li r-else>{posts.length} posts.</li>
                        </ul>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else-if");
            expect(output).not.toContain("r-else");
            expect(output.match(/\?/g)?.length).toBe(2);
            expect(output).toContain("getStaticProps");
        });

        // --- App Router ---------------------------------------------------------

        it("should transform directives in an App Router page (server component)", () => {
            const input = `
                export default async function Page({ params }: { params: { id: string } }) {
                    const data = await fetch('/api/data');
                    return (
                        <article>
                            <h1 r-if={data.ok}>Content loaded</h1>
                            <h1 r-else>Failed to load</h1>
                        </article>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
        });

        it("should transform directives in a 'use client' component", () => {
            const input = `
                "use client";
                import { useState } from "react";
                export default function Counter() {
                    const [count, setCount] = useState(0);
                    return (
                        <div>
                            <p r-if={count === 0}>No clicks yet</p>
                            <p r-else-if={count < 10}>Keep clicking! ({count})</p>
                            <p r-else>Great job! ({count})</p>
                            <button onClick={() => setCount(c => c + 1)}>Click</button>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).toContain('"use client"');
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else-if");
            expect(output).not.toContain("r-else");
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should transform directives in a 'use server' action component", () => {
            const input = `
                "use server";
                export default function Form({ submitted }: { submitted: boolean }) {
                    return (
                        <form>
                            <p r-if={submitted}>Thank you!</p>
                            <button r-else type="submit">Submit</button>
                        </form>
                    );
                }
            `;
            const output = transform(input);
            expect(output).toContain('"use server"');
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
        });

        it("should transform directives in an App Router layout component", () => {
            const input = `
                export default function RootLayout({
                    children,
                    isAdmin,
                }: {
                    children: React.ReactNode;
                    isAdmin: boolean;
                }) {
                    return (
                        <html lang="en">
                            <body>
                                <nav r-if={isAdmin}>Admin Nav</nav>
                                <nav r-else>User Nav</nav>
                                {children}
                            </body>
                        </html>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
        });

        it("should transform directives in a loading.tsx boundary", () => {
            const input = `
                export default function Loading({ slow }: { slow: boolean }) {
                    return (
                        <div>
                            <span r-if={slow}>Still loading, please wait…</span>
                            <span r-else>Loading…</span>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            expect(output).toContain("?");
        });

        // --- Unprefixed aliases -------------------------------------------------

        it("should transform unprefixed if/else-if/else in a Next.js component", () => {
            const input = `
                "use client";
                export default function Status({ status }: { status: string }) {
                    return (
                        <div>
                            <span if={status === "loading"}>Loading…</span>
                            <span else-if={status === "error"}>Error!</span>
                            <span else>Ready</span>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toMatch(/ if=/);
            expect(output).not.toContain("else-if");
            expect(output).not.toMatch(/ else>/);
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should transform mixed r-* and unprefixed aliases in a Next.js component", () => {
            const input = `
                export default function Mixed({ a, b }: { a: boolean; b: boolean }) {
                    return (
                        <div>
                            <p r-if={a}>A is true</p>
                            <p else-if={b}>B is true</p>
                            <p r-else>Neither</p>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("else-if");
            expect(output).not.toContain("r-else");
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        // --- Props preservation -------------------------------------------------

        it("should preserve className, style and other props after transform", () => {
            const input = `
                export default function Card({ show, title }: { show: boolean; title: string }) {
                    return (
                        <div>
                            <h2
                                r-if={show}
                                className="card-title"
                                style={{ color: "red" }}
                                data-testid="title"
                            >
                                {title}
                            </h2>
                            <p r-else className="fallback">Nothing here</p>
                        </div>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
            // @babel/generator preserves JSX attribute syntax
            expect(output).toContain('className="card-title"');
            expect(output).toContain('data-testid="title"');
            expect(output).toContain('className="fallback"');
        });

        // --- Nested / complex ---------------------------------------------------

        it("should transform nested directives in a complex Next.js component", () => {
            const input = `
                "use client";
                export default function Dashboard({ user, isAdmin, isLoading }: any) {
                    return (
                        <main>
                            <div r-if={isLoading}>
                                <p>Loading dashboard…</p>
                            </div>
                            <div r-else-if={!user}>
                                <p>Please sign in</p>
                            </div>
                            <div r-else>
                                <section r-if={isAdmin}>Admin panel</section>
                                <section r-else>User panel</section>
                            </div>
                        </main>
                    );
                }
            `;
            const output = transform(input);
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else-if");
            expect(output).not.toContain("r-else");
            // outer chain: 2 ternaries; inner chain: 1 ternary — total 3
            expect(output.match(/\?/g)?.length).toBe(3);
        });
    });
});

