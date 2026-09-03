"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordGenerator = void 0;
const dictionary_1 = require("./dictionary");
class WordGenerator {
    usedWords = new Set();
    getChoices(count = 3) {
        // Filter out recently used words
        let available = dictionary_1.DICTIONARY.filter(w => !this.usedWords.has(w.word.toLowerCase()));
        // If we run out of words, reset used words and try again
        if (available.length < count) {
            this.usedWords.clear();
            available = dictionary_1.DICTIONARY.slice(); // All words
        }
        const choices = [];
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffled.length && choices.length < count; i++) {
            const candidate = shuffled[i].word;
            // Ensure no duplicate candidates in the same list (case-insensitive)
            if (!choices.some(c => c.toLowerCase() === candidate.toLowerCase())) {
                choices.push(candidate);
            }
        }
        // In the extremely rare case we still don't have enough, fill with randoms
        while (choices.length < count) {
            const randWord = dictionary_1.DICTIONARY[Math.floor(Math.random() * dictionary_1.DICTIONARY.length)].word;
            if (!choices.some(c => c.toLowerCase() === randWord.toLowerCase())) {
                choices.push(randWord);
            }
        }
        return choices;
    }
    markUsed(word) {
        this.usedWords.add(word.toLowerCase());
    }
}
exports.WordGenerator = WordGenerator;
