# AGENTS.md

## Commands

### Backend (`backend/`)
- **Typecheck**: `npx tsc --noEmit`
- **Lint check**: `npm run lint:check`
- **Lint fix**: `npm run lint`
- **Test**: `npm test`
- **Typecheck**: `npm run typecheck`

### Frontend (`frontend/`)
- **Typecheck**: `npx tsc --noEmit`
- **Lint check**: `npm run lint:check`
- **Lint fix**: `npm run lint`
- **Test**: `npm test`
- **Typecheck**: `npm run typecheck`

### Both
- **Tests**: `npm test` in each subdirectory
- **Lint**: `npm run lint:check` in each subdirectory
- **Typecheck**: `npm run typecheck` in each subdirectory

## Notes
- Frontend tests use Jest with jsdom environment; the `jest.config.cjs` file must be renamed as `.cjs` (not `.mjs`) for CommonJS compatibility with Jest.
- ESLint 9 flat config requires `typescript-eslint` (unified v8+ package), not the legacy `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin` combo.
- Frontend ESLint config must use `plugins: { react }` format (flat config), not the legacy `react.configs.recommended` spread.
