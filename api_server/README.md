# Holotrace API server

To install dependencies:

```bash
bun install
```

To run the current scaffold:

```bash
bun run index.ts
```

## Source layout

```text
src/db/        Drizzle schema
src/circuit/   recognition, OpenCV wire-graph, normalization, and Circuit IR contracts
```

The circuit normalizer belongs to the server boundary. It combines the OpenCV analysis and classifier result, then
returns canonical Circuit IR, source-image layout, and structured review issues to the user-facing application.
