import fs from 'fs';
import path from 'path';

const filesToPatch = [
  'node_modules/html2canvas/dist/html2canvas.esm.js',
  'node_modules/html2canvas/dist/html2canvas.js',
  'node_modules/html2canvas/dist/html2canvas.min.js',
];

for (const relPath of filesToPatch) {
  const fullPath = path.resolve(relPath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    const regex = /throw new Error\(\s*["']Attempting to parse an unsupported color function[^)]+\)/g;
    if (regex.test(content)) {
      content = content.replace(regex, 'return 0');
      fs.writeFileSync(fullPath, content);
      console.log(`Successfully patched: ${relPath}`);
    }
  }
}
