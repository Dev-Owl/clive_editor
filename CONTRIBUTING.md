# Contributing

Thanks for contributing to CliveEdit.

This package is intended to be stable, reusable, and easy to integrate into larger Vue applications. Contributions should prioritize maintainability, predictable behavior, and clear package documentation.

## Principles

- Prefer backward-compatible changes whenever possible.
- Treat the published package API as important contract surface.
- Keep internal refactors focused and readable.
- Update docs when public behavior changes.
- Add or update tests for behavior changes.

## Local Setup

```bash
npm install
```

Useful commands:

```bash
npm run dev
npm run typecheck
npm run test
npm run test:watch
npm run build
```

## Development Expectations

When making changes:

- keep the public API stable unless the change is clearly justified
- prefer improving internal structure over introducing new public surface
- avoid consumer-facing breaking changes unless they provide real value
- keep README examples aligned with the real package API
- update `CHANGELOG.md` for shipped behavior or API changes

## Tests

Before opening a change, make sure these pass:

```bash
npm run typecheck
npm run test
npm run build
```

Add tests when changing:

- toolbar behavior
- command dispatch
- markdown transforms
- mode switching
- public integration behavior

Prioritize high-value tests over shallow coverage.

## Documentation

Update `README.md` when:

- package usage changes
- public types change
- examples need to reflect a new or changed feature

Update `CHANGELOG.md` when:

- behavior changes for package users
- public API changes
- notable internal refactors affect maintainability or future work

## Pull Requests

A good pull request should explain:

- what changed
- why it changed
- whether the public API changed
- which docs were updated
- which tests were added or updated

If a change affects package consumers, call that out explicitly.
