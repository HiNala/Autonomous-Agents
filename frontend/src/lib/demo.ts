const DEMO_REPOS = [
  "https://github.com/digitalstudiolabs/demo-vulnerable-app",
  "https://github.com/HiNala/demo-vulnerable-app",
];

export function isDemoRepo(url: string): boolean {
  return DEMO_REPOS.some((demo) =>
    url.replace(/\/+$/, "").toLowerCase() === demo.toLowerCase()
  );
}

export function extractRepoName(url: string): string {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  return match?.[1]?.replace(/\.git$/, "") ?? url;
}
