async function checkYouTubeChannelLive(channelId) {
    console.log(`Checking live status for channel ID: ${channelId}`);
  
    try {
      const response = await fetch(`https://www.youtube.com/channel/${channelId}`);
      const html = await response.text();
      const isLive = html.includes("hqdefault_live.jpg");
      console.log(`Channel ID ${channelId} is live: ${isLive}`);
      return isLive;
    } catch (error) {
      console.error("Error checking channel live status:", error);
      return false;
    }
  }
  
  function checkAllChannels(fromPopup = false) {
    console.log("Checking all channels for live status...");
  
    // Get the channel list from local storage
    chrome.storage.local.get(["yt_live_channels_id"], function (result) {
      let storedChannels = result.yt_live_channels_id || [];
      let liveChannels = {};
  
      const checkPromises = storedChannels.map(([id, name]) =>
        checkYouTubeChannelLive(id).then((isLive) => {
          liveChannels[name] = isLive;
        })
      );
  
      // After all channels are checked
      Promise.all(checkPromises).then(() => {
        console.log("Live status of all channels:", liveChannels);
        chrome.storage.local.set({ liveChannels });
  
        // Send a message back to content script/popup to indicate completion, but only if initiated from the popup
        if (fromPopup) {
          chrome.runtime.sendMessage({ action: "checkComplete" });
        }
      });
    });
  }
  
  // Message listener for messages from the popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkAllChannels") {
      checkAllChannels(message.fromPopup); // Check if the message has the 'fromPopup' property
    }
  });

// Setting up the alarm when the extension is installed/started
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("fetchDataAlarm", {
    delayInMinutes: 1, // Start 1 minute after the extension is installed/started
    periodInMinutes: 3, // Repeat every 3 minutes
  });
});

// Setting up the listener from popup.js after a channel was added, to recheck live status
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkAllChannels") {
    console.log("Received message to check all channels.");
    checkAllChannels();
  }
});

// Alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "fetchDataAlarm") {
    console.log("Alarm triggered");
    checkAllChannels();
  }
});

// Initial check
checkAllChannels();
