# react-if-directive

React conditional rendering directives for cleaner JSX. Use `r-if`/`if`, `r-else-if`/`else-if`, and `r-else`/`else` attributes directly on elements instead of writing complex ternary expressions. Works with **Vite**, **Next.js**, **Webpack**, **Babel**, and any React project.

## Features

- **Clean Syntax** - Write `<div r-if={condition}>` instead of `{condition && <div>}`
- **Full Chain Support** - `r-if` / `r-else-if` / `r-else` (or `if` / `else-if` / `else`) chains like traditional if-else
- **Multi-Framework Support** - Works with Vite, Next.js, Webpack, Babel, and any React bundler
- **Zero Runtime** - Compiles to standard React at build time, zero overhead
- **ESLint Plugin** - Inline editor errors for invalid directive usage
- **TypeScript Support** - Full autocomplete and type checking
- **Deeply Nestable** - Works at any level of component nesting

## Installation

```bash
npm install react-if-directive
```

## Quick Start

Choose your framework:

### Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ifReact } from "react-if-directive/vite";

export default defineConfig({
    plugins: [
        ifReact(),  // Add before react plugin
        react(),
    ],
});
```

### Next.js

```ts
// next.config.js or next.config.mjs
import { withIfReact } from "react-if-directive/nextjs";

const nextConfig = {
    // your Next.js config here
};

export default withIfReact(nextConfig);
```

### Babel (Webpack, CRA, and others)

```js
// .babelrc or babel.config.js
{
  "plugins": ["react-if-directive/babel"]
}
```

Or in `babel.config.js`:

```js
module.exports = {
  plugins: [
    ["react-if-directive/babel", { strict: false }]
  ]
};
```

### TypeScript Support

Add to your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "types": ["react-if-directive/types"]
    }
}
```

Or add a reference in a `.d.ts` file:

```ts
/// <reference types="react-if-directive/types" />
```

### Use in Components

```tsx
function UserStatus({ user, isLoading }) {
    return (
        <div>
            <p r-if={isLoading}>Loading...</p>
            <p r-else-if={!user}>Please log in</p>
            <p r-else>Welcome, {user.name}!</p>
        </div>
    );
}
```

You can also use the unprefixed aliases:

```tsx
<p if={isLoading}>Loading...</p>
<p else-if={!user}>Please log in</p>
<p else>Welcome!</p>
```

## Usage Examples

### Simple Conditional

```tsx
// Before (standard React)
{isVisible && <div>Content</div>}

// After (with if-react)
<div r-if={isVisible}>Content</div>
```

### If-Else

```tsx
// Before
{isLoggedIn ? <Dashboard /> : <LoginForm />}

// After
<Dashboard r-if={isLoggedIn} />
<LoginForm r-else />
```

### Multiple Conditions

```tsx
// Before
{status === "loading" ? (
    <Spinner />
) : status === "error" ? (
    <ErrorMessage />
) : status === "empty" ? (
    <EmptyState />
) : (
    <DataList data={data} />
)}

// After
<Spinner r-if={status === "loading"} />
<ErrorMessage r-else-if={status === "error"} />
<EmptyState r-else-if={status === "empty"} />
<DataList r-else data={data} />
```

### Nested Conditionals

```tsx
<div r-if={isAuthenticated}>
    <AdminPanel r-if={user.role === "admin"} />
    <ModeratorPanel r-else-if={user.role === "moderator"} />
    <UserDashboard r-else />
</div>
<LoginPrompt r-else />
```

### Inside Loops

```tsx
{items.map((item) => (
    <li key={item.id}>
        <span r-if={item.completed} className="done">✓ {item.title}</span>
        <span r-else className="pending">○ {item.title}</span>
    </li>
))}
```

### On Custom Components

```tsx
<LoadingSpinner r-if={isLoading} size="large" />
<ErrorBanner r-else-if={error} message={error.message} />
<UserProfile r-else user={user} />
```

## ESLint Plugin

Get inline editor errors for invalid directive usage.

### Configuration

```js
// eslint.config.js (ESLint 9+ flat config)
import ifReactPlugin from "react-if-directive/eslint";

export default [
    {
        files: ["**/*.{tsx,jsx}"],
        plugins: {
            "if-react": ifReactPlugin,
        },
        rules: {
            "if-react/valid-directives": "error",
        },
    },
];
```

### What It Catches

- `r-else` or `r-else-if` without preceding `r-if`
- Multiple `r-else` in the same chain
- `r-else-if` or `r-else` after `r-else`
- `r-if` or `r-else-if` without a condition
- Elements breaking the chain (non-adjacent siblings)

## API Reference

### Vite Plugin Options

```ts
import { ifReact } from "react-if-directive/vite";

ifReact({
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), warn in dev mode and error in build mode.
     * @default false
     */
    strict: false,
});
```

### Next.js Plugin Options

```ts
import { withIfReact } from "react-if-directive/nextjs";

withIfReact(nextConfig, {
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), only log warnings.
     * @default false
     */
    strict: false,
});
```

### Babel Plugin Options

```js
// .babelrc or babel.config.js
{
  "plugins": [
    ["react-if-directive/babel", {
      "strict": false  // optional
    }]
  ]
}
```

### Directives

| Directive | Description | Condition Required |
|-----------|-------------|-------------------|
| `r-if` or `if` | Render element if condition is truthy | Yes |
| `r-else-if` or `else-if` | Render if previous conditions were false and this is truthy | Yes |
| `r-else` or `else` | Render if all previous conditions were false | No |

### Rules

1. **Chain Start**: Every chain must start with `r-if` or `if`
2. **Immediate Siblings**: `r-else-if`/`else-if` and `r-else`/`else` must immediately follow `r-if`/`if` or `r-else-if`/`else-if`
3. **Single Else**: Only one `r-else`/`else` per chain, must be last
4. **No Gaps**: Elements between directives break the chain

## How It Works

The Vite plugin transforms directives at build time using Babel AST:

```tsx
// Input
<div r-if={a}>A</div>
<div r-else-if={b}>B</div>
<div r-else>C</div>

// Output (compiled)
{a ? <div>A</div> : b ? <div>B</div> : <div>C</div>}
```

**Zero runtime overhead** - directives are removed during compilation.

## Comparison

| Feature | if-react | Standard JSX | Other Libraries |
|---------|----------|--------------|-----------------|
| Clean syntax | ✅ | ❌ Ternaries | ✅ |
| Zero runtime | ✅ | ✅ | ❌ Components |
| Type safety | ✅ | ✅ | Varies |
| ESLint support | ✅ | N/A | ❌ |
| Nested chains | ✅ | ✅ | Varies |
| Vite support | ✅ | N/A | ❌ |
| Next.js support | ✅ | N/A | ❌ |
| Webpack/CRA support | ✅ | N/A | ❌ |
| Pure Babel support | ✅ | N/A | ❌ |

## Framework Support

| Framework | Status | Plugin | Notes |
|-----------|--------|--------|-------|
| Vite | ✅ Supported | `ifReact()` from `react-if-directive/vite` | Direct plugin |
| Next.js | ✅ Supported | `withIfReact()` from `react-if-directive/nextjs` | HOC wrapper |
| Create React App | ✅ Supported | Use Babel plugin directly | Configure in `.babelrc` |
| Webpack | ✅ Supported | Babel plugin + babel-loader | Use with `babel-loader` |
| Remix | ✅ Supported | Babel plugin | Configure in `remix.config.js` |
| Astro | ✅ Supported | Babel plugin | Via integration |
| Any React Project | ✅ Supported | Babel plugin | Works wherever Babel is used |

## Requirements

- **React** >= 17.0.0
- **Node.js** >= 14.0.0
- **TypeScript** >= 4.7.0 (optional but recommended)
- **ESLint** >= 8.0.0 (for ESLint plugin only)

Per bundler:
- **Vite**: >= 4.0.0
- **Next.js**: >= 12.0.0
- **Webpack**: >= 4.0.0
- **Babel**: >= 7.0.0

## License

MIT
