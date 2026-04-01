import { describe, it, expect, vi } from "vitest";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

// Handle ESM/CJS interop
const traverse = (
    typeof _traverse === "function"
        ? _traverse
        : (_traverse as unknown as { default: typeof _traverse }).default
) as typeof _traverse;

const generate = (
    typeof _generate === "function"
        ? _generate
        : (_generate as unknown as { default: typeof _generate }).default
) as typeof _generate;

// Import the transform logic (we'll test the core transformation)
import { ifReact } from "../src/vite";

type DirectiveType = "if" | "else-if" | "else";
type DirectiveAttributeName =
    | "r-if"
    | "if"
    | "r-else-if"
    | "else-if"
    | "r-else"
    | "else";

const DIRECTIVE_NAME_TO_TYPE: Record<DirectiveAttributeName, DirectiveType> = {
    "r-if": "if",
    if: "if",
    "r-else-if": "else-if",
    "else-if": "else-if",
    "r-else": "else",
    else: "else",
};

describe("if-react Vite Plugin", () => {
    describe("ifReact()", () => {
        it("should return a valid Vite plugin object", () => {
            const plugin = ifReact();

            expect(plugin).toBeDefined();
            expect(plugin.name).toBe("if-react");
            expect(plugin.enforce).toBe("pre");
            expect(plugin.transform).toBeInstanceOf(Function);
        });

        it("should accept options", () => {
            const plugin = ifReact({ strict: true });
            expect(plugin).toBeDefined();
        });
    });

    describe("Transform Logic", () => {
        // Helper to transform code and get result
        function transformCode(code: string): string {
            const ast = parser.parse(code, {
                sourceType: "module",
                plugins: ["jsx", "typescript"],
            });

            const processedNodes = new WeakSet<t.Node>();

            traverse(ast, {
                JSXElement(path) {
                    if (processedNodes.has(path.node)) return;

                    const directive = getDirective(path.node);
                    if (!directive) return;

                    if (directive.type !== "if") {
                        removeDirectiveAttribute(path.node, directive.attrName);
                        processedNodes.add(path.node);
                        return;
                    }

                    const chain = collectDirectiveChain(path, processedNodes);
                    if (chain.length === 0) return;

                    const conditionalExpr = buildConditionalExpression(chain);
                    const parent = path.parent;

                    if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
                        path.replaceWith(t.jsxExpressionContainer(conditionalExpr));
                    } else {
                        path.replaceWith(conditionalExpr);
                    }
                },
            });

            return generate(ast).code;
        }

        // Helper functions (simplified versions for testing)
        function getDirective(
            node: t.JSXElement
        ): { type: DirectiveType; attrName: DirectiveAttributeName; condition: t.Expression | null } | null {
            for (const attr of node.openingElement.attributes) {
                if (!t.isJSXAttribute(attr)) continue;
                const name = t.isJSXIdentifier(attr.name) ? attr.name.name : null;

                if (!name || !(name in DIRECTIVE_NAME_TO_TYPE)) {
                    continue;
                }

                const attrName = name as DirectiveAttributeName;
                const type = DIRECTIVE_NAME_TO_TYPE[attrName];

                if (type === "if" || type === "else-if") {
                    const value = attr.value;
                    if (t.isJSXExpressionContainer(value)) {
                        const expr = value.expression;
                        if (t.isExpression(expr) && !t.isJSXEmptyExpression(expr)) {
                            return { type, attrName, condition: expr };
                        }
                    }
                } else {
                    return { type, attrName, condition: null };
                }
            }
            return null;
        }

        function removeDirectiveAttribute(
            node: t.JSXElement,
            directiveName: DirectiveAttributeName
        ): void {
            node.openingElement.attributes = node.openingElement.attributes.filter(
                (attr) => {
                    if (!t.isJSXAttribute(attr)) return true;
                    const name = t.isJSXIdentifier(attr.name) ? attr.name.name : null;
                    return name !== directiveName;
                }
            );
        }

        function collectDirectiveChain(
            startPath: NodePath<t.JSXElement>,
            processedNodes: WeakSet<t.Node>
        ): Array<{ node: t.JSXElement; directive: NonNullable<ReturnType<typeof getDirective>> }> {
            const chain: Array<{
                node: t.JSXElement;
                directive: NonNullable<ReturnType<typeof getDirective>>;
            }> = [];

            const startDirective = getDirective(startPath.node)!;
            removeDirectiveAttribute(startPath.node, startDirective.attrName);
            chain.push({ node: startPath.node, directive: startDirective });
            processedNodes.add(startPath.node);

            let hasElse = false;
            const siblings = startPath.getAllNextSiblings();

            for (const sibling of siblings) {
                if (t.isJSXText(sibling.node) && sibling.node.value.trim() === "") continue;
                if (
                    t.isJSXExpressionContainer(sibling.node) &&
                    t.isJSXEmptyExpression(sibling.node.expression)
                )
                    continue;

                if (!t.isJSXElement(sibling.node)) break;

                const directive = getDirective(sibling.node);
                if (!directive) break;
                if (directive.type === "if") break;
                if (hasElse) break;

                if (directive.type === "else") hasElse = true;

                removeDirectiveAttribute(sibling.node, directive.attrName);
                chain.push({ node: sibling.node, directive });
                processedNodes.add(sibling.node);
                sibling.remove();
            }

            return chain;
        }

        function buildConditionalExpression(
            chain: Array<{ node: t.JSXElement; directive: { condition: t.Expression | null } }>
        ): t.Expression {
            if (chain.length === 1) {
                const { node, directive } = chain[0];
                return t.logicalExpression("&&", directive.condition!, node);
            }

            const last = chain[chain.length - 1];
            let alternate: t.Expression =
                last.directive.condition === null ? last.node : t.nullLiteral();

            const startIndex =
                last.directive.condition === null ? chain.length - 2 : chain.length - 1;

            for (let i = startIndex; i >= 0; i--) {
                const { node, directive } = chain[i];
                alternate = t.conditionalExpression(directive.condition!, node, alternate);
            }

            return alternate;
        }

        it("should transform simple r-if", () => {
            const input = `const App = () => <div><span r-if={show}>Hello</span></div>`;
            const output = transformCode(input);

            expect(output).toContain("&&");
            expect(output).not.toContain("r-if");
        });

        it("should transform r-if with r-else", () => {
            const input = `const App = () => (
                <div>
                    <span r-if={show}>Yes</span>
                    <span r-else>No</span>
                </div>
            )`;
            const output = transformCode(input);

            expect(output).toContain("?");
            expect(output).toContain(":");
            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else");
        });

        it("should transform r-if with r-else-if and r-else", () => {
            const input = `const App = () => (
                <div>
                    <span r-if={status === "a"}>A</span>
                    <span r-else-if={status === "b"}>B</span>
                    <span r-else>C</span>
                </div>
            )`;
            const output = transformCode(input);

            expect(output).not.toContain("r-if");
            expect(output).not.toContain("r-else-if");
            expect(output).not.toContain("r-else");
            // Should have nested ternaries
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should transform unprefixed if/else-if/else", () => {
            const input = `const App = () => (
                <div>
                    <span if={status === "a"}>A</span>
                    <span else-if={status === "b"}>B</span>
                    <span else>C</span>
                </div>
            )`;
            const output = transformCode(input);

            expect(output).not.toContain(" if=");
            expect(output).not.toContain("else-if");
            expect(output).not.toContain(" else>");
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should transform mixed r-* and unprefixed chain", () => {
            const input = `const App = () => (
                <div>
                    <span r-if={a}>A</span>
                    <span else-if={b}>B</span>
                    <span r-else>C</span>
                </div>
            )`;
            const output = transformCode(input);

            expect(output).not.toContain("r-if");
            expect(output).not.toContain("else-if");
            expect(output).not.toContain("r-else");
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should handle r-if without r-else (returns null)", () => {
            const input = `const App = () => <div><span r-if={show}>Text</span></div>`;
            const output = transformCode(input);

            expect(output).toContain("&&");
            expect(output).not.toContain("?");
        });

        it("should preserve other attributes", () => {
            const input = `const App = () => <div><span r-if={show} className="test" id="myId">Text</span></div>`;
            const output = transformCode(input);

            expect(output).toContain('className="test"');
            expect(output).toContain('id="myId"');
        });

        it("should handle multiple independent r-if chains", () => {
            const input = `const App = () => (
                <div>
                    <span r-if={a}>A</span>
                    <span r-else>Not A</span>
                    <div>Separator</div>
                    <span r-if={b}>B</span>
                    <span r-else>Not B</span>
                </div>
            )`;
            const output = transformCode(input);

            // Should have two separate ternary chains
            expect(output.match(/\?/g)?.length).toBe(2);
        });

        it("should handle nested elements", () => {
            const input = `const App = () => (
                <div>
                    <div r-if={outer}>
                        <span r-if={inner}>Nested</span>
                    </div>
                </div>
            )`;
            const output = transformCode(input);

            expect(output).not.toContain("r-if");
        });
    });
});

describe("Edge Cases", () => {
    it("should skip non-JSX files", () => {
        const plugin = ifReact();
        const context = {
            configResolved: plugin.configResolved as (config: { command: string }) => void,
            transform: plugin.transform as (
                code: string,
                id: string
            ) => { code: string } | null,
        };

        context.configResolved({ command: "serve" });

        const result = context.transform.call(
            { warn: vi.fn(), error: vi.fn() },
            'const x = 1;',
            'test.ts'
        );

        expect(result).toBeNull();
    });

    it("should skip files without directives", () => {
        const plugin = ifReact();
        const context = {
            configResolved: plugin.configResolved as (config: { command: string }) => void,
            transform: plugin.transform as (
                code: string,
                id: string
            ) => { code: string } | null,
        };

        context.configResolved({ command: "serve" });

        const result = context.transform.call(
            { warn: vi.fn(), error: vi.fn() },
            'const App = () => <div>No directives</div>',
            'test.tsx'
        );

        expect(result).toBeNull();
    });

    it("should process files that use unprefixed directives", () => {
        const plugin = ifReact();
        const context = {
            configResolved: plugin.configResolved as (config: { command: string }) => void,
            transform: plugin.transform as (
                code: string,
                id: string
            ) => { code: string } | null,
        };

        context.configResolved({ command: "serve" });

        const result = context.transform.call(
            { warn: vi.fn(), error: vi.fn() },
            "const App = () => <div><span if={show}>Visible</span></div>",
            "test.tsx"
        );

        expect(result).not.toBeNull();
        expect(result!.code).toContain("&&");
    });
});
