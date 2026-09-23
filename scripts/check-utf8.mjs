import fs from "node:fs";

const BINARY_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".lock",
  ".7z",
  ".zip",
  ".gz",
  ".tar",
  ".jar",
  ".node",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".map",
]);

function isTextFile(filepath) {
  const ext = filepath.slice(filepath.lastIndexOf(".")).toLowerCase();
  if (BINARY_EXTS.has(ext)) return false;
  return true;
}

function isLikelyUtf8(buffer) {
  let i = 0;
  while (i < buffer.length) {
    const b = buffer[i];
    if (b < 0x80) {
      i++;
      continue;
    }
    let expectedBytes = 0;
    if ((b & 0xe0) === 0xc0) expectedBytes = 1;
    else if ((b & 0xf0) === 0xe0) expectedBytes = 2;
    else if ((b & 0xf8) === 0xf0) expectedBytes = 3;
    else if ((b & 0xfe) === 0xfe) {
      return false;
    } else {
      return false;
    }
    if (i + expectedBytes >= buffer.length) return false;
    for (let j = 1; j <= expectedBytes; j++) {
      if ((buffer[i + j] & 0xc0) !== 0x80) return false;
    }
    i += expectedBytes + 1;
  }
  return true;
}

function hasReplacementChar(buffer) {
  for (let i = 0; i < buffer.length - 2; i++) {
    if (
      buffer[i] === 0xef &&
      buffer[i + 1] === 0xbf &&
      buffer[i + 2] === 0xbd
    ) {
      return true;
    }
  }
  return false;
}

const files = process.argv.slice(2);
if (files.length === 0) {
  process.exit(0);
}

let errors = 0;
for (const file of files) {
  if (!isTextFile(file)) continue;

  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    continue;
  }

  if (buf.length === 0) continue;

  if (!isLikelyUtf8(buf)) {
    console.error(
      `\u2717 ${file}: 不是有效的 UTF-8 编码，可能被以 GBK/Latin1 等错误写入`,
    );
    errors++;
    continue;
  }

  if (hasReplacementChar(buf)) {
    console.error(
      `\u2717 ${file}: 包含 Unicode 替换字符 U+FFFD，文件内容可能已损坏`,
    );
    errors++;
    continue;
  }

  console.log(`\u2713 ${file}`);
}

if (errors > 0) {
  console.error(`\n\u26A0 ${errors} 个文件存在编码问题，请用 UTF-8 重新保存`);
  process.exit(1);
}
