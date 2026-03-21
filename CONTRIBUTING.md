# Contributing to Namazue Console

Thank you for your interest in contributing to Namazue Console.

## Development Setup

```bash
git clone https://github.com/Hybirdss/namazue-console.git
cd namazue-console
npm install
cp .env.example .env   # fill in your API keys
npm run dev             # starts globe app on :5173
```

To run the Worker API locally:

```bash
npm run dev:worker      # starts Hono server on :8787
```

## Architecture

- **No frameworks** — vanilla TypeScript + DOM. No React, Vue, or Angular.
- **Type contracts** — `apps/globe/src/types.ts` governs all module interfaces.
- **Plugin layers** — each data layer in `apps/globe/src/layers/` is self-contained.
- **Pure engine** — GMPE computation in `apps/globe/src/engine/` has zero rendering dependencies.

## Code Style

- [Biome](https://biomejs.dev/) for formatting and linting
- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `perf:`
- TypeScript strict mode everywhere

## Branch Naming

```
feat/description      # new features
fix/description       # bug fixes
refactor/description  # code restructuring
docs/description      # documentation changes
```

## Pull Request Process

1. Fork and create your branch from `main`
2. Ensure `npm run check` passes (typecheck + tests)
3. Ensure `npm run build` succeeds
4. Fill in the PR template
5. Request review

## CI Pipeline

Every PR runs:
- TypeScript type checking across all workspaces
- Vitest test suite
- Production build
- `npm audit --audit-level=high`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
