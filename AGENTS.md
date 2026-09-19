## Project Configuration

- **Language**: TypeScript
- **Package Manager**: bun
- **Add-ons**: none

---

# AGENTS.md

This file provides repository-wide guidance for coding agents and human contributors.

## Product

Holotrace is a desktop and mobile web application that turns a photograph of a hand-drawn circuit diagram into an interactive, usable 3D circuit model with real components.

The intended processing pipeline is:

1. Capture or import an image on the user's device.
2. Run a lightweight first pass locally with OpenCV.
3. Send the processed input to an external conversion service.
4. Run a more capable custom PyTorch model on that service.
5. Return a structured circuit representation that the client can render and simulate in 3D.

## Planned architecture

- Client: Tauri, TypeScript, and Svelte/SvelteKit, targeting desktop and mobile, specially Android.
- On-device vision: OpenCV for preprocessing and the first recognition pass.
- Conversion service: an external service that owns the heavier PyTorch inference pipeline.
- Data store: Tiger Data for component definitions and circuit-diagram equivalents.

These are architectural intentions while the repository is being bootstrapped. Do not invent APIs, schemas, commands, or deployed infrastructure and present them as established. Record material new decisions in the repository when they are implemented.

## Architecture reference

The documents in `reference/` capture the current product and technical direction. Read the relevant documents before changing circuit representation, ML service contracts, rendering, simulation, component data, or persistence.

- `reference/system-pipeline.md`: end-to-end recognition pipeline and canonical Circuit IR.
- `reference/rendering-and-interaction.md`: shared 2D/3D rendering and interaction model.
- `reference/simulation.md`: simulation boundaries, engine options, and validation requirements.
- `reference/tiger-data.md`: PostgreSQL ownership, proposed records, versioning, and time-series data.
- `reference/schema.sql.md`: draft PostgreSQL/Tiger Data schema expressed as annotated SQL.

These are working reference notes, not proof that an API, schema, dependency, or service has been implemented. Preserve the separation between the canonical circuit definition and its ML, layout, rendering, and simulation representations. Update the relevant reference document when an architectural decision changes.

## Engineering principles

- Keep the client responsive and useful on resource-constrained mobile devices.
- Keep heavy ML inference outside the Tauri/Svelte client boundary.
- Define typed, versioned contracts between the client, conversion service, and database-facing code.
- Treat captured diagrams, derived circuit data, and service credentials as sensitive. Minimize collection, avoid logging user content, and never commit secrets.
- Make failure states recoverable. Network or inference failures must not discard a user's capture without warning.
- Prefer small, focused changes that fit the existing code and naming conventions.
- Avoid adding dependencies unless they have a clear product or maintenance benefit.

## Working in this repository

- Read the nearest `AGENTS.md` before changing files. A nested file may add or override guidance for its subtree.
- Inspect existing configuration before assuming which package manager, formatter, linter, or test runner is in use.
- Do not modify generated files directly when a source or generator exists.
- Do not make unrelated cleanup changes.
- Update documentation when a change establishes or changes an interface, workflow, architectural boundary, or developer command.
- DO NO MAKE TESTS

## Guidance for Claude

Before making changes:

1. Inspect the repository and relevant files before proposing an implementation.
2. Distinguish current behavior from the planned architecture described above.
3. Keep work scoped to the request and preserve unrelated user changes.
4. Ask before taking destructive, irreversible, security-sensitive, or externally visible actions when authorization is unclear.

When implementing changes:

- Use TypeScript for client application code and preserve strict types across process and service boundaries.
- Keep Svelte components focused; move reusable state and domain logic into appropriately scoped modules.
- Keep Tauri commands narrow and validate all data crossing the webview/native boundary.
- Do not embed the external ML service's secrets in client code or shipped Tauri binaries.
- Keep the local OpenCV pass separable from remote inference so each stage can evolve independently.
- Represent circuits with a stable structured model rather than coupling rendering directly to raw model output.
- Design database access around explicit component and diagram-equivalence models once those schemas exist.

## AI-assistance disclosure policy

Material use of an AI tool must be disclosed. This includes AI-authored or substantially AI-revised code, documentation, designs, issue text, test plans, or review findings. Simple completion, spelling fixes, formatting, search, and other incidental assistance do not require disclosure.

Put the disclosure in the collaboration artifact closest to the work:

- Pull request: add an `AI assistance` section to the PR description.
- Direct commit without a PR: add an `AI-Assisted-By` trailer to the commit message.
- Issue or discussion substantially drafted by AI: add a short disclosure at the end.
- Generated file or asset with no associated PR, commit, or issue: add provenance in adjacent documentation or file metadata. Avoid source-code comments that merely announce AI use.

Use plain, specific wording. Name the tool and describe its material contribution. Never claim that an AI tool tested, reviewed, or verified work that it did not actually test, review, or verify.

Suggested PR format:

```markdown
## AI assistance

- Tool: Claude
- Used for: Initial implementation and documentation edits
- Human review: Reviewed and revised by <name>
```

Suggested commit trailer:

```text
AI-Assisted-By: Claude <https://claude.ai>
```

For multiple tools, list each tool separately. The human contributor remains responsible for reviewing the result, protecting confidential data, honoring licenses, and confirming that the change is correct.

## Change handoff

When finishing work, summarize:

- what changed;
- important decisions or assumptions;
- validation performed, or why it was not performed;
- follow-up work or known risks.

Follow the AI-assistance disclosure policy above when an AI tool materially contributes to a change. Include the appropriate disclosure text in the proposed PR body or commit message.
