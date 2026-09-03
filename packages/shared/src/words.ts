import { DICTIONARY, WordEntry } from "./dictionary";

export class WordGenerator {
  private usedWords: Set<string> = new Set();
  
  public getChoices(count: number = 3): string[] {
    // Filter out recently used words
    let available = DICTIONARY.filter(w => !this.usedWords.has(w.word.toLowerCase()));
    
    // If we run out of words, reset used words and try again
    if (available.length < count) {
      this.usedWords.clear();
      available = DICTIONARY.slice(); // All words
    }

    const choices: string[] = [];
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
      const randWord = DICTIONARY[Math.floor(Math.random() * DICTIONARY.length)].word;
      if (!choices.some(c => c.toLowerCase() === randWord.toLowerCase())) {
        choices.push(randWord);
      }
    }
    
    return choices;
  }

  public markUsed(word: string) {
    this.usedWords.add(word.toLowerCase());
  }
}

