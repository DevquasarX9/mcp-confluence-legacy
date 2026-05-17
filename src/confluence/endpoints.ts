export function confluenceApi(path: string): string {
  return `/rest/api${path.startsWith("/") ? path : `/${path}`}`;
}
