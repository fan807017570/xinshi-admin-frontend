# Recovery Notes

## Important

The original `/Users/anranfan/core-bank-dp/dist` package does not include source maps. Because of that, exact Vue source restoration is not possible from the compiled bundle alone.

This project currently contains two recovery tracks:

- `src/`: maintainable Vue 3 source reconstructed from the compiled bundle and visible behavior.
- `legacy-dist/`: an exact copy of the original compiled dist package.

## Build Scripts

- `npm run build` or `npm run build:source`: builds from reconstructed Vue source.
- `npm run build:dist-exact`: copies `legacy-dist/` to `dist/`, producing a runtime package that matches the original compiled dist.

Use `build:dist-exact` when deployment must be identical to the original compiled package. Use `build:source` when testing ongoing source reconstruction work.
