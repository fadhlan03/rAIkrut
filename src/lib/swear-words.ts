// Indonesian swear words dictionary for content moderation
// Used to highlight inappropriate language in interview transcripts

export const indonesianSwearWords = [
  'cok',
  'jir',
  'jing',
  'anjir',
  'gila',
  'edan',
  'sinting',
  'bangsat',
  'sialan',
  'tai',
  'kampret',
  'brengsek',
  'setan',
  'dasar tolol',
  'bego',
  'goblok',
  'dongo',
  'lemot',
  'monyet',
  'anjing'
];

// Function to highlight swear words in text
export function highlightSwearWords(text: string): string {
  if (!text) return text;
  
  let highlightedText = text;
  
  // Sort by length (longest first) to handle multi-word phrases correctly
  const sortedSwearWords = [...indonesianSwearWords].sort((a, b) => b.length - a.length);
  
  sortedSwearWords.forEach(swearWord => {
    // Create case-insensitive regex with word boundaries
    const regex = new RegExp(`\\b${swearWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    
    // Replace with highlighted version
    highlightedText = highlightedText.replace(regex, (match) => {
      return `<span class="bg-red-200 text-red-800 px-1 rounded font-medium">${match}</span>`;
    });
  });
  
  return highlightedText;
}

// Function to check if text contains swear words
export function containsSwearWords(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  return indonesianSwearWords.some(swearWord => {
    const regex = new RegExp(`\\b${swearWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(lowerText);
  });
}