import type { Plugin } from "vite";
import * as parser from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";

// Handle ESM/CJS interop for @babel/traverse and @babel/generator
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

export interface IfReactPluginOptions {
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), warn in dev mode and error in build mode.
     * @default false
     */
    strict?: boolean;
}

interface DirectiveError {
    message: string;
    line: number;
    column: number;
}

interface TransformResult {
    code: string;
    map: ReturnType<typeof generate>["map"];
    errors: DirectiveError[];
}

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

const HAS_DIRECTIVE_ATTR_REGEX =
    /(?:\s|<)(?:r-if|if|r-else-if|else-if)(?:\s*=)|(?:\s|<)(?:r-else|else)(?=[\s/>])/;

interface DirectiveInfo {
    type: DirectiveType;
    attrName: DirectiveAttributeName;
    condition: t.Expression | null;
}

interface ChainElement {
    node: t.JSXElement;
    directive: DirectiveInfo;
}

/**
 * Vite plugin that transforms r-if/if, r-else-if/else-if, and r-else/else directives
 * into standard React conditional rendering.
 *
 * @example
 * ```ts
 * // vite.config.ts
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import { ifReact } from "if-react/vite";
 *
 * export default defineConfig({
 *     plugins: [ifReact(), react()],
 * });
 * ```
 */
export function ifReact(options: IfReactPluginOptions = {}): Plugin {
    const { strict = false } = options;
    let isBuild = false;

    return {
        name: "if-react",
        enforce: "pre",

        configResolved(config) {
            isBuild = config.command === "build";
        },

        transform(code: string, id: string) {
            // Only process TSX/JSX files
            if (!id.match(/\.[tj]sx$/)) {
                return null;
            }

            // Quick check - skip if no directives
            if (!HAS_DIRECTIVE_ATTR_REGEX.test(code)) {
                return null;
            }

            try {
                const result = transformWithBabel(code, id);

                // Report errors/warnings
                if (result.errors.length > 0) {
                    const shouldError = strict || isBuild;

                    // Log all errors to terminal with clean formatting
                    for (const error of result.errors) {
                        const location = `${id}:${error.line}:${error.column}`;
                        if (shouldError) {
                            console.error(
                                `\x1b[31m✖ [if-react] ${error.message}\x1b[0m\n` +
                                    `  at ${location}`
                            );
                        } else {
                            console.warn(
                                `\x1b[33m⚠ [if-react] ${error.message}\x1b[0m\n` +
                                    `  at ${location}`
                            );
                        }
                    }

                    if (shouldError) {
                        const firstError = result.errors[0];
                        const errorMsg = `[if-react] ${firstError.message} (${id}:${firstError.line}:${firstError.column})`;
                        throw new Error(errorMsg);
                    }
                }

                return {
                    code: result.code,
                    map: result.map,
                };
            } catch (err) {
                // Re-throw our own errors
                if (err instanceof Error && err.message.includes("[if-react]")) {
                    throw err;
                }
                // Parse errors - log cleanly and let Vite handle them
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error(
                    `\x1b[31m[if-react] Error processing ${id}: ${errorMsg}\x1b[0m`
                );
                return null;
            }
        },
    };
}

function transformWithBabel(code: string, filename: string): TransformResult {
    const errors: DirectiveError[] = [];

    // Parse the code into an AST
    const ast = parser.parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
        sourceFilename: filename,
    });

    // Track which nodes we've already processed
    const processedNodes = new WeakSet<t.Node>();

    traverse(ast, {
        JSXElement(path) {
            // Skip if already processed
            if (processedNodes.has(path.node)) {
                return;
            }

            // Check if this element has a directive
            const directive = getDirective(path.node);
            if (!directive) {
                return;
            }

            // If it's else-if/else without being part of a chain,
            // it's orphaned
            if (directive.type !== "if") {
                const loc = path.node.loc?.start || { line: 1, column: 0 };
                errors.push({
                    message: `'${directive.attrName}' must follow an 'r-if'/'if' or 'r-else-if'/'else-if' element as an immediate sibling.`,
                    line: loc.line,
                    column: loc.column + 1,
                });
                // Remove the directive attribute
                removeDirectiveAttribute(path.node, directive.attrName);
                processedNodes.add(path.node);

                // Hide the orphaned element
                const parent = path.parent;
                if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
                    const hiddenExpr = t.jsxExpressionContainer(
                        t.logicalExpression("&&", t.booleanLiteral(false), path.node)
                    );
                    path.replaceWith(hiddenExpr);
                }
                return;
            }

            // We have an if/r-if - collect the chain
            const chain = collectDirectiveChain(path, errors, processedNodes);

            if (chain.length === 0) {
                return;
            }

            // Transform the chain into conditional expression
            const conditionalExpr = buildConditionalExpression(chain);

            // Replace the current element with the conditional expression
            const parent = path.parent;

            if (t.isJSXElement(parent) || t.isJSXFragment(parent)) {
                path.replaceWith(t.jsxExpressionContainer(conditionalExpr));
            } else if (t.isJSXExpressionContainer(parent)) {
                path.replaceWith(conditionalExpr);
            } else {
                path.replaceWith(conditionalExpr);
            }
        },
    });

    // Generate code from the transformed AST
    const output = generate(
        ast,
        {
            sourceMaps: true,
            sourceFileName: filename,
        },
        code
    );

    return {
        code: output.code,
        map: output.map,
        errors,
    };
}

function getDirective(node: t.JSXElement): DirectiveInfo | null {
    const openingElement = node.openingElement;

    for (const attr of openingElement.attributes) {
        if (!t.isJSXAttribute(attr)) continue;

        const name = t.isJSXIdentifier(attr.name) ? attr.name.name : null;

        if (!name || !(name in DIRECTIVE_NAME_TO_TYPE)) {
            continue;
        }

        const attrName = name as DirectiveAttributeName;
        const type = DIRECTIVE_NAME_TO_TYPE[attrName];

        if (type === "if" || type === "else-if") {
            const condition = extractCondition(attr);
            if (condition) {
                return { type, attrName, condition };
            }
        } else {
            return { type, attrName, condition: null };
        }
    }

    return null;
}

function extractCondition(attr: t.JSXAttribute): t.Expression | null {
    const value = attr.value;

    if (!value) {
        return null;
    }

    if (t.isJSXExpressionContainer(value)) {
        const expr = value.expression;
        if (t.isExpression(expr) && !t.isJSXEmptyExpression(expr)) {
            return expr;
        }
    } else if (t.isStringLiteral(value)) {
        return t.stringLiteral(value.value);
    }

    return null;
}

function removeDirectiveAttribute(node: t.JSXElement, directiveName: DirectiveAttributeName): void {
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
    errors: DirectiveError[],
    processedNodes: WeakSet<t.Node>
): ChainElement[] {
    const chain: ChainElement[] = [];

    // Add the starting if/r-if element
    const startDirective = getDirective(startPath.node)!;
    removeDirectiveAttribute(startPath.node, startDirective.attrName);
    chain.push({
        node: startPath.node,
        directive: startDirective,
    });
    processedNodes.add(startPath.node);

    // Look at subsequent siblings
    const currentPath: NodePath<t.JSXElement> = startPath;
    let hasElse = false;

    while (true) {
        const nextSibling = getNextJSXElementSibling(currentPath);

        if (!nextSibling) {
            break;
        }

        const directive = getDirective(nextSibling.node);

        if (!directive) {
            break;
        }

        if (directive.type === "if") {
            break;
        }

        if (hasElse) {
            const loc = nextSibling.node.loc?.start || { line: 1, column: 0 };
            errors.push({
                message: `'${directive.type}' cannot follow 'r-else'. The 'r-else' must be the last in the chain.`,
                line: loc.line,
                column: loc.column + 1,
            });
            removeDirectiveAttribute(nextSibling.node, directive.attrName);
            processedNodes.add(nextSibling.node);

            // Hide invalid element
            const hiddenExpr = t.jsxExpressionContainer(
                t.logicalExpression("&&", t.booleanLiteral(false), nextSibling.node)
            );
            nextSibling.replaceWith(hiddenExpr);
            break;
        }

        if (directive.type === "else") {
            hasElse = true;
        }

        // Add to chain
        removeDirectiveAttribute(nextSibling.node, directive.attrName);
        chain.push({
            node: nextSibling.node,
            directive,
        });
        processedNodes.add(nextSibling.node);

        // Remove this sibling from the AST
        nextSibling.remove();
    }

    return chain;
}

function getNextJSXElementSibling(
    path: NodePath<t.JSXElement>
): NodePath<t.JSXElement> | null {
    const siblings = path.getAllNextSiblings();

    for (const sibling of siblings) {
        if (t.isJSXText(sibling.node)) {
            const text = sibling.node.value;
            if (text.trim() === "") {
                continue;
            }
            return null;
        }

        if (t.isJSXExpressionContainer(sibling.node)) {
            const expr = sibling.node.expression;
            if (t.isJSXEmptyExpression(expr)) {
                continue;
            }
            return null;
        }

        if (t.isJSXElement(sibling.node)) {
            return sibling as NodePath<t.JSXElement>;
        }

        if (t.isJSXFragment(sibling.node)) {
            return null;
        }

        return null;
    }

    return null;
}

function buildConditionalExpression(chain: ChainElement[]): t.Expression {
    if (chain.length === 0) {
        return t.nullLiteral();
    }

    if (chain.length === 1) {
        const { node, directive } = chain[0];
        return t.logicalExpression("&&", directive.condition!, node);
    }

    const last = chain[chain.length - 1];
    let alternate: t.Expression;

    if (last.directive.type === "else") {
        alternate = last.node;
    } else {
        alternate = t.nullLiteral();
    }

    const startIndex =
        last.directive.type === "else" ? chain.length - 2 : chain.length - 1;

    for (let i = startIndex; i >= 0; i--) {
        const { node, directive } = chain[i];
        alternate = t.conditionalExpression(directive.condition!, node, alternate);
    }

    return alternate;
}

export default ifReact;
