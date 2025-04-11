// Wayback Machine API URL
const WAYBACK_API_URL = 'https://archive.org/wayback/available?url=';

// Track URLs that have returned errors
const errorUrls = new Set();

// Listen for HTTP error responses
chrome.webRequest.onCompleted.addListener(
  (details) => {
    // Only process main frame requests
    if (details.type !== 'main_frame') return;
    
    // Define specific HTTP status codes to handle
    const errorStatusCodes = [
      // Client errors we want to handle
      401, // Unauthorized
      403, // Forbidden
      404, // Not Found
      408, // Request Timeout
      410, // Gone
      423, // Locked
      429, // Too Many Requests
      451, // Unavailable For Legal Reasons
      
      // All server errors (500-599)
      500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511,
      520, 521, 522, 523, 524, 525, 526, 527, 530, 598, 599 // Including common CDN error codes
    ];
    
    // Check if the status code is in our list of error codes to handle
    if (errorStatusCodes.includes(details.statusCode)) {
      console.log(`Error detected: ${details.statusCode} for ${details.url}`);
      errorUrls.add(details.url);
      
      // We'll handle the redirect in the navigation completed listener
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for navigation errors (including DNS errors)
chrome.webNavigation.onErrorOccurred.addListener(
  (details) => {
    // Only process main frame requests
    if (details.frameId !== 0) return;
    
    // Check if the URL is already a Wayback Machine URL to prevent loops
    if (details.url.includes('web.archive.org/web/')) return;
    
    const errorCodes = [
      // DNS errors
      'net::ERR_NAME_NOT_RESOLVED',
      'net::ERR_NAME_RESOLUTION_FAILED',
      'net::ERR_DNS_TIMED_OUT',
      
      // Connection errors
      'net::ERR_CONNECTION_REFUSED',
      'net::ERR_CONNECTION_FAILED',
      'net::ERR_CONNECTION_TIMED_OUT',
      'net::ERR_CONNECTION_RESET',
      'net::ERR_CONNECTION_ABORTED',
      'net::ERR_CONNECTION_CLOSED',
      'net::ERR_SOCKET_NOT_CONNECTED',
      'net::ERR_TIMED_OUT',
      
      // Network errors
      'net::ERR_ADDRESS_UNREACHABLE',
      'net::ERR_NETWORK_ACCESS_DENIED',
      
      // SSL/Security errors
      'net::ERR_CERT_COMMON_NAME_INVALID',
      'net::ERR_CERT_DATE_INVALID',
      'net::ERR_CERT_AUTHORITY_INVALID',
      'net::ERR_CERT_INVALID',
      'net::ERR_SSL_PROTOCOL_ERROR',
      
      // Server errors
      'net::ERR_EMPTY_RESPONSE',
      'net::ERR_CONTENT_LENGTH_MISMATCH',
      'net::ERR_RESPONSE_HEADERS_TOO_BIG',
      'net::ERR_INCOMPLETE_CHUNKED_ENCODING',
      
      // Content errors
      'net::ERR_CONTENT_DECODING_FAILED',
      'net::ERR_INVALID_RESPONSE'
    ];
    
    // Check if this is a DNS or connection error
    if (errorCodes.some(code => details.error.includes(code))) {
      console.log(`Navigation error detected: ${details.error} for ${details.url}`);
      
      // Try to find an archived version
      checkWaybackAndRedirect(details.url, details.tabId);
    }
  },
  { urls: ["<all_urls>"] }
);

// Listen for completed web requests - only needed to handle cleanup of errorUrls set
chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only process main frame navigation events (not iframes, etc)
  if (details.frameId !== 0) return;
  
  try {
    // Get the tab to check if it's a 404 or other error
    const tab = await chrome.tabs.get(details.tabId);
    
    // If the URL is already a Wayback Machine URL, don't process to prevent loops
    if (tab.url.includes('web.archive.org/web/')) return;
    
    // Check if this URL had an error response
    const hadErrorResponse = errorUrls.has(tab.url);
    if (hadErrorResponse) {
      errorUrls.delete(tab.url); // Clean up
      await checkWaybackAndRedirect(tab.url, tab.id);
      return;
    }
    
    // We no longer check page content for errors - only rely on HTTP status codes and network errors
  } catch (error) {
    console.error('Error in Wayback Rescue extension:', error);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

// On install, set up content script communication
chrome.runtime.onInstalled.addListener(() => {
  console.log('Wayback Rescue extension installed.');
});

// Event listeners for message passing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle close tab requests from our custom search page
  if (message.action === 'closeTab' && sender.tab) {
    chrome.tabs.remove(sender.tab.id);
  }
  return true;
});

// Function to check Wayback Machine and redirect if needed
async function checkWaybackAndRedirect(url, tabId) {
  try {
    // First, redirect to our custom search page
    const searchUrl = chrome.runtime.getURL('wayback-search.html') + 
                      `?state=searching&url=${encodeURIComponent(url)}`;
    
    await chrome.tabs.update(tabId, { url: searchUrl });
    
    // Wait a moment for the search page to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update the search page to show we're searching
    const searchStatusUrl = chrome.runtime.getURL('wayback-search.html') + 
                      `?state=searching&url=${encodeURIComponent(url)}`;
    
    await chrome.tabs.update(tabId, { url: searchStatusUrl });
    
    // Generate all URL variants to try (including the original URL)
    const variants = [url, ...generateUrlVariants(url)];
    
    // Update the search page to show we're checking multiple variants
    const checkingVariantsUrl = chrome.runtime.getURL('wayback-search.html') + 
                        `?state=variants&url=${encodeURIComponent(url)}` +
                        `&count=${variants.length}`;
    
    await chrome.tabs.update(tabId, { url: checkingVariantsUrl });
    
    // Create an array of promises to check all variants in parallel
    console.log(`Checking ${variants.length} URL variants in parallel`);
    
    // Map each variant to a promise that resolves with the variant and its archived URL (if found)
    const variantChecks = variants.map(async (variant) => {
      try {
        const archived = await findArchivedVersion(variant);
        return { 
          variant, 
          archived,
          found: !!archived 
        };
      } catch (error) {
        console.error(`Error checking variant ${variant}:`, error);
        return { variant, archived: null, found: false };
      }
    });
    
    // Wait for all variant checks to complete
    const results = await Promise.all(variantChecks);
    
    // Find the first successful result (if any)
    const successResult = results.find(result => result.found);
    
    if (successResult) {
      // Found an archive
      console.log(`Found archive for variant: ${successResult.variant}`);
      
      // Update the search page with found state
      const foundUrl = chrome.runtime.getURL('wayback-search.html') + 
                      `?state=found&url=${encodeURIComponent(url)}` +
                      `&variant=${encodeURIComponent(successResult.variant)}` +
                      `&archive=${encodeURIComponent(successResult.archived)}`;
      
      await chrome.tabs.update(tabId, { url: foundUrl });
      
      // Short delay before final redirect to show the "found" message
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to the archived version
      chrome.tabs.update(tabId, { url: successResult.archived });
      console.log(`Redirected to archived version: ${successResult.archived}`);
    } else {
      // No archives found for any variant
      console.log(`No archived version found for any of the ${variants.length} variants tried`);
      
      // If we get here, no archive was found for any variant
      console.log(`No archived version found for any variant of: ${url}`);
      
      // Update the search page with not-found state
      const notFoundUrl = chrome.runtime.getURL('wayback-search.html') + 
                          `?state=not-found&url=${encodeURIComponent(url)}`;
      
      await chrome.tabs.update(tabId, { url: notFoundUrl });
    }
  } catch (error) {
    console.error('Error checking Wayback Machine:', error);
    
    // Show error on our custom page
    try {
      const errorUrl = chrome.runtime.getURL('wayback-search.html') + 
                       `?state=error&url=${encodeURIComponent(url)}` +
                       `&error=${encodeURIComponent(error.message || 'Unknown error')}`;
      
      await chrome.tabs.update(tabId, { url: errorUrl });
    } catch (err) {
      console.log('Could not show error message:', err);
    }
  }
}

// Function to query Wayback Machine API for a specific URL
async function findArchivedVersion(url) {
  try {
    const waybackResponse = await fetch(`${WAYBACK_API_URL}${encodeURIComponent(url)}`);
    const waybackData = await waybackResponse.json();
    
    // Check if an archived version exists
    if (waybackData.archived_snapshots && waybackData.archived_snapshots.closest) {
      return waybackData.archived_snapshots.closest.url;
    }
    
    return null;
  } catch (error) {
    console.error(`Error checking Wayback for ${url}:`, error);
    return null;
  }
}

// Function to generate URL variants to try
function generateUrlVariants(originalUrl) {
  const variants = [];
  
  try {
    // Parse the URL
    const urlObj = new URL(originalUrl);
    const isHttps = urlObj.protocol === 'https:';
    const hasWww = urlObj.hostname.startsWith('www.');
    
    // Create different variants
    if (!hasWww) {
      // Add www. variant with same protocol
      const wwwVariant = new URL(originalUrl);
      wwwVariant.hostname = 'www.' + wwwVariant.hostname;
      variants.push(wwwVariant.href);
    } else {
      // Remove www. variant with same protocol
      const noWwwVariant = new URL(originalUrl);
      noWwwVariant.hostname = noWwwVariant.hostname.substring(4);
      variants.push(noWwwVariant.href);
    }
    
    // Switch protocol variants
    const protocolVariant = new URL(originalUrl);
    protocolVariant.protocol = isHttps ? 'http:' : 'https:';
    variants.push(protocolVariant.href);
    
    // Combined variants (both changing www. and protocol)
    const combinedVariant = new URL(originalUrl);
    combinedVariant.protocol = isHttps ? 'http:' : 'https:';
    
    if (!hasWww) {
      combinedVariant.hostname = 'www.' + combinedVariant.hostname;
    } else {
      combinedVariant.hostname = combinedVariant.hostname.substring(4);
    }
    
    variants.push(combinedVariant.href);
    
    // If the URL is very short (like example.com), also try adding common paths
    if (!urlObj.pathname || urlObj.pathname === '/') {
      const withIndexVariant = new URL(originalUrl);
      withIndexVariant.pathname = '/index.html';
      variants.push(withIndexVariant.href);
      
      const withHomeVariant = new URL(originalUrl);
      withHomeVariant.pathname = '/home';
      variants.push(withHomeVariant.href);
    }
    
  } catch (error) {
    console.error('Error generating URL variants:', error);
  }
  
  return variants;
}