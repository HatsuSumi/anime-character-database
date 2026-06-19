const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const ipFileName = 'ip-data.json';
const characterFileName = 'characters-data.json';
const lookupFileName = 'character-lookup.json';

function loadJson(fileName) {
  const filePath = path.join(rootDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function readText(fileName) {
  const filePath = path.join(rootDir, fileName);
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(fileName, content) {
  const filePath = path.join(rootDir, fileName);
  fs.writeFileSync(filePath, content, 'utf8');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 4)}\n`;
}

function generateLookup(ipData, characterData) {
  if (!isPlainObject(ipData)) {
    throw new Error(`${ipFileName} 顶层必须是对象`);
  }

  if (!isPlainObject(characterData)) {
    throw new Error(`${characterFileName} 顶层必须是对象`);
  }

  const ipById = new Map();
  for (const [key, ip] of Object.entries(ipData)) {
    if (!isPlainObject(ip)) {
      throw new Error(`作品记录 ${key} 必须是对象`);
    }

    if (!isNonEmptyString(ip.id)) {
      throw new Error(`作品记录 ${key} 缺少有效 id`);
    }

    if (!isNonEmptyString(ip.name)) {
      throw new Error(`作品记录 ${key} 缺少有效 name`);
    }

    ipById.set(ip.id, ip);
  }

  const lookup = {};

  for (const [key, character] of Object.entries(characterData)) {
    if (!isPlainObject(character)) {
      throw new Error(`角色记录 ${key} 必须是对象`);
    }

    if (!isNonEmptyString(character.id)) {
      throw new Error(`角色记录 ${key} 缺少有效 id`);
    }

    if (!isNonEmptyString(character.name)) {
      throw new Error(`角色记录 ${key} 缺少有效 name`);
    }

    if (!isNonEmptyString(character.ip_id)) {
      throw new Error(`角色记录 ${key} 缺少有效 ip_id`);
    }

    const ip = ipById.get(character.ip_id);
    if (!ip) {
      throw new Error(`角色 ${character.id} 引用了不存在的 ip_id=${character.ip_id}`);
    }

    const lookupKey = `${character.name}@${ip.name}`;
    if (lookupKey in lookup) {
      throw new Error(`发现重复 lookup 键 ${lookupKey}，角色 ${lookup[lookupKey]} 与 ${character.id} 冲突`);
    }

    lookup[lookupKey] = character.id;
  }

  return lookup;
}

function compareLookupObjects(currentLookup, nextLookup) {
  const currentEntries = Object.entries(currentLookup);
  const nextEntries = Object.entries(nextLookup);

  if (currentEntries.length !== nextEntries.length) {
    return {
      equal: false,
      reason: `数量不同，当前 ${currentEntries.length} 条，生成 ${nextEntries.length} 条`,
    };
  }

  for (const [key, value] of nextEntries) {
    if (!(key in currentLookup)) {
      return {
        equal: false,
        reason: `缺少键 ${key}`,
      };
    }

    if (currentLookup[key] !== value) {
      return {
        equal: false,
        reason: `键 ${key} 的值不同，当前 ${currentLookup[key]}，生成 ${value}`,
      };
    }
  }

  const currentKeys = new Set(currentEntries.map(([key]) => key));
  for (const [key] of currentEntries) {
    if (!currentKeys.has(key)) {
      return {
        equal: false,
        reason: `存在无法识别的键 ${key}`,
      };
    }
  }

  return {
    equal: true,
    reason: '完全一致',
  };
}

function printUsage() {
  console.log('用法:');
  console.log('  node generate-character-lookup.js --check');
  console.log('  node generate-character-lookup.js --write');
}

function main() {
  const mode = process.argv[2] || '--check';
  if (mode !== '--check' && mode !== '--write') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const ipData = loadJson(ipFileName);
  const characterData = loadJson(characterFileName);
  const currentLookup = loadJson(lookupFileName);
  const nextLookup = generateLookup(ipData, characterData);
  const comparison = compareLookupObjects(currentLookup, nextLookup);

  if (mode === '--check') {
    if (!comparison.equal) {
      console.log(`校验失败：${lookupFileName} 与主数据不一致。`);
      console.log(`原因：${comparison.reason}`);
      process.exitCode = 1;
      return;
    }

    console.log(`校验通过：${lookupFileName} 与主数据一致。`);
    return;
  }

  const nextContent = formatJson(nextLookup);
  const currentContent = readText(lookupFileName);

  if (currentContent === nextContent) {
    console.log(`${lookupFileName} 已经是最新内容，无需重写。`);
    return;
  }

  writeText(lookupFileName, nextContent);
  console.log(`已根据 ${characterFileName} 和 ${ipFileName} 重新生成 ${lookupFileName}。`);
}

main();
