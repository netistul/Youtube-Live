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

        // Sort channels based on live status
        storedChannels.sort((a, b) => {
          const isLiveA = liveChannels[a[1]];
          const isLiveB = liveChannels[b[1]];
          // Sort in descending order so that "Live" comes before "Not Live"
          return isLiveB - isLiveA;
        });

        statusDiv.innerHTML = "";

        storedChannels.forEach(([channelId, channelName, logoUrl]) => {
          const channelDiv = document.createElement("div");
          channelDiv.className = "channel-info";
          channelDiv.style.cursor = "pointer"; // Change cursor to pointer on hover
          channelDiv.addEventListener("click", function() {
            chrome.tabs.create({ url: `https://www.youtube.com/channel/${channelId}/live` });
          });

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

          // Add hover effect using CSS
          channelDiv.addEventListener("mouseenter", function () {
            channelDiv.classList.add("hovered");
          });

          channelDiv.addEventListener("mouseleave", function () {
            channelDiv.classList.remove("hovered");
          });

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

  // Show search section, hide live channels list and the showSearch button
  showSearchButton.addEventListener("click", function () {
    statusDiv.style.display = "none";
    searchSection.style.display = "block";
    showSearchButton.style.display = "none"; // Hide the showSearch button
  });

  // Back to live channels list and show the showSearch button again
  backButton.addEventListener("click", function () {
    searchSection.style.display = "none";
    statusDiv.style.display = "block";
    showSearchButton.style.display = "block"; // Show the showSearch button
  });

  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const searchResults = document.getElementById("searchResults");
  const loadingSpinner = document.createElement("img");

  // Setup for the loading spinner
  loadingSpinner.src = "css/loading.svg";
  loadingSpinner.id = "loadingSpinner";
  loadingSpinner.style.display = "none";
  document.body.appendChild(loadingSpinner);

  // Setup for debouncing the search input
  let typingTimer;
  const doneTypingInterval = 1000; // 1000ms = 1 second

  // Event listener for the search button click
  searchButton.addEventListener("click", function () {
    const query = searchInput.value;
    if (query) {
      loadingSpinner.style.display = "block";
      searchYouTubeChannels(query);
    }
  });

  // Event listener for keyup on the search input
  searchInput.addEventListener("keyup", function () {
    clearTimeout(typingTimer);
    if (searchInput.value) {
      typingTimer = setTimeout(function () {
        loadingSpinner.style.display = "block";
        searchYouTubeChannels(searchInput.value);
      }, doneTypingInterval);
    }
  });
  searchButton.addEventListener("click", function () {
    const query = searchInput.value;
    if (query) {
      loadingSpinner.style.display = "block"; // Show the loading spinner
      searchYouTubeChannels(query);
    }
  });

  function searchYouTubeChannels(query) {
    // Clear existing search results when a new search starts
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = "";
    let endpoint;
    const maxResults = 5; // Set the number of results per page

    console.log("Query received for search:", query); // Log the received query

    if (isValidYouTubeUrl(query)) {
      const { type, id } = extractYouTubeId(query);

      console.log("Extracted YouTube ID:", id, "Type:", type); // Log the extracted ID and type

      if (type === "video") {
        // Fetch details about the video first
        fetchVideoDetails(id, displayChannelFromVideo);
        return;
      } else if (type === "channel") {
        // Check if the ID looks like a custom name
        if (isLikelyCustomName(id)) {
          // Use search endpoint for custom names
          endpoint = `https://yt.lemnoslife.com/noKey/search?part=id,snippet&type=channel&q=${encodeURIComponent(
            id
          )}&maxResults=${maxResults}`;
        } else {
          // Use channels endpoint for direct channel ID
          endpoint = `https://yt.lemnoslife.com/noKey/channels?id=${id}&part=snippet,contentDetails,statistics&maxResults=${maxResults}`;
        }
      }
    } else {
      // Regular text search for channels
      endpoint = `https://yt.lemnoslife.com/noKey/search?part=id,snippet&type=channel&q=${encodeURIComponent(
        query
      )}&maxResults=${maxResults}`;
    }

    console.log("Constructed API endpoint:", endpoint); // Log the constructed API endpoint

    if (endpoint) {
      performSearch(endpoint);
    } else {
      console.log("No valid endpoint constructed."); // Log when no valid endpoint is constructed
      loadingSpinner.style.display = "none"; // Hide the loading spinner
    }
  }

  function isLikelyCustomName(id) {
    // A simple check to determine if the ID is likely a custom name rather than a numeric ID.
    // YouTube channel IDs are typically 24 characters long and contain a mix of letters (both uppercase and lowercase) and numbers.
    // Custom names are usually shorter and may not follow this pattern.
    const channelIdPattern = /^[a-zA-Z0-9_-]{24}$/;
    return !channelIdPattern.test(id);
  }

  function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    return pattern.test(url);
  }

  function extractYouTubeId(url) {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;

    // Check for channel URLs
    if (pathname.includes("/channel/")) {
      return { type: "channel", id: pathname.split("/channel/")[1] };
    } else if (
      pathname.includes("/c/") ||
      pathname.includes("/user/") ||
      pathname.startsWith("/@")
    ) {
      let channelName = pathname.split("/").pop();
      channelName = channelName.startsWith("@")
        ? channelName.substring(1)
        : channelName;
      return { type: "channel", id: channelName };
    }
    // Check for standard video URL
    else if (searchParams.has("v")) {
      return { type: "video", id: searchParams.get("v") };
    }
    // Check for shortened video URL
    else if (urlObj.host === "youtu.be") {
      return { type: "video", id: pathname.substring(1) }; // Remove the leading '/'
    }

    return { type: null, id: null };
  }

  function performSearch(endpoint) {
    fetch(endpoint)
      .then((response) => response.json())
      .then((data) => {
        console.log("API Response:", data); // Log the response data
        displaySearchResults(data);
        loadingSpinner.style.display = "none"; // Hide the loading spinner when results are ready
      })
      .catch((error) => {
        console.error("Error fetching search results:", error);
        displayErrorMessage(
          "An error occurred while fetching search results. Please try again later."
        );
        loadingSpinner.style.display = "none"; // Hide the spinner

        // Provide a more descriptive error message to the user
        if (error.message === "Failed to fetch") {
          alert(
            "Failed to fetch data. Please check your internet connection and try again."
          );
        } else {
          alert(
            "An error occurred while fetching search results. Please try again later."
          );
        }
      });
  }

  // Event listener for the search button click
  searchButton.addEventListener("click", function () {
    const query = searchInput.value;
    if (query) {
      loadingSpinner.style.display = "block"; // Show the loading spinner
      searchYouTubeChannels(query);
    }
  });

  // Event listener for pressing Enter key in the search input
  searchInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter" || event.keyCode === 13) {
      // Check if Enter was pressed
      event.preventDefault(); // Prevent the default action to avoid form submission
      const query = searchInput.value;
      if (query) {
        loadingSpinner.style.display = "block"; // Show the loading spinner
        searchYouTubeChannels(query);
      }
    }
  });

  function displayErrorMessage(message) {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = ""; // Clear previous results

    const errorMsg = document.createElement("div");
    errorMsg.textContent = message;
    errorMsg.className = "error-message"; // Add a class for styling
    searchResults.appendChild(errorMsg);
  }

  function fetchVideoDetails(videoId, callback) {
    const videoEndpoint = `https://yt.lemnoslife.com/noKey/videos?id=${videoId}&part=snippet`;

    fetch(videoEndpoint)
      .then((response) => response.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          const channelId = data.items[0].snippet.channelId;
          callback(channelId);
        } else {
          throw new Error("No video details found.");
        }
      })
      .catch((error) => {
        console.error("Error fetching video details:", error);
        alert(
          "An error occurred while fetching video details. Please try again later."
        );
        loadingSpinner.style.display = "none"; // Hide the spinner
      });
  }

  function displayChannelFromVideo(channelId) {
    const channelEndpoint = `https://yt.lemnoslife.com/noKey/channels?id=${channelId}&part=snippet,contentDetails,statistics&maxResults=1`;

    fetch(channelEndpoint)
      .then((response) => response.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          const formattedData = {
            items: data.items.map((item) => ({
              id: { kind: "youtube#channel", channelId: item.id },
              snippet: item.snippet,
            })),
          };
          displaySearchResults(formattedData);
        } else {
          throw new Error("No channel details found.");
        }
        loadingSpinner.style.display = "none"; // Hide the loading spinner
      })
      .catch((error) => {
        console.error("Error fetching channel details:", error);
        alert(
          "An error occurred while fetching channel details. Please try again later."
        );
        loadingSpinner.style.display = "none"; // Hide the spinner
      });
  }

  function displaySearchResults(data) {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = ""; // Clear previous results

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
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
    } else {
      // Display a message when no channels are found
      const noResultsMsg = document.createElement("div");
      noResultsMsg.className = "no-results-message"; // Add a class for styling
      noResultsMsg.innerHTML = `
            <p>No channels found. Please try a different search.</p>
            <p class="search-examples">
                E.g.,<br>
                For channel name: <span class="example">MrBeast</span><br>
                Channel link: <span class="example">https://www.youtube.com/@MrBeast</span><br>
                Or a YouTube link from that channel: <span class="example">https://www.youtube.com/watch?v=Wdjh81uH6FU</span>
            </p>
        `;
      searchResults.appendChild(noResultsMsg);
    }
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
        showSearchButton.style.display = "block";

        // Send a message to background.js to check all channels after a delay
        chrome.runtime.sendMessage({
          action: "checkAllChannels",
          fromPopup: true,
        });
      });
    });
  }
});
