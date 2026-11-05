// Path segments come from the URL, so they are checked before they reach the GitHub API.
const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const RUN = /^(\d{1,20}|[ds][0-9a-z]{6,12})$/;

export const isRepoName = (s: string) => NAME.test(s) && s !== '.' && s !== '..';
export const isRunId = (s: string) => RUN.test(s);
