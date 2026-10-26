// Book-by-book reading plan: one chapter per completed day, in canonical order. Skipping a day never moves the place.

export const BOOKS: [string, number][] = [
  ["Genesis", 50], ["Exodus", 40], ["Leviticus", 27], ["Numbers", 36], ["Deuteronomy", 34], ["Joshua", 24], ["Judges", 21], ["Ruth", 4],
  ["1 Samuel", 31], ["2 Samuel", 24], ["1 Kings", 22], ["2 Kings", 25], ["1 Chronicles", 29], ["2 Chronicles", 36], ["Ezra", 10], ["Nehemiah", 13],
  ["Esther", 10], ["Job", 42], ["Psalms", 150], ["Proverbs", 31], ["Ecclesiastes", 12], ["Song of Solomon", 8], ["Isaiah", 66], ["Jeremiah", 52],
  ["Lamentations", 5], ["Ezekiel", 48], ["Daniel", 12], ["Hosea", 14], ["Joel", 3], ["Amos", 9], ["Obadiah", 1], ["Jonah", 4], ["Micah", 7],
  ["Nahum", 3], ["Habakkuk", 3], ["Zephaniah", 3], ["Haggai", 2], ["Zechariah", 14], ["Malachi", 4],
  ["Matthew", 28], ["Mark", 16], ["Luke", 24], ["John", 21], ["Acts", 28], ["Romans", 16], ["1 Corinthians", 16], ["2 Corinthians", 13],
  ["Galatians", 6], ["Ephesians", 6], ["Philippians", 4], ["Colossians", 4], ["1 Thessalonians", 5], ["2 Thessalonians", 3], ["1 Timothy", 6],
  ["2 Timothy", 4], ["Titus", 3], ["Philemon", 1], ["Hebrews", 13], ["James", 5], ["1 Peter", 5], ["2 Peter", 3], ["1 John", 5], ["2 John", 1],
  ["3 John", 1], ["Jude", 1], ["Revelation", 22],
];
const CHAPTERS = new Map(BOOKS);

export type ReadingPlan = { book: string; chapter: number };

export const isValidRef = (p: ReadingPlan) => Number.isInteger(p.chapter) && p.chapter >= 1 && p.chapter <= (CHAPTERS.get(p.book) ?? 0);
export const refLabel = (p: ReadingPlan) => (CHAPTERS.get(p.book) === 1 ? p.book : `${p.book} ${p.chapter}`);

// The chapter after this one; the end of a book moves on to the next book (and Revelation back to Genesis).
export function nextRef(p: ReadingPlan): ReadingPlan {
  const n = CHAPTERS.get(p.book) ?? 1;
  if (p.chapter < n) return { book: p.book, chapter: p.chapter + 1 };
  const i = BOOKS.findIndex(([b]) => b === p.book);
  return { book: BOOKS[(i + 1) % BOOKS.length][0], chapter: 1 };
}

export function parseRef(s: string): ReadingPlan | null {
  const m = /^(.+?) (\d{1,3})$/.exec(s.trim());
  const p = m ? { book: m[1], chapter: Number(m[2]) } : { book: s.trim(), chapter: 1 };
  return isValidRef(p) ? p : null;
}
