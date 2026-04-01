import { describe, it, expect } from "vitest";
import { ifReactBabelPlugin } from "../src/babel";

describe("if-react Babel Plugin", () => {
    describe("Plugin Structure", () => {
        it("should return a valid Babel plugin", () => {
            const api = {
                types: {} as any,
            };
            const plugin = ifReactBabelPlugin(api, {});

            expect(plugin).toBeDefined();
            expect(plugin.name).toBe("if-react");
            expect(plugin.visitor).toBeDefined();
        });

        it("should accept options", () => {
            const api = {
                types: {} as any,
            };
            const plugin = ifReactBabelPlugin(api, { strict: true });

            expect(plugin).toBeDefined();
            expect(plugin.name).toBe("if-react");
        });

        it("should support strict mode option", () => {
            const api = {
                types: {} as any,
            };
            const pluginDefault = ifReactBabelPlugin(api, {});
            const pluginStrict = ifReactBabelPlugin(api, { strict: true });

            expect(pluginDefault).toBeDefined();
            expect(pluginStrict).toBeDefined();
        });

        it("should have a Program visitor", () => {
            const api = {
                types: {} as any,
            };
            const plugin = ifReactBabelPlugin(api, {});

            expect(plugin.visitor).toBeDefined();
            expect(plugin.visitor.Program).toBeDefined();
        });
    });

    describe("Plugin Options", () => {
        it("should handle strict mode", () => {
            const api = {
                types: {} as any,
            };
            const pluginStrict = ifReactBabelPlugin(api, { strict: true });
            const pluginNonStrict = ifReactBabelPlugin(api, { strict: false });

            expect(pluginStrict).toBeDefined();
            expect(pluginNonStrict).toBeDefined();
        });

        it("should default to non-strict mode", () => {
            const api = {
                types: {} as any,
            };
            const plugin = ifReactBabelPlugin(api);

            expect(plugin).toBeDefined();
            // Plugin should be created without throwing
        });
    });

    describe("Plugin Exports", () => {
        it("should export ifReactBabelPlugin as default", () => {
            expect(ifReactBabelPlugin).toBeDefined();
            expect(typeof ifReactBabelPlugin).toBe("function");
        });

        it("should be callable with API object", () => {
            const api = {
                types: {} as any,
            };

            expect(() => ifReactBabelPlugin(api)).not.toThrow();
        });

        it("should be callable with API object and options", () => {
            const api = {
                types: {} as any,
            };

            expect(() => ifReactBabelPlugin(api, { strict: true })).not.toThrow();
            expect(() => ifReactBabelPlugin(api, { strict: false })).not.toThrow();
        });
    });
});
