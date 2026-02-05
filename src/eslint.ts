/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ESLint rule for validating r-if, r-else-if, r-else directive chains.
 * Provides inline editor errors for invalid directive usage.
 */

interface DirectiveInfo {
    type: "r-if" | "r-else-if" | "r-else";
    hasValue: boolean;
    node: any;
}

interface RuleContext {
    report: (options: {
        node: any;
        messageId: string;
        data?: Record<string, string>;
    }) => void;
}

const validDirectivesRule = {
    meta: {
        type: "problem",
        docs: {
            description: "Validate r-if, r-else-if, r-else directive chains",
            category: "Possible Errors",
            recommended: true,
        },
        messages: {
            orphanedElseIf:
                "'r-else-if' must immediately follow an 'r-if' or 'r-else-if' element.",
            orphanedElse:
                "'r-else' must immediately follow an 'r-if' or 'r-else-if' element.",
            duplicateElse:
                "'r-else' already exists in this chain. Only one 'r-else' is allowed at the end.",
            afterElse:
                "'{{directive}}' cannot follow 'r-else'. The 'r-else' must be the last in the chain.",
            elseIfWithoutCondition: "'r-else-if' requires a condition.",
            ifWithoutCondition: "'r-if' requires a condition.",
        },
        schema: [],
    },

    create(context: RuleContext) {
        const processedNodes = new WeakSet<any>();

        function getDirective(node: any): DirectiveInfo | null {
            if (node.type !== "JSXElement") return null;

            const openingElement = node.openingElement;

            for (const attr of openingElement.attributes) {
                if (attr.type !== "JSXAttribute") continue;
                if (attr.name?.type !== "JSXIdentifier") continue;

                const name = attr.name.name;
                if (name === "r-if" || name === "r-else-if" || name === "r-else") {
                    return {
                        type: name as DirectiveInfo["type"],
                        hasValue: attr.value !== null,
                        node: attr,
                    };
                }
            }
            return null;
        }

        function isWhitespaceOrComment(node: any): boolean {
            if (node.type === "JSXText") {
                return node.value.trim() === "";
            }
            if (node.type === "JSXExpressionContainer") {
                return node.expression?.type === "JSXEmptyExpression";
            }
            return false;
        }

        function getPreviousJSXElementSibling(
            node: any,
            siblings: any[]
        ): any | null {
            const index = siblings.indexOf(node);
            if (index <= 0) return null;

            for (let i = index - 1; i >= 0; i--) {
                const sibling = siblings[i];
                if (isWhitespaceOrComment(sibling)) {
                    continue;
                }
                if (sibling.type === "JSXElement") {
                    return sibling;
                }
                return null;
            }
            return null;
        }

        function getNextJSXElementSibling(
            node: any,
            siblings: any[]
        ): any | null {
            const index = siblings.indexOf(node);
            if (index < 0 || index >= siblings.length - 1) return null;

            for (let i = index + 1; i < siblings.length; i++) {
                const sibling = siblings[i];
                if (isWhitespaceOrComment(sibling)) {
                    continue;
                }
                if (sibling.type === "JSXElement") {
                    return sibling;
                }
                return null;
            }
            return null;
        }

        function validateChain(startNode: any, siblings: any[]): void {
            let current: any | null = startNode;
            let hasElse = false;

            while (current) {
                const next = getNextJSXElementSibling(current, siblings);
                if (!next) break;

                const directive = getDirective(next);
                if (!directive) break;

                if (directive.type === "r-if") break;

                if (hasElse) {
                    context.report({
                        node: directive.node,
                        messageId: "afterElse",
                        data: { directive: directive.type },
                    });
                    processedNodes.add(next);
                    current = next;
                    continue;
                }

                if (directive.type === "r-else") {
                    hasElse = true;
                }

                if (directive.type === "r-else-if" && !directive.hasValue) {
                    context.report({
                        node: directive.node,
                        messageId: "elseIfWithoutCondition",
                    });
                }

                processedNodes.add(next);
                current = next;
            }
        }

        return {
            JSXAttribute(node: any) {
                if (node.name?.type !== "JSXIdentifier") return;
                const name = node.name.name;
                if (!["r-if", "r-else-if", "r-else"].includes(name)) return;

                const element = node.parent?.parent;
                if (!element || element.type !== "JSXElement") return;

                if (processedNodes.has(element)) return;

                // Check r-if has a condition
                if (name === "r-if" && node.value === null) {
                    context.report({
                        node: node,
                        messageId: "ifWithoutCondition",
                    });
                }

                // Check r-else-if has a condition
                if (name === "r-else-if" && node.value === null) {
                    context.report({
                        node: node,
                        messageId: "elseIfWithoutCondition",
                    });
                }

                // For r-else-if and r-else, check they follow an r-if or r-else-if
                if (name === "r-else-if" || name === "r-else") {
                    const parent = element.parent;
                    if (!parent) return;

                    let siblings: any[] | null = null;
                    if (parent.type === "JSXElement" || parent.type === "JSXFragment") {
                        siblings = parent.children;
                    }

                    if (!siblings) return;

                    const prevSibling = getPreviousJSXElementSibling(element, siblings);

                    if (!prevSibling) {
                        context.report({
                            node: node,
                            messageId: name === "r-else" ? "orphanedElse" : "orphanedElseIf",
                        });
                        processedNodes.add(element);
                        return;
                    }

                    const prevDirective = getDirective(prevSibling);

                    if (
                        !prevDirective ||
                        (prevDirective.type !== "r-if" && prevDirective.type !== "r-else-if")
                    ) {
                        context.report({
                            node: node,
                            messageId: name === "r-else" ? "orphanedElse" : "orphanedElseIf",
                        });
                        processedNodes.add(element);
                        return;
                    }

                    if ((prevDirective.type as string) === "r-else") {
                        context.report({
                            node: node,
                            messageId: "afterElse",
                            data: { directive: name },
                        });
                        processedNodes.add(element);
                        return;
                    }
                }

                // For r-if, validate the entire chain
                if (name === "r-if") {
                    const parent = element.parent;
                    let siblings: any[] | null = null;

                    if (parent?.type === "JSXElement" || parent?.type === "JSXFragment") {
                        siblings = parent.children;
                    }

                    if (siblings) {
                        processedNodes.add(element);
                        validateChain(element, siblings);
                    }
                }
            },
        };
    },
};

/**
 * ESLint plugin for if-react directives.
 *
 * @example
 * ```js
 * // eslint.config.js
 * import ifReactPlugin from "if-react/eslint";
 *
 * export default [
 *     {
 *         plugins: { "if-react": ifReactPlugin },
 *         rules: { "if-react/valid-directives": "error" },
 *     },
 * ];
 * ```
 */
const plugin = {
    rules: {
        "valid-directives": validDirectivesRule,
    },
    configs: {
        recommended: {
            plugins: ["if-react"],
            rules: {
                "if-react/valid-directives": "error",
            },
        },
    },
};

export { validDirectivesRule };
export default plugin;
