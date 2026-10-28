const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const storage = new Map([['sessionToken','test-session']]);
let calls = 0, expired = 0;
let respond = async () => { throw new Error('offline'); };
const globals = { console, Response, AbortController, setTimeout, clearTimeout, Event,
    window: {dispatchEvent: () => { expired++; }},
    sessionStorage: {getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    fetch: async (...args) => { calls++; return respond(...args); } };
function load(file, imports = {}) {
    let source = fs.readFileSync(file,'utf8').replaceAll('import.meta.env.VITE_GOOGLE_SCRIPT_URL','"https://example.invalid/test"');
    const ctx = {...globals,exports:{},require:key=>imports[key]};
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
    return ctx.exports;
}
const transport = load('src/services/apiTransport.ts');
const {ApiDataService} = load('src/services/DataService.ts',{'./apiTransport':transport});
const api = new ApiDataService();
(async () => {
    await assert.rejects(api.restoreSession(),/연결/);
    assert.equal(storage.get('sessionToken'),'test-session'); assert.equal(calls,2);
    await assert.rejects(api.getBookings('2026-10-28'),/연결/);
    calls=0;
    await assert.rejects(api.login('test','9876'),/연결/); assert.equal(calls,1);
    respond=async()=>new Response(JSON.stringify({status:'success',data:[]})); calls=0;
    await Promise.all([api.getBookings('2026-10-28'),api.getBookings('2026-10-28')]); assert.equal(calls,1);
    respond=async()=>new Response(JSON.stringify({status:'error',message:'로그인이 만료되었습니다. 다시 로그인해주세요.'}));
    assert.equal(await api.restoreSession(),null); assert.equal(storage.has('sessionToken'),false); assert.equal(expired,1);
    console.log('PASS: transient failure preserves session; read failures throw; login not retried; concurrent reads deduplicated; actual expiry clears session.');
})().catch(e=>{console.error(e);process.exitCode=1;});
