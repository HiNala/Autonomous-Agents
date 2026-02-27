export function scoreToGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

export function gradeToScore(grade: string): number {
  const map: Record<string, number> = {
    "A+": 97, A: 93, "A-": 90,
    "B+": 87, B: 83, "B-": 80,
    "C+": 77, C: 73, "C-": 70,
    "D+": 67, D: 63, "D-": 60,
    F: 50,
  };
  return map[grade] ?? 50;
}

export function gradeColor(letterGrade: string): string {
  const score = gradeToScore(letterGrade);
  if (score >= 90) return "var(--color-healthy)";
  if (score >= 70) return "var(--color-warning)";
  return "var(--color-critical)";
}
