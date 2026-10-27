const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
function expectSource(pattern, message) { assert(pattern.test(html), message); }
expectSource(/id="cRepoScorePickerBtn"/, '악보 선택 버튼이 없습니다.');
expectSource(/https:\/\/khmass-liturgy\.github\.io\/c-repo\/\?picker=khcg/, 'c-repo 연결 주소가 없습니다.');
expectSource(/event\.origin === window\.location\.origin/, '메시지 출처 검사가 없습니다.');
expectSource(/event\.data\.type === "c-repo-score-selected"/, '악보 선택 메시지 검사가 없습니다.');
expectSource(/document\.getElementById\("scoreLink"\)\.value = link/, '악보 링크 연결이 없습니다.');
expectSource(/v20\d{2}\.\d{2}\.\d{2}-\d+/, '화면 버전 형식이 올바르지 않습니다.');
for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) new Function(match[1]);
console.log('KHCG_SCORE_PICKER_TEST_OK');
