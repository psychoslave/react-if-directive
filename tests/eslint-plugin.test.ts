import { describe, it, expect } from "vitest";
import { RuleTester } from "eslint";
import plugin from "../src/eslint";

// Get the rule from the plugin
const rule = plugin.rules!["valid-directives"];

describe("if-react ESLint Plugin", () => {
    describe("Plugin Structure", () => {
        it("should export a valid ESLint plugin", () => {
            expect(plugin).toBeDefined();
            expect(plugin.rules).toBeDefined();
            expect(plugin.rules!["valid-directives"]).toBeDefined();
        });

        it("should have recommended config", () => {
            expect(plugin.configs).toBeDefined();
            expect(plugin.configs!.recommended).toBeDefined();
        });
    });

    describe("valid-directives rule", () => {
        const ruleTester = new RuleTester({
            languageOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
                parserOptions: {
                    ecmaFeatures: {
                        jsx: true,
                    },
                },
            },
        });

        it("should validate with RuleTester", () => {
            ruleTester.run("valid-directives", rule as any, {
                valid: [
                    // Simple r-if
                    {
                        code: `const App = () => <div><span r-if={show}>Text</span></div>`,
                    },
                    // r-if with r-else
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={show}>Yes</span>
                                <span r-else>No</span>
                            </div>
                        )`,
                    },
                    // r-if with r-else-if and r-else
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else-if={b}>B</span>
                                <span r-else>C</span>
                            </div>
                        )`,
                    },
                    // Multiple r-else-if
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else-if={b}>B</span>
                                <span r-else-if={c}>C</span>
                                <span r-else>D</span>
                            </div>
                        )`,
                    },
                    // Multiple independent chains
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else>Not A</span>
                                <hr />
                                <span r-if={b}>B</span>
                                <span r-else>Not B</span>
                            </div>
                        )`,
                    },
                    // Nested r-if chains
                    {
                        code: `const App = () => (
                            <div>
                                <div r-if={outer}>
                                    <span r-if={inner}>Nested</span>
                                    <span r-else>Not inner</span>
                                </div>
                                <div r-else>Not outer</div>
                            </div>
                        )`,
                    },
                    // r-if in fragment
                    {
                        code: `const App = () => (
                            <>
                                <span r-if={show}>Yes</span>
                                <span r-else>No</span>
                            </>
                        )`,
                    },
                ],
                invalid: [
                    // Orphaned r-else
                    {
                        code: `const App = () => (
                            <div>
                                <span r-else>Orphan</span>
                            </div>
                        )`,
                        errors: [{ messageId: "orphanedElse" }],
                    },
                    // Orphaned r-else-if
                    {
                        code: `const App = () => (
                            <div>
                                <span r-else-if={x}>Orphan</span>
                            </div>
                        )`,
                        errors: [{ messageId: "orphanedElseIf" }],
                    },
                    // r-else after r-else
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else>B</span>
                                <span r-else>C</span>
                            </div>
                        )`,
                        errors: [{ messageId: "afterElse" }],
                    },
                    // r-else-if after r-else
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else>B</span>
                                <span r-else-if={c}>C</span>
                            </div>
                        )`,
                        errors: [{ messageId: "afterElse" }],
                    },
                    // r-if without condition
                    {
                        code: `const App = () => <div><span r-if>Text</span></div>`,
                        errors: [{ messageId: "ifWithoutCondition" }],
                    },
                    // r-else-if without condition
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <span r-else-if>B</span>
                            </div>
                        )`,
                        errors: [{ messageId: "elseIfWithoutCondition" }],
                    },
                    // r-else not following r-if (has element in between)
                    {
                        code: `const App = () => (
                            <div>
                                <span r-if={a}>A</span>
                                <hr />
                                <span r-else>B</span>
                            </div>
                        )`,
                        errors: [{ messageId: "orphanedElse" }],
                    },
                ],
            });
        });
    });
});
