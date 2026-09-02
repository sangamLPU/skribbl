export type WordDifficulty = "easy" | "medium" | "hard";
export interface WordEntry {
    word: string;
    category: string;
    difficulty: WordDifficulty;
}
export declare const DICTIONARY: WordEntry[];
export declare class WordGenerator {
    private usedWords;
    getChoices(count?: number): string[];
    markUsed(word: string): void;
}
