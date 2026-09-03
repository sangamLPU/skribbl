const fs = require('fs');
const path = require('path');

const wordListPath = path.join(__dirname, '../../../word-list.txt');
const outputPath = path.join(__dirname, '../src/dictionary.ts');

const content = fs.readFileSync(wordListPath, 'utf8');

const lines = content.split('\n');

const entries = [];
let currentCategory = 'general';

for (let line of lines) {
  line = line.trim();
  if (!line || line.startsWith('#')) continue;

  if (line.startsWith('[')) {
    // [single:11] or [phrase:3,3]
    currentCategory = line.slice(1, -1);
    continue;
  }

  // It's a word
  // Deduplicate case-insensitively within the same category
  const existing = entries.find(e => e.category === currentCategory && e.word.toLowerCase() === line.toLowerCase());
  if (!existing) {
    entries.push({
      word: line,
      category: currentCategory,
    });
  }
}

let outContent = `// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: word-list.txt

export interface WordEntry {
  word: string;
  category: string;
  isPhrase: boolean;
  wordLengths: number[];
}

export const DICTIONARY: WordEntry[] = [
`;

for (const entry of entries) {
  const isPhrase = entry.category.startsWith('phrase');
  
  // Clean up punctuation to count lengths, OR just split by space?
  // The instructions: "The game's hidden-word display must preserve word boundaries... [phrase:3,5] Ice cream means lengths 3 and 5"
  // So the lengths should match the words.
  // We can just precalculate the lengths for the client/server to use.
  let wordLengths = [];
  if (isPhrase) {
    // Try to parse the lengths from the category [phrase:3,3]
    const match = entry.category.match(/phrase:([\d,]+)/);
    if (match) {
      wordLengths = match[1].split(',').map(Number);
    }
  } else {
    // Single word, length is just the word length (ignoring punctuation?)
    // Actually the category might say [single:11]
    const match = entry.category.match(/single:(\d+)/);
    if (match) {
      wordLengths = [Number(match[1])];
    }
  }
  
  outContent += `  { word: ${JSON.stringify(entry.word)}, category: ${JSON.stringify(entry.category)}, isPhrase: ${isPhrase}, wordLengths: ${JSON.stringify(wordLengths)} },\n`;
}

outContent += `];\n`;

fs.writeFileSync(outputPath, outContent, 'utf8');
console.log(`Generated dictionary.ts with ${entries.length} entries.`);
