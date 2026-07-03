# Changelog

All notable changes to this project are documented here, derived from the
project's merged pull request and release-tag history.

## v0.1.2 — 2026-06-25

- ci: add truthful-attribution-gate in WARN (advisory) mode (#19)
- ci: adopt the reusable extension->host IoC conformance gate (org-wide rollout) (#20)
- ci: tag-driven GitHub release on v* (#21)
- ci: adopt secret-scan-gate (#22)
- Disable connect button until LinkedIn OAuth credentials are configured (#23)

## v0.1.1 — 2026-06-13

- ci: adopt source-leak-gate (#1)
- ci: adopt source-leak-gate (#2)
- chore: add .gitignore (#3)
- ci: adopt org gates — SHA-pin all uses: refs, bump source-leak-gate to v0.1.0, add actions-pinned + gitignore gate callers (#4)
- chore: keep internal planning notes untracked (#5)
- Register the LinkedIn provider behind the social-post capability from a serverEntry (#6)
- chore: npm files allowlist + git-archive export-ignore (packaging hygiene) (#7)
- ci: adopt the org ui-design-system gate (#8)
- Bind the LinkedIn connection surface through a host deps slot (cinatra#172 Stage H4) (#10)
- chore: Configure Renovate (#11)
- Add the per-user LinkedIn OAuth connect flow; move the admin form to linkedin-oauth-connector (#9) (#13)
- Prune unused vendored UI primitives (badge/button/input/label) (#14)
- ci(release): grant contents: write + pin reusable workflow to .github HEAD (#15)
- ci: repin reusable release workflow (immutable-safe decoration + corrected build-input provisioning) (#16)
- release: linkedin-connector v0.1.1 (republish on corrected serverEntry build pipeline) (#17)
- ci: repin reusable release workflow to .github@21f807e7 (#18)

## v0.1.0 — 2026-06-03

- Initial release.

## Unreleased

- docs(readme): expand README to the org standard (#24) (#25)
- fix(ui): shadcn raw-element fixes + ramp ui-gate to error (#26)
- ci: adopt source-leak-gate (#27)
- ci: adopt source-leak-gate (#28)
- ci(ui-gate): re-vendor preset with Block-C (dynamic-import ban) + bump pin to v0.1.1 (#29)
- chore: strip private engineering-tracker refs from public source (#30)
- chore: strip private tracker references from workflow comments (#33)
- ci(release): pin reusable-extension-release to gated v0.1.1 (release-approval wall) (#34)
- fix(mcp): bind LinkedIn publish identity to the trusted session actor (#35)
- chore(deps): declare cinatra.consumes for closure-gate enrollment (#36)
- chore(deps): declare cross-extension deps as semver ranges (#37)

