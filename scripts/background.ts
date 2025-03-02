console.log("Service worker is running")

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.startsWith('https://cloud.timeedit.net/my_um/web/students/')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['js/contentScript.bundle.js']
    }).then(() => {
      console.log("Content script injected successfully");
      // Show a popup message
      chrome.scripting.insertCSS({
        target: { tabId: tabId },
        css: '.timeedit-extension-popup { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); background-color:rgb(158, 110, 255); border: 1px solid #ccc; padding: 10px; z-index: 1000; }'
      });
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const popup = document.createElement('div');
          popup.className = 'timeedit-extension-popup';
          popup.textContent = 'UM-timetable Toolkit Extension Loaded!';
          document.body.appendChild(popup);
          setTimeout(() => {
            popup.remove();
          }, 3000); // Remove after 3 seconds
        }
      });
    }).catch(error => {
      console.error("Failed to inject content script:", error);
    });
  } else {
    console.log("Not on the correct URL, content script will not be injected.");
  }
});

export {}