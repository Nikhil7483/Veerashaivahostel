/**
 * Centralized Date & Time formatting utilities for Veerashaiva Lingayath Boys Hostel
 * Ensures consistent 'dd/mm/yyyy' formatting across all screens.
 */

/**
 * Formats an ISO date string (e.g. '2026-09-18'), Date object, or timestamp
 * into 'dd/mm/yyyy' (e.g. '18/09/2026').
 * 
 * Safely avoids JavaScript timezone shift bugs by directly extracting
 * year, month, and day components from ISO string formats.
 * 
 * @param {string | Date | number | null | undefined} val - Date to format
 * @param {string} [fallback=''] - String returned if val is missing or invalid
 * @returns {string} Formatted date in dd/mm/yyyy format
 */
export function formatDate(val, fallback = '') {
  if (!val) return fallback;

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return fallback;
    const day = String(val.getDate()).padStart(2, '0');
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const year = val.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const str = String(val).trim();
  if (!str) return fallback;

  // Case 1: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // Case 2: Already DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${day}/${month}/${year}`;
  }

  // Case 3: Parseable standard date string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
}

/**
 * Formats an ISO datetime string or Date into 'dd/mm/yyyy, hh:mm A'
 * e.g. '18/09/2026, 08:30 AM'
 * 
 * @param {string | Date | number | null | undefined} val - Datetime to format
 * @param {string} [fallback=''] - String returned if val is missing or invalid
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(val, fallback = '') {
  if (!val) return fallback;

  let d;
  if (val instanceof Date) {
    d = val;
  } else {
    // Replace space with T if needed for consistent ISO parsing
    const str = String(val).trim();
    if (!str) return fallback;
    
    // If it's just a date YYYY-MM-DD without time, return formatDate
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
      return formatDate(str, fallback);
    }
    
    d = new Date(str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str);
  }

  if (isNaN(d.getTime())) {
    return formatDate(val, fallback);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
}

/**
 * Formats a date range into 'dd/mm/yyyy → dd/mm/yyyy'
 * 
 * @param {string | Date} fromDate 
 * @param {string | Date} toDate 
 * @param {string} [fallback=''] 
 * @returns {string}
 */
export function formatDateRange(fromDate, toDate, fallback = '') {
  if (!fromDate && !toDate) return fallback;
  const fromFormatted = formatDate(fromDate, 'N/A');
  const toFormatted = formatDate(toDate, 'N/A');
  return `${fromFormatted} → ${toFormatted}`;
}

/**
 * Returns today's date formatted as dd/mm/yyyy
 * @returns {string}
 */
export function getTodayFormatted() {
  return formatDate(new Date());
}
