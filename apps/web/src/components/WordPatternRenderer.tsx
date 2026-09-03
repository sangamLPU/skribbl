import React from 'react';

interface WordPatternRendererProps {
  pattern: string;
}

export function WordPatternRenderer({ pattern }: WordPatternRendererProps) {
  if (!pattern) return null;

  const words = pattern.split(' ');

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-6 w-full">
      {words.map((word, wordIndex) => (
        <div key={wordIndex} className="flex gap-1 md:gap-2">
          {word.split('').map((char, charIndex) => {
            const isAlphaNumeric = /[a-zA-Z0-9]/.test(char);
            const isHidden = char === '_';
            
            return (
              <div 
                key={charIndex}
                className={`flex items-end justify-center w-4 sm:w-6 md:w-8 h-8 md:h-10 text-xl md:text-3xl font-black text-gray-900 ${
                  (isAlphaNumeric || isHidden) ? 'border-b-4 border-gray-900' : ''
                }`}
              >
                {char !== '_' ? char : '\u00A0'}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
