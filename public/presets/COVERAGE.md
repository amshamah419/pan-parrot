# Preset coverage

Generated 2026-11-09T18:56:24.527Z from a local checkout of [demisto/content](https://github.com/demisto/content) (MIT).

| | |
| --- | --- |
| Integration directories scanned | 1363 |
| Usable presets inferred from sample JSON | 530 |
| Of those, with at least one HTTP path taken from the Python client | 377 |
| Skipped, no usable sample body | 819 |
| Skipped, importer error | 14 |
| Hand-curated and not overwritten | 1 (Akamai WAF SIEM) |

A usable preset means at least one JSON object or array was found in `test_data/` or an integration `*_test/` fixture. XSOAR command-result wrappers are unwrapped at `Contents` when that field is present. Paths come from string literals in the client that look like URL paths. When none are found, the operation is `GET /` and the preset fidelity is `shape` rather than `sample`.

This is structural fidelity for XSOAR content development, not a claim that every response matches the vendor's current API. Akamai WAF SIEM is the hand-checked preset. Regenerate with `npm run presets:import -- --content ./content`.
