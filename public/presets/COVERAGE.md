# Preset coverage

Total coverage: 952 of 3300 commands from vendor docs, 412 approximate, 1936 missing. That is the sum across 129 integrations whose presets record command coverage. Presets without command coverage are not in this total.

Generated 2026-11-09T20:40:01.252Z from a local checkout of [demisto/content](https://github.com/demisto/content) (MIT).

| | |
| --- | --- |
| Integration directories scanned | 1363 |
| Usable presets | 1335 |
| From sample JSON | 555 |
| From a README JSON example | 27 |
| From YAML command outputs | 753 |
| With at least one HTTP path taken from the Python client | 822 |
| Skipped, no outputs, sample, or README example | 28 |
| Skipped, importer error | 0 |
| Hand-curated and not overwritten | 21 |

A sample preset comes from JSON in `test_data/` or an integration `*_test/` fixture. When that is missing, a README `json` fence is used. Otherwise command `outputs` context paths in the integration YAML become the field tree. Paths and methods come from HTTP calls in the Python client. When none are found, the operation is `GET /` and the fidelity is `shape`.

This is structural fidelity for XSOAR content development, not a claim that every response matches the vendor's current API. Hand-checked presets are listed in `VERIFICATION.md`. Regenerate with `npm run presets:import -- --content ./content`.
