import { defineConfig } from 'vite';

// For user pages (<user>.github.io) use './'; for project pages use the repo slug.
// GITHUB_REPOSITORY is set by GitHub Actions (e.g. 'HyperRamzey/cik').
const repo = process.env.GITHUB_REPOSITORY; // 'owner/repo' or undefined locally
const slug = repo?.split('/')[1];
// User pages (<user>.github.io) deploy at the domain root, not under the slug.
const base = slug ? (slug.toLowerCase().endsWith('.github.io') ? '/' : `/${slug}/`) : './';

export default defineConfig({
  base,
  build: {
    target: 'es2019',
    cssTarget: 'chrome80',
    assetsInlineLimit: 2048,
  },
});
