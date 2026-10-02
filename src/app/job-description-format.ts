

export function jobDescriptionSections(lines: string[]) {
  const sections: Array<{ heading: string | null; lines: Array<{ line: string; index: number }> }> = [];
  let current = { heading: null as string | null, lines: [] as Array<{ line: string; index: number }> };

  lines.forEach((line, index) => {
    if (line && isJobDescriptionHeading(line)) {
      if (current.heading || current.lines.some((item) => item.line)) sections.push(current);
      current = { heading: jobDescriptionHeadingText(line), lines: [] };
      return;
    }

    current.lines.push({ line, index });
  });

  if (current.heading || current.lines.length > 0) sections.push(current);
  return sections;
}

function isJobDescriptionBullet(line: string) {
  return /^(?:[-*•●▪◦‣–—]|\d+[.)])\s+/.test(line);
}

export function jobDescriptionBlocks(lines: Array<{ line: string; index: number }>) {
  const blocks: Array<{ type: "paragraph" | "ordered" | "unordered"; lines: typeof lines }> = [];
  let current: (typeof blocks)[number] | undefined;
  for (const item of lines) {
    if (!item.line) { current = undefined; continue; }
    const type = /^\d+[.)]\s+/.test(item.line) ? "ordered" : isJobDescriptionBullet(item.line) ? "unordered" : "paragraph";
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    current.lines.push(item);
  }
  return blocks;
}

function jobDescriptionHeadingText(line: string) {
  return line.replace(/^#+\s*/, "").replace(/^\*\*(.*?)\*\*$/, "$1").replace(/:$/, "");
}

function isJobDescriptionHeading(line: string) {
  const normalized = jobDescriptionHeadingText(line);

  if (normalized.length > 90 || isJobDescriptionBullet(normalized) || /[.!?]$/.test(normalized)) {
    return false;
  }

  if (/^#{1,6}\s+/.test(line) || /^\*\*.+\*\*$/.test(line)) return true;

  const commonHeadings = new Set([
    "introduction",
    "your role and responsibilities",
    "about the role",
    "what you will do",
    "preferred education",
    "required technical and professional expertise",
    "preferred technical and professional experience",
    "qualifications",
    "responsibilities",
    "requirements",
    "about the job",
    "about us",
    "about you",
    "about the company",
    "what you'll do",
    "what you’ll do",
    "what you'll bring",
    "what you’ll bring",
    "what we offer",
    "who you are",
    "who we are",
    "skills",
    "benefits",
    "preferred qualifications",
    "minimum qualifications",
    "key responsibilities",
    "equal opportunity",
    "hiring process",
    "application process",
  ]);

  if (commonHeadings.has(normalized.toLowerCase())) {
    return true;
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) {
    return false;
  }

  const titleCasedWords = words.filter((word) => /^[A-Z0-9]/.test(word));
  return titleCasedWords.length / words.length >= 0.65;
}
