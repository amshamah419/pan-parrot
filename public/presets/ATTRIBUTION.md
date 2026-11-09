# Preset attribution

Integration presets in this directory are derived from the public
[demisto/content](https://github.com/demisto/content) repository, which Palo Alto
Networks publishes under the MIT License:

https://github.com/demisto/content/blob/master/LICENSE

Copyright Palo Alto Networks, Inc. and the demisto/content contributors.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the Software), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

PAN Parrot does not vendor the integration Python. A preset keeps field names,
small structural examples, and HTTP paths inferred from an integration's YAML,
client, and test_data samples. Regenerate them with `npm run presets:import`
against a local checkout of demisto/content. Hand-curated presets are marked
`curated: true` and are not overwritten by the importer.
