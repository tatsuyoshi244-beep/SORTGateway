export const APP_NAME = 'SORT Gateway Enterprise';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0';
export const BUILD_SHA =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GITHUB_SHA ??
  process.env.BUILD_SHA ??
  'dev';
export const BUILD_TIME = process.env.BUILD_TIME ?? 'local';
export const NODE_ENV = process.env.NODE_ENV ?? 'development';

export function getBuildInfo() {
  return {
    name: APP_NAME,
    version: APP_VERSION,
    build_sha: BUILD_SHA,
    build_time: BUILD_TIME,
    node_env: NODE_ENV,
  };
}
// Vercel Enterprise deployment 2026-08-23
