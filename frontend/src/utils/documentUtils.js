/**
 * Attaches the current session authentication token to document URLs
 * so that new-tab links and browser downloads can securely pass through
 * object-level authorized file-serving endpoints.
 */
export const getAuthenticatedDocUrl = (url) => {
  if (!url) return '';
  const token = localStorage.getItem('token');
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
};
