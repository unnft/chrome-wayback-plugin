// Get URL parameters to understand what state we're in
const urlParams = new URLSearchParams(window.location.search);
const state = urlParams.get('state');
const originalUrl = urlParams.get('url');
const variantUrl = urlParams.get('variant');
const archivedUrl = urlParams.get('archive');
const errorMessage = urlParams.get('error');

// Initialize UI elements
document.getElementById('original-url').textContent = originalUrl || '';
document.getElementById('found-url').textContent = variantUrl || originalUrl || '';
document.getElementById('not-found-url').textContent = originalUrl || '';
document.getElementById('error-url').textContent = originalUrl || '';
if (errorMessage) {
  document.getElementById('error-message').textContent = errorMessage;
}

// Show the appropriate view based on state
function showView(state) {
  // Hide all views first
  document.getElementById('search-view').classList.add('hidden');
  document.getElementById('found-view').classList.add('hidden');
  document.getElementById('not-found-view').classList.add('hidden');
  document.getElementById('error-view').classList.add('hidden');
  
  // Show the requested view
  if (state === 'searching' || state === 'variant') {
    document.getElementById('search-view').classList.remove('hidden');
    if (state === 'variant' && variantUrl) {
      document.getElementById('variant-message').textContent = `Trying URL variant: ${variantUrl}`;
    }
  } 
  else if (state === 'found') {
    document.getElementById('found-view').classList.remove('hidden');
    // If we found an archive, redirect after a delay
    if (archivedUrl) {
      setTimeout(() => {
        window.location.href = archivedUrl;
      }, 2000);
    }
  }
  else if (state === 'not-found') {
    document.getElementById('not-found-view').classList.remove('hidden');
  }
  else if (state === 'error') {
    document.getElementById('error-view').classList.remove('hidden');
  }
  else {
    // Default to search view
    document.getElementById('search-view').classList.remove('hidden');
  }
}

// Listen for close button clicks
document.getElementById('close-button').addEventListener('click', function() {
  // If the user clicked close, try to go back to the original page
  if (originalUrl) {
    window.location.href = originalUrl;
  } else {
    // If we don't have the original URL, just close the tab
    chrome.runtime.sendMessage({ action: 'closeTab' });
  }
});

document.getElementById('error-close-button').addEventListener('click', function() {
  // If the user clicked close, try to go back to the original page
  if (originalUrl) {
    window.location.href = originalUrl;
  } else {
    // If we don't have the original URL, just close the tab
    chrome.runtime.sendMessage({ action: 'closeTab' });
  }
});

// Handle messages from the background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateState') {
    // Update URL parameters if provided
    if (message.originalUrl) {
      document.getElementById('original-url').textContent = message.originalUrl;
      document.getElementById('not-found-url').textContent = message.originalUrl;
      document.getElementById('error-url').textContent = message.originalUrl;
    }
    
    if (message.variantUrl) {
      document.getElementById('variant-message').textContent = `Trying URL variant: ${message.variantUrl}`;
      document.getElementById('found-url').textContent = message.variantUrl;
    }
    
    // Update the view based on the new state
    showView(message.state);
    
    // If redirecting, update the archived URL
    if (message.state === 'found' && message.archivedUrl) {
      setTimeout(() => {
        window.location.href = message.archivedUrl;
      }, 2000);
    }
  }
});

// Initialize the page
showView(state);