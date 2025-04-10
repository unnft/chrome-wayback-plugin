// No longer need content-based error detection - we only use HTTP status codes and network errors

// Only handle about:blank pages for showing search status
window.addEventListener('load', () => {
  // Special handling for about:blank - check if we're in a Wayback search flow
  if (window.location.href === 'about:blank') {
    // Check if we have state in local storage
    chrome.storage.local.get('waybackRescueSearch', (result) => {
      if (result.waybackRescueSearch) {
        const state = result.waybackRescueSearch;
        
        // Only process state if it's recent (less than 30 seconds old)
        const isRecent = (Date.now() - state.timestamp) < 30000;
        
        if (isRecent) {
          // Show appropriate message based on status
          if (state.status === 'searching') {
            if (state.currentVariant) {
              showWaybackStatusOverlay(`
                <h2>Looking for archived versions...</h2>
                <p>Trying URL variant:<br><strong>${state.currentVariant}</strong></p>
              `, true);
            } else {
              showWaybackStatusOverlay(`
                <h2>Looking for archived versions...</h2>
                <p>Searching for archived versions of:<br><strong>${state.originalUrl}</strong></p>
              `, true);
            }
          } else if (state.status === 'found') {
            showWaybackStatusOverlay(`
              <h2>Archive found!</h2>
              <p>Found an archived version of:<br><strong>${state.foundVariant || state.originalUrl}</strong></p>
              <p>Redirecting in a moment...</p>
            `, true, 1500);
          } else if (state.status === 'notFound') {
            showWaybackStatusOverlay(`
              <h2>No Archive Available</h2>
              <p>No archived version was found for:<br><strong>${state.originalUrl}</strong></p>
              <p>The Wayback Machine has not saved any version of this page.</p>
              <p><small>All URL variants (www/non-www, http/https) were checked.</small></p>
            `, false);
          }
        }
      }
    });
  }
  // No longer doing content-based error detection
});

// Function to show the status message overlay
function showWaybackStatusOverlay(messageHtml, isTemporary = false, duration = 10000) {
  // Remove any existing overlay first
  removeWaybackStatusOverlay();
  
  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'wayback-status-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(249, 249, 249, 0.98);
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    font-family: Arial, sans-serif;
    line-height: 1.5;
    text-align: center;
    padding: 2rem;
    box-sizing: border-box;
  `;
  
  // Create content container
  const container = document.createElement('div');
  container.style.cssText = `
    max-width: 600px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 2rem;
  `;
  
  // Add logo
  const logoContainer = document.createElement('div');
  logoContainer.style.cssText = `
    margin-bottom: 1.5rem;
  `;
  logoContainer.innerHTML = `
    <svg width="180" height="35" viewBox="0 0 180 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="35" height="35" rx="4" fill="#1E4273"/>
      <path d="M8 8H28V28H8V8Z" stroke="white" stroke-width="2"/>
      <path d="M7.5 17.5H28.5" stroke="white" stroke-width="1.5"/>
      <text x="17.5" y="25" font-family="Arial" font-size="20" fill="white" text-anchor="middle">W</text>
      <text x="55" y="24" font-family="Arial" font-size="16" font-weight="bold" fill="#1E4273">Wayback Rescue</text>
    </svg>
  `;
  
  // Add message content
  const content = document.createElement('div');
  content.innerHTML = messageHtml;
  content.style.cssText = `
    margin-bottom: 1.5rem;
    color: #333;
  `;
  
  // Add spinner for temporary messages
  if (isTemporary) {
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      border: 3px solid #f3f3f3;
      border-top: 3px solid #1E4273;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      margin: 1rem auto;
      animation: spin 1s linear infinite;
    `;
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    content.appendChild(spinner);
  } else {
    // For permanent messages (like "no archive found"), add a close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
      background-color: #1E4273;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 1rem;
    `;
    closeButton.addEventListener('click', removeWaybackStatusOverlay);
    content.appendChild(closeButton);
  }
  
  // Assemble the overlay
  container.appendChild(logoContainer);
  container.appendChild(content);
  overlay.appendChild(container);
  
  // Add to document
  document.body.appendChild(overlay);
  
  // Set auto-removal for temporary messages
  if (isTemporary && duration > 0) {
    setTimeout(removeWaybackStatusOverlay, duration);
  }
}

// Function to remove the status overlay
function removeWaybackStatusOverlay() {
  const overlay = document.getElementById('wayback-status-overlay');
  if (overlay) {
    overlay.remove();
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // No longer need checkPageStatus handler since we don't detect errors from content
  if (message.action === 'updateSearchState') {
    // Update the UI based on the current search state
    const state = message.state;
    
    if (state.status === 'searching') {
      if (state.currentVariant) {
        showWaybackStatusOverlay(`
          <h2>Looking for archived versions...</h2>
          <p>Trying URL variant:<br><strong>${state.currentVariant}</strong></p>
        `, true);
      } else {
        showWaybackStatusOverlay(`
          <h2>Looking for archived versions...</h2>
          <p>Searching for archived versions of:<br><strong>${state.originalUrl}</strong></p>
        `, true);
      }
    }
  }
  else if (message.action === 'startedArchiveSearch') {
    showWaybackStatusOverlay(`
      <h2>Looking for archived versions...</h2>
      <p>Searching for archived versions of:<br><strong>${message.originalUrl}</strong></p>
    `, true);
  }
  else if (message.action === 'tryingUrlVariant') {
    showWaybackStatusOverlay(`
      <h2>Looking for archived versions...</h2>
      <p>Trying URL variant:<br><strong>${message.currentVariant}</strong></p>
    `, true);
  }
  else if (message.action === 'foundArchive') {
    showWaybackStatusOverlay(`
      <h2>Archive found!</h2>
      <p>Found an archived version of:<br><strong>${message.variantUrl || message.originalUrl}</strong></p>
      <p>Redirecting in a moment...</p>
    `, true, 1500);  // Show for 1.5 seconds before redirect
  }
  else if (message.action === 'noArchiveFound') {
    showWaybackStatusOverlay(`
      <h2>No Archive Available</h2>
      <p>No archived version was found for:<br><strong>${message.originalUrl}</strong></p>
      <p>The Wayback Machine has not saved any version of this page.</p>
      <p><small>All URL variants (www/non-www, http/https) were checked.</small></p>
    `, false);  // Not temporary - will stay until closed
  }
  else if (message.action === 'archiveSearchError') {
    showWaybackStatusOverlay(`
      <h2>Error Searching Archives</h2>
      <p>An error occurred while searching for archived versions.</p>
      <p><small>Error: ${message.error || 'Unknown error'}</small></p>
    `, false);  // Not temporary - will stay until closed
  }
  return true;
});
