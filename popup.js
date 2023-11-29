document.addEventListener("DOMContentLoaded", function () {
  const statusDiv = document.getElementById("status");
  const searchSection = document.getElementById("searchSection");
  const showSearchButton = document.getElementById("showSearch");
  const backButton = document.getElementById("backButton");

  // Function to refresh the live channels list
  function refreshLiveChannels() {
    chrome.storage.local.get(
      ["liveChannels", "yt_live_channels_id"],
      function (result) {
        const liveChannels = result.liveChannels || {};
        const storedChannels = result.yt_live_channels_id || [];

        statusDiv.innerHTML = "";

        storedChannels.forEach(([channelId, channelName, logoUrl]) => {
          const channelDiv = document.createElement("div");
          channelDiv.className = "channel-info";

          const logo = document.createElement("img");
          logo.src = logoUrl;
          logo.alt = `${channelName} Logo`;
          logo.className = "channel-logo";

          const name = document.createElement("span");
          name.textContent = channelName;
          name.className = "channel-name";

          const liveStatus = document.createElement("span");
          liveStatus.textContent = liveChannels[channelName]
            ? "Live"
            : "Not Live";
          liveStatus.className = liveChannels[channelName]
            ? "live-status live"
            : "live-status not-live";

          channelDiv.appendChild(logo);
          channelDiv.appendChild(name);
          channelDiv.appendChild(liveStatus);

          statusDiv.appendChild(channelDiv);
        });
      }
    );
  }

  // Initial call to load live channels list
  refreshLiveChannels();

  // messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkComplete") {
      // Refresh the content or popup
      refreshLiveChannels(); // Call this function to refresh the display
    }
  });

  // Show search section and hide live channels list
  showSearchButton.addEventListener("click", function () {
    statusDiv.style.display = "none";
    searchSection.style.display = "block";
  });

  // Back to live channels list
  backButton.addEventListener("click", function () {
    searchSection.style.display = "none";
    statusDiv.style.display = "block";
  });
  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const searchResults = document.getElementById("searchResults");

  searchButton.addEventListener("click", function () {
    const query = searchInput.value;
    if (query) {
      searchYouTubeChannels(query);
    }
  });

  function searchYouTubeChannels(query) {
    const endpoint = `https://yt.lemnoslife.com/noKey/search?part=id,snippet&q=${encodeURIComponent(
      query
    )}`;

    fetch(endpoint)
      .then((response) => response.json())
      .then((data) => {
        console.log("API Response:", data); // Log the response data
        displaySearchResults(data);
      })
      .catch((error) => {
        console.error("Error fetching search results:", error);
      });
  }

  function displaySearchResults(data) {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = ""; // Clear previous results

    data.items.forEach((item) => {
      if (item.id.kind === "youtube#channel") {
        const div = document.createElement("div");
        div.className = "search-result-item";

        // Thumbnail (Channel Logo)
        const thumbnail = document.createElement("img");
        thumbnail.src = item.snippet.thumbnails.default.url;
        thumbnail.alt = "Channel Logo";
        thumbnail.className = "search-result-channel-logo";

        // Channel Title
        const title = document.createElement("h3");
        title.textContent = item.snippet.title;

        // Plus Button
        const addButton = document.createElement("button");
        addButton.textContent = "+";
        addButton.className = "add-channel-button";
        addButton.onclick = () =>
          addChannelToLocal(
            item.id.channelId,
            item.snippet.title,
            thumbnail.src
          );

        // Append elements to the div
        div.appendChild(thumbnail);
        div.appendChild(title);
        div.appendChild(addButton);

        // Append the div to the search results container
        searchResults.appendChild(div);
      }
    });
  }

  // Function to add channel to local storage
  function addChannelToLocal(channelId, channelName, logoUrl) {
    chrome.storage.local.get(["yt_live_channels_id"], function (result) {
      let channels = result.yt_live_channels_id || [];
      channels.push([channelId, channelName, logoUrl]);
      chrome.storage.local.set({ yt_live_channels_id: channels }, function () {
        console.log(`Channel ${channelName} added to live check list.`);
        refreshLiveChannels(); // Refresh the list after adding a channel

        // Redirect back to the main menu (live channels list)
        searchSection.style.display = "none";
        statusDiv.style.display = "block";

        // Send a message to background.js to check all channels after a delay
          chrome.runtime.sendMessage({ action: "checkAllChannels", fromPopup: true });  
      });
    });
  }
});
