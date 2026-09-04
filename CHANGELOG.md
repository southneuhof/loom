# @southneuhof/loom

## 2.0.1

### Patch Changes

- Rename package to `@southneuhof/loom`; no API change.

## 1.0.10

### Patch Changes

- Automated patch release for changed framework packages.

## 1.0.9

### Patch Changes

- Automated patch release for changed framework packages.
- Updated dependencies
  - @southneuhof/is-data-model@1.0.9

## 1.0.8

### Patch Changes

- Automated patch release for changed framework packages.

## 1.0.7

### Patch Changes

- Automated patch release for changed framework packages.

## 1.0.6

### Patch Changes

- Automated patch release for changed framework packages.

## 1.0.5

### Patch Changes

- Automated patch release for changed framework packages.

## 1.0.4

### Patch Changes

- 26d215c: Improve framework field behavior and renderer consistency, and align section schema updates with the latest landing/editor changes.

  Update SvelteKit framework typing integration for the latest section data and schema usage.

## 1.0.3

### Patch Changes

- Fix deep component subpath exports for Vue single-file components.

## 1.0.1

### Patch Changes

- Release local package updates.
- Updated dependencies
  - @southneuhof/is-data-model@1.0.1
  - @southneuhof/apostle@0.0.2
  - @southneuhof/utilities@0.1.1

## 1.0.0

### Major Changes

- 92ab493: Extract framework utility modules into the new `@southneuhof/utilities` package.

  ### Breaking changes

  - Remove `@southneuhof/loom/utils/*` exports.
  - Migrate all utility imports to `@southneuhof/utilities/*`.

  ### Added

  - New publishable package `@southneuhof/utilities` with utility modules and tests moved from `@southneuhof/loom`.
  - Monorepo release and sync tooling now includes `@southneuhof/utilities` and repository sync to `https://github.com/southneuhof/utilities`.

### Patch Changes

- Updated dependencies [92ab493]
  - @southneuhof/utilities@0.1.0

## 0.0.1

### Patch Changes

- Publish the first framework package release.
- Updated dependencies
  - @southneuhof/apostle@0.0.1
  - @southneuhof/is-data-model@0.0.1
