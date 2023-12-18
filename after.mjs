import fs from 'fs';

// 설정
const startPath = './dist/apps/stock-trading-bot';
const targetPath = 'E:\\gojuwork\\android\\MyStockTrading\\app\\src\\main\\assets\\';

const file = fs.readFileSync(`${startPath}/index.html`);

// index.html 파일 수정
const split = file.toString().split('\n');

const newFile = [];
let scriptPart;
split.forEach((str) => {
  if (str.includes('<script')) {
    scriptPart = str.replace('type="module"', '').replace('crossorigin', '');
  } else {
    if (str.includes('</body>')) {
      newFile.push(`${scriptPart}`);
    }
    newFile.push(`${str}`);
  }
});

fs.writeFileSync(`${startPath}/index.html`, newFile.join('\n'));

// 안드로이드 assets 로 복사
fs.rmSync(targetPath, { recursive: true, force: true });
fs.mkdirSync(targetPath);
const dir = fs.readdirSync(startPath);
dir.forEach((d) => {
  if (d === 'assets') {
    fs.mkdirSync(`${targetPath}${d}`);
    const dir2 = fs.readdirSync(`${startPath}/${d}`);
    dir2.forEach((d2) => {
      fs.copyFileSync(`${startPath}/${d}/${d2}`, `${targetPath}${d}\\${d2}`);
    });
  } else {
    fs.copyFileSync(`${startPath}/${d}`, targetPath + d);
  }
});