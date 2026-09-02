export type WordDifficulty = "easy" | "medium" | "hard";

export interface WordEntry {
  word: string;
  category: string;
  difficulty: WordDifficulty;
}

export const DICTIONARY: WordEntry[] = [
  // Animals
  { word: "Cat", category: "Animals", difficulty: "easy" },
  { word: "Dog", category: "Animals", difficulty: "easy" },
  { word: "Elephant", category: "Animals", difficulty: "medium" },
  { word: "Giraffe", category: "Animals", difficulty: "medium" },
  { word: "Platypus", category: "Animals", difficulty: "hard" },
  { word: "Penguin", category: "Animals", difficulty: "medium" },
  { word: "Kangaroo", category: "Animals", difficulty: "medium" },
  { word: "Chameleon", category: "Animals", difficulty: "hard" },
  // Food
  { word: "Apple", category: "Food", difficulty: "easy" },
  { word: "Pizza", category: "Food", difficulty: "easy" },
  { word: "Hamburger", category: "Food", difficulty: "medium" },
  { word: "Sushi", category: "Food", difficulty: "medium" },
  { word: "Spaghetti", category: "Food", difficulty: "medium" },
  { word: "Croissant", category: "Food", difficulty: "hard" },
  // Objects
  { word: "Chair", category: "Objects", difficulty: "easy" },
  { word: "Table", category: "Objects", difficulty: "easy" },
  { word: "Computer", category: "Objects", difficulty: "medium" },
  { word: "Microscope", category: "Objects", difficulty: "hard" },
  { word: "Telescope", category: "Objects", difficulty: "hard" },
  { word: "Headphones", category: "Objects", difficulty: "medium" },
  // Transportation
  { word: "Car", category: "Transportation", difficulty: "easy" },
  { word: "Bus", category: "Transportation", difficulty: "easy" },
  { word: "Airplane", category: "Transportation", difficulty: "medium" },
  { word: "Submarine", category: "Transportation", difficulty: "hard" },
  { word: "Helicopter", category: "Transportation", difficulty: "medium" },
  { word: "Bicycle", category: "Transportation", difficulty: "medium" },
  // Nature
  { word: "Tree", category: "Nature", difficulty: "easy" },
  { word: "Flower", category: "Nature", difficulty: "easy" },
  { word: "Mountain", category: "Nature", difficulty: "medium" },
  { word: "Volcano", category: "Nature", difficulty: "medium" },
  { word: "Tornado", category: "Nature", difficulty: "medium" },
  { word: "Avalanche", category: "Nature", difficulty: "hard" },
  { word: "Waterfall", category: "Nature", difficulty: "medium" },
  // Places
  { word: "House", category: "Places", difficulty: "easy" },
  { word: "School", category: "Places", difficulty: "easy" },
  { word: "Hospital", category: "Places", difficulty: "medium" },
  { word: "Library", category: "Places", difficulty: "medium" },
  { word: "Amusement Park", category: "Places", difficulty: "hard" },
  { word: "Castle", category: "Places", difficulty: "medium" },
  // Actions
  { word: "Jump", category: "Actions", difficulty: "easy" },
  { word: "Sleep", category: "Actions", difficulty: "easy" },
  { word: "Dance", category: "Actions", difficulty: "medium" },
  { word: "Sing", category: "Actions", difficulty: "medium" },
  { word: "Swim", category: "Actions", difficulty: "easy" },
  { word: "Juggle", category: "Actions", difficulty: "hard" }
];

export class WordGenerator {
  private usedWords: Set<string> = new Set();
  
  public getChoices(count: number = 3): string[] {
    const available = DICTIONARY.filter(w => !this.usedWords.has(w.word.toLowerCase()));
    
    // If we run out of words, reset used words
    if (available.length < count) {
      this.usedWords.clear();
      return this.getChoices(count);
    }

    const choices: string[] = [];
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    
    // Try to get a mix of difficulties if possible
    const difficulties = ["easy", "medium", "hard"];
    
    for (let i = 0; i < count; i++) {
      const targetDiff = difficulties[i % difficulties.length];
      const matchIndex = shuffled.findIndex(w => w.difficulty === targetDiff && !choices.includes(w.word));
      
      if (matchIndex !== -1) {
        choices.push(shuffled[matchIndex].word);
        shuffled.splice(matchIndex, 1);
      } else {
        choices.push(shuffled[0].word);
        shuffled.splice(0, 1);
      }
    }
    
    return choices;
  }

  public markUsed(word: string) {
    this.usedWords.add(word.toLowerCase());
  }
}
