const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name, requireFn = require) {
    const context = { exports: {}, require: requireFn };
    const code = fs.readFileSync(path.join(__dirname, '../src/utils/', name + '.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return context.exports;
}
const ranking = load('clubRanking');
const { matchesPerformanceProgram: matches, PERFORMANCE_PROGRAMS: programs } = load('performancePrograms', () => ranking);
assert.equal(programs[0].clubs.length, 6);
assert.equal(programs[1].clubs.length, 3);
for (const id of ['유스','프리즘','에이블','ABLE','ABLE2026','루센트','유니티',' xoxo ']) {
    assert.ok(matches('together', id));
    assert.ok(!matches('seoul', id));
}
for (const id of ['크레이브','청온화','아르페']) {
    assert.ok(matches('seoul', id));
    assert.ok(!matches('together', id));
}
assert.ok(matches('together', 'User07', '프리즘'));
assert.ok(!matches('together', '프리즘2'));
assert.ok(!matches('together', 'Daily', '데일리'));
assert.ok(!matches('seoul', '학교 협조실적'));
const rows = [{id:'유스',people:5},{id:'ABLE2026',people:7},{id:'크레이브',people:3},{id:'기타',people:9}];
const original = JSON.stringify(rows);
const sum = program => rows.filter(r=>matches(program,r.id)).reduce((n,r)=>n+r.people,0);
assert.equal(sum('all'),24); assert.equal(sum('together'),12); assert.equal(sum('seoul'),3);
assert.equal(sum('all'),24); assert.equal(JSON.stringify(rows),original);
console.log('PASS: exact participant lists, ABLE aliases, ID/name matching, separate subsets and unchanged full totals.');
