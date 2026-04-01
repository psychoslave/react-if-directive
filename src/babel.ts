/**
 * Babel plugin that transforms r-if, r-else-if, and r-else directives
 * into standard React conditional rendering.
 *
 * This is the core transformation logic that can be used with any bundler
 * (Vite, Next.js/Webpack, Babel directly, etc.)
 *
 * @example
 * ```ts
 * // .babelrc or babel.config.js
 * {
 *   "plugins": [["react-if-directive/babel", { strict: false }]]
 * }
 * ```
 *
 * @example
 * ```ts
 * // babel.config.js (with options)
 * module.exports = {
 *   plugins: [
 *     ["react-if-directive/babel", {
 *       strict: false  // optional: treat errors strictly (default: false)
 *     }]
 *   ]
 * };
 * ```
 */

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

export interface IfReactBabelOptions {
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), only log warnings.
     * @default false
     */
    strict?: boolean;
}

interface DirectiveError {
    message: string;
    line: number;
    column: number;
}

interface DirectiveInfo {
    type: "r-if" | "r-else-if" | "r-else";
    condition: t.Expression | null;
}

interface ChainElement {
    node: t.JSXElement;
    directive: DirectiveInfo;
}

/**
 * Babel plugin function for if-react transformation
 *
 * @param api - Babel API object with types and traverse utilities
 * @param options - Plugin options
 * @returns Plugin object
 */
function ifReactBabelPlugin(
    api: any,
    options: IfReactBabelOptions = {}
): any {
    const { strict = false } = options;

    return {
        name: "if-react",
        visitor: {
            Program(path: NodePath<t.Program>) {
                const errors: DirectiveError[] = [];

                // Process the entire AST
                processAST(path.node, errors, api.types);

                // Report errors/warnings
                if (errors.length > 0) {
                    const filename =
                        (path.hub as any).file?.opts?.filename || "unknown";
                    for (const error of errors) {
                        const location = `${filename}:${error.line}:${error.column}`;
                        const message = `[if-react] ${error.message}`;

                        if (strict) {
                            throw path.buildCodeFrameError(message);
                        } else {
                            console.warn(`⚠  ${message}\n  at ${location}`);
                        }
                    }
                }
            },
        },
    };
}

function processAST(ast: t.Program, errors: DirectiveError[], types: typeof t): void {
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

            // If it's r-else-if or r-else without being part of a chain,
            // it's orphaned
            if (directive.type !== "r-if") {
                const loc = path.node.loc?.start || { line: 1, column: 0 };
                errors.push({
                    message: `'${directive.type}' must follow an 'r-if' or 'r-else-if' element as an immediate sibling.`,
                    line: loc.line,
                    column: loc.column + 1,
                });
                // Remove the directive attribute
                removeDirectiveAttribute(path.node, directive.type);
                processedNodes.add(path.node);

                // Hide the orphaned element
                const parent = path.parent;
                if (types.isJSXElement(parent) || types.isJSXFragment(parent)) {
                    const hiddenExpr = types.jsxExpressionContainer(
                        types.logicalExpression("&&", types.booleanLiteral(false), path.node)
                    );
                    path.replaceWith(hiddenExpr);
                }
                return;
            }

            // We have an r-if - collect the chain
            const chain = collectDirectiveChain(path as NodePath<t.JSXElement>, errors, processedNodes);

            if (chain.length === 0) {
                return;
            }

            // Transform the chain into conditional expression
            const conditionalExpr = buildConditionalExpression(chain);

            // Replace the current element with the conditional expression
            const parent = path.parent;

            if (types.isJSXElement(parent) || types.isJSXFragment(parent)) {
                path.replaceWith(types.jsxExpressionContainer(conditionalExpr));
            } else if (types.isJSXExpressionContainer(parent)) {
                path.replaceWith(conditionalExpr);
            } else {
                path.replaceWith(conditionalExpr);
            }
        },
    });
}

function getDirective(node: t.JSXElement): DirectiveInfo | null {
    const openingElement = node.openingElement;

    for (const attr of openingElement.attributes) {
        if (!t.isJSXAttribute(attr)) continue;

        const name = t.isJSXIdentifier(attr.name) ? attr.name.name : null;

        if (name === "r-if" || name === "r-else-if") {
            const condition = extractCondition(attr);
            if (condition) {
                return { type: name, condition };
            }
        } else if (name === "r-else") {
            return { type: "r-else", condition: null };
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

function removeDirectiveAttribute(node: t.JSXElement, directiveType: string): void {
    node.openingElement.attributes = node.openingElement.attributes.filter((attr) => {
        if (!t.isJSXAttribute(attr)) return true;
        const name = t.isJSXIdentifier(attr.name) ? attr.name.name : null;
        return name !== directiveType;
    });
}

function collectDirectiveChain(
    startPath: NodePath<t.JSXElement>,
    errors: DirectiveError[],
    processedNodes: WeakSet<t.Node>
): ChainElement[] {
    const chain: ChainElement[] = [];

    // Add the starting r-if element
    const startDirective = getDirective(startPath.node)!;
    removeDirectiveAttribute(startPath.node, startDirective.type);
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

        if (directive.type === "r-if") {
            break;
        }

        if (hasElse) {
            const loc = nextSibling.node.loc?.start || { line: 1, column: 0 };
            errors.push({
                message: `'${directive.type}' cannot follow 'r-else'. The 'r-else' must be the last in the chain.`,
                line: loc.line,
                column: loc.column + 1,
            });
            removeDirectiveAttribute(nextSibling.node, directive.type);
            processedNodes.add(nextSibling.node);

            // Hide invalid element
            const hiddenExpr = t.jsxExpressionContainer(
                t.logicalExpression("&&", t.booleanLiteral(false), nextSibling.node)
            );
            nextSibling.replaceWith(hiddenExpr);
            break;
        }

        if (directive.type === "r-else") {
            hasElse = true;
        }

        // Add to chain
        removeDirectiveAttribute(nextSibling.node, directive.type);
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

function getNextJSXElementSibling(path: NodePath<t.JSXElement>): NodePath<t.JSXElement> | null {
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

    if (last.directive.type === "r-else") {
        alternate = last.node;
    } else {
        alternate = t.nullLiteral();
    }

    const startIndex = last.directive.type === "r-else" ? chain.length - 2 : chain.length - 1;

    for (let i = startIndex; i >= 0; i--) {
        const { node, directive } = chain[i];
        alternate = t.conditionalExpression(directive.condition!, node, alternate);
    }

    return alternate;
}

export { ifReactBabelPlugin };
export default ifReactBabelPlugin;
