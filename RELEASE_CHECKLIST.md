# Release checklist

Canonical repository target: `https://github.com/thePlannerIvan/planners-quali-box`

## Completed in this package

- [x] Skill identifier and directory use `planners-quali-box`.
- [x] `SKILL.md` and `agents/openai.yaml` describe the same product.
- [x] README includes positioning, workflow, installation, prompts, structure, privacy, license, and commercial support.
- [x] AGPL-3.0 license, NOTICE, trademark boundary, commercial terms, security policy, and third-party notices are included.
- [x] Public eval suite contains synthetic data only.
- [x] CSV files validate and all cases resolve to existing prompts and datasets.
- [x] Skill structure and representative scripts pass local smoke checks.
- [x] Cache, generated output, credentials, client data, and local environment files are ignored.

## Before the first GitHub release

- [x] Create the public repository `thePlannerIvan/planners-quali-box`.
- [x] Push this directory as the repository root; do not include its internal/private sibling directories.
- [x] Confirm that README installation commands resolve after the repository becomes public.
- [x] Enable GitHub secret scanning and push protection; keep dependency alerts available for declared dependencies.
- [ ] Review the repository in a logged-out browser session.
- [x] Create tag `v0.1.0` and attach the release notes from `CHANGELOG.md`.
- [ ] Run the six eval prompts with the intended external model and publish only privacy-safe results.

Do not replace the synthetic eval files with real platform exports or customer data in the public repository.
