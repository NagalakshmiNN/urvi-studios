// Turns Playwright's `--list --reporter=json` output into one flat row per
// test, which build-test-inventory.py then writes into the coverage
// spreadsheet. Keeping this as a step of its own means the spreadsheet is
// always generated from the real suite rather than typed by hand.
//
//   PW_SKIP_SERVER=1 npx playwright test --list --reporter=json > /tmp/tests.json
//   node scripts/flatten-tests.js
//   python scripts/build-test-inventory.py

const fs = require("node:fs");

const input = process.argv[2] || "/tmp/tests.json";
const output = process.argv[3] || "/tmp/test-rows.json";

const data = JSON.parse(fs.readFileSync(input, "utf8"));
const rows = [];

function walk(suite, titles) {
  const trail = [...titles, suite.title].filter(Boolean);
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      rows.push({
        file: spec.file || suite.file,
        // Drop the first entry, which is the file name repeated.
        group: trail.slice(1).join(" › "),
        title: spec.title,
        line: spec.line,
        project: test.projectName,
      });
    }
  }
  for (const child of suite.suites || []) walk(child, trail);
}

for (const suite of data.suites || []) walk(suite, []);

fs.writeFileSync(output, JSON.stringify(rows, null, 1));
console.log(`${rows.length} tests → ${output}`);
