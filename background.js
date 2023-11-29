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

  function checkAllChannels() {
    console.log("Checking all channels for live status...");
    
    // Get the channel list from local storage
    chrome.storage.local.get(['yt_live_channels_id'], function(result) {
        let storedChannels = result.yt_live_channels_id || [];
        let liveChannels = {};

        const checkPromises = storedChannels.map(([id, name]) =>
            checkYouTubeChannelLive(id).then(isLive => {
                liveChannels[name] = isLive;
            })
        );

        Promise.all(checkPromises).then(() => {
            console.log("Live status of all channels:", liveChannels);
            chrome.storage.local.set({ liveChannels });
        });
    });
}


// Setting up the alarm when the extension is installed/started
chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("fetchDataAlarm", {
        delayInMinutes: 1, // Start 1 minute after the extension is installed/started
        periodInMinutes: 3 // Repeat every 3 minutes
    });
});

// Alarm listener
chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "fetchDataAlarm") {
        console.log("Alarm triggered");
        checkAllChannels();
    }
});

// Initial check
checkAllChannels();
  
