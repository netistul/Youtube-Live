async function checkYouTubeChannelLive(channelId) {
  console.log(`Checking live status for channel ID: ${channelId}`);

  try {
    // Fetch the /live page for the channel
    const response = await fetch(`https://www.youtube.com/channel/${channelId}/live`, { redirect: 'follow' });
    const html = await response.text();

    // Log the response URL in case there is a redirection
    console.log(`Fetched URL: ${response.url}`);

    // Check if the URL indicates a consent or login-required page
    if (response.url.includes("consent.youtube.com")) {
      console.error("User is not logged in or consent not accepted");
      chrome.runtime.sendMessage({ action: "loginRequired" });
      return false;
    }

    // If the response contains "LIVE NOW", it indicates that the stream is currently live
    if (html.includes("LIVE NOW")) {
      console.log(`Channel ID ${channelId} is live: true (reason: found 'LIVE NOW')`);
      return true;
    }

    // Scheduled streams might have "Scheduled for" in the HTML, so check and return false for those
    if (html.includes("Scheduled for")) {
      console.log(`Channel ID ${channelId} is not live: false (reason: found 'Scheduled for')`);
      return false;
    }

    // If not, use regex to extract the canonical URL from the HTML
    const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/);

    if (canonicalMatch && canonicalMatch[1]) {
      const canonicalURL = canonicalMatch[1];
      const isLive = canonicalURL.includes("/watch?v=") && !html.includes("Scheduled for");

      if (isLive) {
        console.log(`Channel ID ${channelId} is live: true (reason: redirected to a live video page and no 'Scheduled for' found)`);
      } else {
        console.log(`Channel ID ${channelId} is not live: false (reason: not redirected to a live video page or 'Scheduled for' was found)`);
      }

      return isLive;
    } else {
      console.error(`Canonical link not found for channel ID ${channelId}`);
      return false;
    }
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
    let liveCount = 0; // Counter for live channels

    const checkPromises = storedChannels.map(([id, name]) =>
      checkYouTubeChannelLive(id).then((isLive) => {
        liveChannels[name] = isLive;
        if (isLive) liveCount++; // Increment live counter if channel is live
      })
    );

    // After all channels are checked
    // After all channels are checked
    Promise.all(checkPromises).then(() => {
      console.log("Live status of all channels:", liveChannels);
      chrome.storage.local.set({ liveChannels });

      // Update the extension badge
      if (liveCount > 0) {
        chrome.action.setBadgeText({ text: liveCount.toString() });
        chrome.action.setBadgeBackgroundColor({ color: "blue" }); // Red background for the badge
      } else {
        chrome.action.setBadgeText({ text: "" }); // Clear the badge if no live channels
      }

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
