# Wayback Rescue

A Chrome extension that automatically redirects to the Wayback Machine archive when a page is not found (404) or other errors occur.

## Features

- Automatically detects 404 pages and other error responses
- Handles a comprehensive range of network errors:
  - DNS failures (NXDOMAIN, resolution failures)
  - Timeouts (ERR_TIMED_OUT, connection timeouts)
  - Connection issues (refused, reset, closed)
  - SSL/certificate errors
  - Empty or invalid responses
- Shows user-friendly status messages during the archive search process
- Checks the Internet Archive's Wayback Machine for archived versions
- Tries URL variants (www/non-www, http/https) as fallbacks if the original URL isn't found
- Transparently redirects users to the latest archived version if one exists
- Shows a "not found" message if no archived version exists
- Works across all websites and content types (including PDFs)

## How It Works

The extension uses precise methods to detect error pages, focusing only on specific errors:

1. Monitors specific HTTP status codes:
   - Client errors (401, 403, 404, 408, 423, 429, 451)
   - Server errors (all 5xx status codes)
2. Listens for browser navigation errors (DNS failures, connection refused, etc.)

When an error is detected, the extension:
1. Loads a custom intermediary page with a user-friendly interface
2. Queries the Wayback Machine API to find the most recent archived version of the original URL
3. If no archive is found, tries alternative URL variants (www vs non-www, http vs https)
4. Shows real-time progress as it searches through different URL variants
5. If an archive exists for any variant, it redirects the browser after a confirmation message
6. If no archive is found, it displays a helpful "not found" message with option to return to the original page

## Installation

1. Clone this repository or download the files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the extension directory
5. The extension is now installed and active

## Development

- `manifest.json` - Extension configuration 
- `background.js` - Service worker for detecting errors and handling redirections
- `content.js` - Content script that scans pages for error indicators

## Credits

Uses the [Internet Archive Wayback Machine API](https://archive.org/help/wayback_api.php) to retrieve archived web pages.