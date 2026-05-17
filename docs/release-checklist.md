# Release Checklist

1. Confirm the package is still targeting external REST integration, not a Confluence plugin.
2. Review `docs/research-summary.md` for any new Confluence 6.0.x compatibility findings.
3. Run `npm ci`.
4. Run `npm run typecheck`.
5. Run `npm test`.
6. Run `npm run build`.
7. Run `npm run pack:dry-run`.
8. Test against a non-production Confluence 6.0.x instance with read-only mode first.
9. Test write tools only with `CONFLUENCE_READ_ONLY=false` and `CONFLUENCE_ENABLE_WRITE_TOOLS=true`.
10. Update `CHANGELOG.md` if present.
11. Bump `package.json` version.
12. Publish with `npm publish --access public` when ready.
