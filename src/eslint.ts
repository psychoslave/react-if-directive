/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ESLint rule for validating r-if/if, r-else-if/else-if, r-else/else directive chains.
 * Provides inline editor errors for invalid directive usage.
 */

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

interface DirectiveInfo {
    type: DirectiveType;
    attrName: DirectiveAttributeName;
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
            description: "Validate r-if/if, r-else-if/else-if, r-else/else directive chains",
            category: "Possible Errors",
            recommended: true,
        },
        messages: {
            orphanedElseIf:
                "'r-else-if'/'else-if' must immediately follow an 'r-if'/'if' or 'r-else-if'/'else-if' element.",
            orphanedElse:
                "'r-else'/'else' must immediately follow an 'r-if'/'if' or 'r-else-if'/'else-if' element.",
            duplicateElse:
                "'r-else'/'else' already exists in this chain. Only one final else is allowed.",
            afterElse:
                "'{{directive}}' cannot follow 'r-else'/'else'. Else must be the last in the chain.",
            elseIfWithoutCondition: "'r-else-if'/'else-if' requires a condition.",
            ifWithoutCondition: "'r-if'/'if' requires a condition.",
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
                if (name in DIRECTIVE_NAME_TO_TYPE) {
                    const attrName = name as DirectiveAttributeName;
                    return {
                        type: DIRECTIVE_NAME_TO_TYPE[attrName],
                        attrName,
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

                if (directive.type === "if") break;

                if (hasElse) {
                    context.report({
                        node: directive.node,
                        messageId: "afterElse",
                        data: { directive: directive.attrName },
                    });
                    processedNodes.add(next);
                    current = next;
                    continue;
                }

                if (directive.type === "else") {
                    hasElse = true;
                }

                if (directive.type === "else-if" && !directive.hasValue) {
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
                if (!(name in DIRECTIVE_NAME_TO_TYPE)) return;
                const attrName = name as DirectiveAttributeName;
                const directiveType = DIRECTIVE_NAME_TO_TYPE[attrName];

                const element = node.parent?.parent;
                if (!element || element.type !== "JSXElement") return;

                if (processedNodes.has(element)) return;

                // Check r-if has a condition
                if (directiveType === "if" && node.value === null) {
                    context.report({
                        node: node,
                        messageId: "ifWithoutCondition",
                    });
                }

                // Check r-else-if has a condition
                if (directiveType === "else-if" && node.value === null) {
                    context.report({
                        node: node,
                        messageId: "elseIfWithoutCondition",
                    });
                }

                // For else-if/else, check they follow an if/else-if
                if (directiveType === "else-if" || directiveType === "else") {
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
                            messageId: directiveType === "else" ? "orphanedElse" : "orphanedElseIf",
                        });
                        processedNodes.add(element);
                        return;
                    }

                    const prevDirective = getDirective(prevSibling);

                    if (
                        !prevDirective ||
                        (prevDirective.type !== "if" && prevDirective.type !== "else-if")
                    ) {
                        context.report({
                            node: node,
                            messageId: directiveType === "else" ? "orphanedElse" : "orphanedElseIf",
                        });
                        processedNodes.add(element);
                        return;
                    }

                }

                // For if/r-if, validate the entire chain
                if (directiveType === "if") {
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
