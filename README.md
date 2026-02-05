# if-react

React conditional rendering directives for cleaner JSX. Use `r-if`, `r-else-if`, and `r-else` attributes directly on elements instead of writing complex ternary expressions.

## Features

- **Clean Syntax** - Write `<div r-if={condition}>` instead of `{condition && <div>}`
- **Full Chain Support** - `r-if` / `r-else-if` / `r-else` chains like traditional if-else
- **Vite Plugin** - Zero-runtime, compiles to standard React at build time
- **ESLint Plugin** - Inline editor errors for invalid directive usage
- **TypeScript Support** - Full autocomplete and type checking
- **Deeply Nestable** - Works at any level of component nesting

## Installation

```bash
npm install if-react
```

## Quick Start

### 1. Configure Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ifReact } from "if-react/vite";

export default defineConfig({
    plugins: [
        ifReact(),  // Add before react plugin
        react(),
    ],
});
```

### 2. Add TypeScript Support

```ts
// src/vite-env.d.ts (or any .d.ts file)
/// <reference types="vite/client" />
/// <reference types="if-react/types" />
```

Or in `tsconfig.json`:

```json
{
    "compilerOptions": {
        "types": ["if-react/types"]
    }
}
```

### 3. Use in Components

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
import ifReactPlugin from "if-react/eslint";

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
import { ifReact } from "if-react/vite";

ifReact({
    /**
     * If true, always throw errors on invalid directives.
     * If false (default), warn in dev mode and error in build mode.
     * @default false
     */
    strict: false,
});
```

### Directives

| Directive | Description | Condition Required |
|-----------|-------------|-------------------|
| `r-if` | Render element if condition is truthy | Yes |
| `r-else-if` | Render if previous conditions were false and this is truthy | Yes |
| `r-else` | Render if all previous conditions were false | No |

### Rules

1. **Chain Start**: Every chain must start with `r-if`
2. **Immediate Siblings**: `r-else-if` and `r-else` must immediately follow `r-if` or `r-else-if`
3. **Single Else**: Only one `r-else` per chain, must be last
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
| Vite optimized | ✅ | N/A | ❌ |

## Requirements

- **Vite** >= 4.0.0
- **React** >= 17.0.0
- **TypeScript** >= 4.7.0 (optional but recommended)
- **ESLint** >= 8.0.0 (for ESLint plugin)

## License

MIT
