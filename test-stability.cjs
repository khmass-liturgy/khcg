const fs = require('fs');
const assert = require('assert');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('  function cloneData(');
const end = html.indexOf('  function queueLegacyPhoneMigration(');
assert(start !== -1 && end > start, '저장 도우미 함수를 찾지 못했습니다.');

const sandbox = { pendingWrites: {} };
vm.runInNewContext(html.slice(start, end), sandbox);
const plain = value => JSON.parse(JSON.stringify(value));

const before = { a: { title: '이전 제목', memo: '메모' }, b: { title: '다른 악보' } };
const after = { a: { title: '새 제목', memo: '메모' }, b: { title: '다른 악보' } };
const changes = {};
sandbox.diffValues(before, after, 'gyoha-guitar/scores', changes);
assert.deepStrictEqual(plain(changes), { 'gyoha-guitar/scores/a/title': '새 제목' });
assert.deepStrictEqual(plain(sandbox.applyWrites(before, changes, 'gyoha-guitar/scores')), after);

const concurrent = { a: { title: '이전 제목', memo: '다른 운영자가 쓴 메모' }, b: { title: '다른 악보' } };
assert.deepStrictEqual(plain(sandbox.applyWrites(concurrent, changes, 'gyoha-guitar/scores')), {
  a: { title: '새 제목', memo: '다른 운영자가 쓴 메모' }, b: { title: '다른 악보' }
});

sandbox.queueWrite('gyoha-guitar/members/new', { id: 'new', name: '단원', part: '1st' });
sandbox.queueWrite('gyoha-guitar/members/new/name', '수정된 단원');
assert.deepStrictEqual(plain(sandbox.pendingWrites), {
  'gyoha-guitar/members/new': { id: 'new', name: '수정된 단원', part: '1st' }
});

const phones = { a: '010-0000-0001', b: '010-0000-0002' };
assert.deepStrictEqual(plain(sandbox.applyWrites(phones, {
  'gyoha-guitar-phones/a': '010-0000-9999'
}, 'gyoha-guitar-phones')), { a: '010-0000-9999', b: '010-0000-0002' });

assert.deepStrictEqual(plain(sandbox.applyWrites(before, {
  'gyoha-guitar/scores/a': null
}, 'gyoha-guitar/scores')), { b: { title: '다른 악보' } });

assert.match(html, /db\.ref\(\)\.update\(writes\)/);
assert.match(html, /remoteMainData = applyWrites\(remoteMainData, writes, DB_PATH\)/);
assert.match(html, /remotePhonesData = applyWrites\(remotePhonesData, writes, PHONES_PATH\)/);
assert.doesNotMatch(html, /db\.ref\(DB_PATH\)\.set\(/);
assert.match(html, /if\(!isAdminUser\(\) \|\| !phonesLoaded\)/);
assert.match(html, /if\(saveDebounceTimer \|\| saveInFlight \|\| Object\.keys\(pendingWrites\)\.length\)/);

// 실제 화면 재구성 함수에서 연락처 지연 로딩과 로컬 변경 보존을 확인한다.
const runtimeStart = html.indexOf('  function mergeMemberPhones(');
const runtimeEnd = html.indexOf('  function attachPhonesListener(');
const runtime = {
  DB_PATH: 'gyoha-guitar', PHONES_PATH: 'gyoha-guitar-phones',
  ADMIN_EMAILS: ['trsumun@gmail.com'], auth: { currentUser: null },
  dataLoaded: true, phonesLoaded: false, remotePhonesData: {},
  remoteMainData: { members: { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' } } },
  memberPhonesMap: {}, pendingWrites: {}, activeWrites: null,
  state: { scores: [], members: [], rehearsals: [], monthlyRecitals: [], sample: false },
  objToArray: obj => Object.values(obj || {}),
  migrateData: () => false, renderAll: () => {},
  seedSampleData: () => { throw new Error('예시 데이터가 생성되면 안 됩니다.'); },
  saveState: () => {}, scheduleSaveState: () => {}
};
assert(runtimeStart !== -1 && runtimeEnd > runtimeStart);
vm.runInNewContext(html.slice(runtimeStart, runtimeEnd), runtime);
runtime.renderStateFromRemote();
assert.deepStrictEqual(runtime.state.members.map(m => m.phone), ['', '']);
runtime.phonesLoaded = true;
runtime.remotePhonesData = { a: '111', b: '222' };
runtime.renderStateFromRemote();
assert.deepStrictEqual(runtime.state.members.map(m => m.phone), ['111', '222']);
runtime.pendingWrites['gyoha-guitar-phones/a'] = '999';
runtime.remoteMainData.members.b.name = '다른 탭에서 수정';
runtime.renderStateFromRemote();
assert.deepStrictEqual(runtime.state.members.map(m => [m.name, m.phone]),
  [['A', '999'], ['다른 탭에서 수정', '222']]);

runtime.auth.currentUser = { email: 'trsumun@gmail.com' };
runtime.pendingWrites = {};
runtime.remoteMainData = { members: { c: { id: 'c', name: 'C', phone: '333' } } };
runtime.remotePhonesData = {};
runtime.renderStateFromRemote();
assert.strictEqual(runtime.pendingWrites['gyoha-guitar-phones/c'], '333');
assert.strictEqual(runtime.pendingWrites['gyoha-guitar/members/c/phone'], null);

console.log('KHCG_STABILITY_TEST_OK');
