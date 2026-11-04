// Public links. Set REPEVAL_REPO_URL once the source is on GitHub.
export const REPO_URL = process.env.REPEVAL_REPO_URL ?? 'https://github.com/search?q=repeval&type=repositories';
export const NPM_URL = 'https://www.npmjs.com/package/repeval';
export const APP_INSTALL_URL = `https://github.com/apps/${process.env.GITHUB_APP_SLUG ?? 'repeval'}/installations/new`;
