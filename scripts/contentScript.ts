import { startProcess } from "./um-timeedit-timetable-toolkit/main";
// import { cleanResult } from "./um-timeedit-timetable-toolkit/cleaner"

var port = chrome.runtime.connect({name: "knocker"});
console.log("Content Script Loaded");

let toggleTurbo = false;

type msg = {
  action: "start" | "PROGRESS_UPDATE";
  maxItemsToFetch: number;
  turboMode: boolean;
}
//On recieve
chrome.runtime.onMessage.addListener(function(msg: msg, sender, sendResponse){
  console.log("The message is ", msg);
  if(msg.action) {
    if(msg.action === "start") {
      // sendResponse({response: `Fetching ${msg.maxItemsToFetch} courses...`})
      msg.turboMode && console.log("Turbo Mode");
      const fileName = startProcess(msg.maxItemsToFetch, msg.turboMode)
      sendResponse({response: "Processing"})
      // cleanResult(fileName);
    } else if (msg.action === "PROGRESS_UPDATE") {
      // Forward the progress update to the extension
      chrome.runtime.sendMessage(msg);
    }
  }

});

chrome.runtime.onSuspend.addListener(function(){
  console.log("Clearning Worker");
  port.disconnect();
});

export {}