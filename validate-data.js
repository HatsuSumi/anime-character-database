const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

function loadJson(fileName) {
  const filePath = path.join(rootDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function pushIssue(store, level, scope, message) {
  store[level].push({ scope, message });
}

function printIssues(title, issues) {
  if (issues.length === 0) {
    console.log(`${title}: 0`);
    return;
  }

  console.log(`${title}: ${issues.length}`);
  for (const issue of issues) {
    console.log(`  - [${issue.scope}] ${issue.message}`);
  }
}

function main() {
  const issues = {
    errors: [],
    warnings: [],
  };

  const ipData = loadJson('ip-data.json');
  const characterData = loadJson('characters-data.json');
  const characterLookup = loadJson('character-lookup.json');

  if (!isPlainObject(ipData)) {
    throw new Error('ip-data.json 顶层必须是对象');
  }

  if (!isPlainObject(characterData)) {
    throw new Error('characters-data.json 顶层必须是对象');
  }

  if (!isPlainObject(characterLookup)) {
    throw new Error('character-lookup.json 顶层必须是对象');
  }

  const ipIds = new Set();
  const ipNames = new Map();
  const validIpById = new Map();

  for (const [key, ip] of Object.entries(ipData)) {
    const scope = `ip:${key}`;

    if (!isPlainObject(ip)) {
      pushIssue(issues, 'errors', scope, '记录必须是对象');
      continue;
    }

    if (ip.id !== key) {
      pushIssue(issues, 'errors', scope, `对象键与 id 不一致，key=${key} id=${ip.id}`);
    }

    if (!isNonEmptyString(ip.id)) {
      pushIssue(issues, 'errors', scope, 'id 必须是非空字符串');
    }

    if (!isNonEmptyString(ip.name)) {
      pushIssue(issues, 'errors', scope, 'name 必须是非空字符串');
    }

    if (typeof ip.name_en !== 'undefined' && typeof ip.name_en !== 'string') {
      pushIssue(issues, 'warnings', scope, 'name_en 建议为字符串');
    }

    if (typeof ip.year !== 'number' || !Number.isInteger(ip.year) || ip.year < 0) {
      pushIssue(issues, 'warnings', scope, `year 建议为非负整数，当前值=${ip.year}`);
    }

    if (typeof ip.season !== 'number' || !Number.isInteger(ip.season) || ip.season < 0) {
      pushIssue(issues, 'warnings', scope, `season 建议为非负整数，当前值=${ip.season}`);
    }

    if (ipIds.has(ip.id)) {
      pushIssue(issues, 'errors', scope, `发现重复 ip id=${ip.id}`);
    } else if (isNonEmptyString(ip.id)) {
      ipIds.add(ip.id);
    }

    if (isNonEmptyString(ip.name)) {
      if (!ipNames.has(ip.name)) {
        ipNames.set(ip.name, []);
      }
      ipNames.get(ip.name).push(ip.id);
    }

    if (isNonEmptyString(ip.id)) {
      validIpById.set(ip.id, ip);
    }
  }

  for (const [ipName, ids] of ipNames.entries()) {
    if (ids.length > 1) {
      pushIssue(issues, 'warnings', `ip-name:${ipName}`, `作品名重复，关联 id=${ids.join(', ')}`);
    }
  }

  const characterIds = new Set();
  const canonicalLookupSource = new Map();
  const validCharacterById = new Map();
  let emptyAvatarCount = 0;
  let emptyNameEnCount = 0;
  let emptyCvCount = 0;

  for (const [key, character] of Object.entries(characterData)) {
    const scope = `char:${key}`;

    if (!isPlainObject(character)) {
      pushIssue(issues, 'errors', scope, '记录必须是对象');
      continue;
    }

    if (character.id !== key) {
      pushIssue(issues, 'errors', scope, `对象键与 id 不一致，key=${key} id=${character.id}`);
    }

    if (!isNonEmptyString(character.id)) {
      pushIssue(issues, 'errors', scope, 'id 必须是非空字符串');
    }

    if (!isNonEmptyString(character.name)) {
      pushIssue(issues, 'errors', scope, 'name 必须是非空字符串');
    }

    if (typeof character.name_en !== 'string') {
      pushIssue(issues, 'warnings', scope, 'name_en 建议为字符串');
    } else if (character.name_en.trim() === '') {
      emptyNameEnCount += 1;
    }

    if (!isValidStringArray(character.cv)) {
      pushIssue(issues, 'warnings', scope, 'cv 建议为字符串数组');
    } else {
      const normalizedCv = character.cv.map((item) => item.trim()).filter((item) => item.length > 0);
      if (normalizedCv.length !== character.cv.length) {
        pushIssue(issues, 'warnings', scope, 'cv 数组中存在空字符串或未清理的空白项');
      }
      if (normalizedCv.length === 0) {
        emptyCvCount += 1;
      }
    }

    if (typeof character.avatar !== 'string') {
      pushIssue(issues, 'warnings', scope, 'avatar 建议为字符串');
    } else if (character.avatar.trim() === '') {
      emptyAvatarCount += 1;
    } else if (!isValidUrl(character.avatar)) {
      pushIssue(issues, 'warnings', scope, `avatar 不是合法 URL：${character.avatar}`);
    }

    if (!isNonEmptyString(character.ip_id)) {
      pushIssue(issues, 'errors', scope, 'ip_id 必须是非空字符串');
    } else if (!validIpById.has(character.ip_id)) {
      pushIssue(issues, 'errors', scope, `引用的 ip_id 不存在：${character.ip_id}`);
    }

    if (characterIds.has(character.id)) {
      pushIssue(issues, 'errors', scope, `发现重复角色 id=${character.id}`);
    } else if (isNonEmptyString(character.id)) {
      characterIds.add(character.id);
    }

    if (isNonEmptyString(character.id)) {
      validCharacterById.set(character.id, character);
    }

    const ip = validIpById.get(character.ip_id);
    if (ip && isNonEmptyString(character.name)) {
      const canonicalKey = `${character.name}@${ip.name}`;
      if (!canonicalLookupSource.has(canonicalKey)) {
        canonicalLookupSource.set(canonicalKey, []);
      }
      canonicalLookupSource.get(canonicalKey).push(character.id);
    }
  }

  for (const [canonicalKey, ids] of canonicalLookupSource.entries()) {
    if (ids.length > 1) {
      pushIssue(issues, 'errors', `lookup-source:${canonicalKey}`, `同一查询键对应多个角色：${ids.join(', ')}`);
    }
  }

  const expectedLookup = new Map();
  for (const [canonicalKey, ids] of canonicalLookupSource.entries()) {
    if (ids.length === 1) {
      expectedLookup.set(canonicalKey, ids[0]);
    }
  }

  for (const [lookupKey, charId] of Object.entries(characterLookup)) {
    const scope = `lookup:${lookupKey}`;

    if (!isNonEmptyString(charId)) {
      pushIssue(issues, 'errors', scope, 'lookup 值必须是非空字符串角色 id');
      continue;
    }

    const character = validCharacterById.get(charId);
    if (!character) {
      pushIssue(issues, 'errors', scope, `lookup 指向不存在的角色 id=${charId}`);
      continue;
    }

    const ip = validIpById.get(character.ip_id);
    if (!ip) {
      pushIssue(issues, 'errors', scope, `角色 ${charId} 关联的作品不存在，无法验证 lookup`);
      continue;
    }

    const canonicalKey = `${character.name}@${ip.name}`;
    if (lookupKey !== canonicalKey) {
      pushIssue(issues, 'warnings', scope, `lookup 键与规范键不一致，建议为 ${canonicalKey}`);
    }
  }

  for (const [expectedKey, expectedCharId] of expectedLookup.entries()) {
    if (!(expectedKey in characterLookup)) {
      pushIssue(issues, 'warnings', `lookup-missing:${expectedKey}`, `缺少 lookup，建议映射到 ${expectedCharId}`);
      continue;
    }

    if (characterLookup[expectedKey] !== expectedCharId) {
      pushIssue(issues, 'errors', `lookup-mismatch:${expectedKey}`, `lookup 应为 ${expectedCharId}，当前是 ${characterLookup[expectedKey]}`);
    }
  }

  const summary = {
    ipCount: Object.keys(ipData).length,
    characterCount: Object.keys(characterData).length,
    lookupCount: Object.keys(characterLookup).length,
    emptyAvatarCount,
    emptyNameEnCount,
    emptyCvCount,
    errorCount: issues.errors.length,
    warningCount: issues.warnings.length,
  };

  console.log('=== 数据校验结果 ===');
  console.log(`IP 数量: ${summary.ipCount}`);
  console.log(`角色数量: ${summary.characterCount}`);
  console.log(`查询索引数量: ${summary.lookupCount}`);
  console.log(`空 avatar 数量: ${summary.emptyAvatarCount}`);
  console.log(`空 name_en 数量: ${summary.emptyNameEnCount}`);
  console.log(`空 cv 数量: ${summary.emptyCvCount}`);
  console.log('');

  printIssues('错误', issues.errors);
  console.log('');
  printIssues('警告', issues.warnings);
  console.log('');

  if (issues.errors.length > 0) {
    console.log('校验失败：请先修复错误。');
    process.exitCode = 1;
    return;
  }

  console.log('校验通过：没有发现阻断性错误。');
}

main();
