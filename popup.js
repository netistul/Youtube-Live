document.addEventListener("DOMContentLoaded", function () {
  const showSearchButton = document.getElementById("showSearch");
  const backButton = document.getElementById("backButton");
  const searchSection = document.getElementById("searchSection");
  const statusDiv = document.getElementById("status");
  const searchContainer = document.querySelector(".searchContainer");
  const headerTitle = document.getElementById("headerTitle");

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

        statusDiv.innerHTML = "<div id='channel-list'></div>"; // Create a new container for channels

        const channelList = document.getElementById("channel-list"); // Get the new container

        storedChannels.forEach(([channelId, channelName, logoUrl]) => {
          const channelDiv = document.createElement("div");
          channelDiv.className = "channel-info";
          channelDiv.classList.add(liveChannels[channelName] ? "live" : "not-live");

          const logo = document.createElement("img");
          logo.src = logoUrl;
          logo.alt = `${channelName} Logo`;
          logo.className = "channel-logo";

          // Add error handler for avatar
          logo.onerror = function () {
            console.log(`Avatar loading failed for ${channelName}, attempting to refresh...`);
            refreshChannelAvatar(channelId)
              .then(newUrl => {
                console.log(`Got new URL for ${channelName}:`, newUrl);
                logo.src = newUrl;
              })
              .catch(error => {
                console.error('Error refreshing avatar:', error);
              });
          };
          channelDiv.style.cursor = "pointer"; // Change cursor to pointer on hover
          channelDiv.addEventListener("click", function () {
            chrome.tabs.create({
              url: `https://www.youtube.com/channel/${channelId}/live`,
            });
          });

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

          channelList.appendChild(channelDiv); // Append each channel to the channel-list container

          channelDiv.addEventListener(
            "contextmenu",
            function (event) {
              event.preventDefault(); // Prevent the default context menu
              showContextMenu(event.pageX, event.pageY, channelId);
              return false;
            },
            false
          );
        });

        // Check if no channels were added and display the message
        if (storedChannels.length === 0) {
          const noChannelContainer = document.createElement("div");
          noChannelContainer.className = "empty-state-container";

          // Add a YouTube icon for visual appeal
          const icon = document.createElement("div");
          icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>';
          icon.className = "empty-state-icon";

          const addInstructionMsg = document.createElement("p");
          addInstructionMsg.textContent = "Click the + button in the top right corner to add channels";
          addInstructionMsg.className = "empty-state-primary";

          const noChannelMsg = document.createElement("p");
          noChannelMsg.textContent = "No YouTube channels added yet.";
          noChannelMsg.className = "empty-state-secondary";

          noChannelContainer.appendChild(icon);
          noChannelContainer.appendChild(addInstructionMsg);
          noChannelContainer.appendChild(noChannelMsg);

          statusDiv.innerHTML = ""; // Clear the status div
          statusDiv.appendChild(noChannelContainer);
        }

        function showContextMenu(x, y, channelId) {
          const contextMenu = document.getElementById("customContextMenu");
          const menuWidth = contextMenu.offsetWidth;
          const menuHeight = contextMenu.offsetHeight;
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;

          // Adjust if the menu goes off the right side of the window
          if (x + menuWidth > windowWidth) {
            x = windowWidth - menuWidth;
          }

          // Adjust if the menu goes off the bottom of the window
          if (y + menuHeight > windowHeight) {
            y = windowHeight - menuHeight;
          }

          contextMenu.style.top = y + "px";
          contextMenu.style.left = x + "px";
          contextMenu.style.display = "block";

          const deleteOption = document.getElementById("deleteChannel");
          deleteOption.onclick = function () {
            deleteChannel(channelId);
          };
        }
      }
    );
  }


  function deleteChannel(channelId) {
    // Access local storage and remove the channel
    chrome.storage.local.get(["yt_live_channels_id"], function (result) {
      let channels = result.yt_live_channels_id || [];
      channels = channels.filter((channel) => channel[0] !== channelId);
      chrome.storage.local.set({ yt_live_channels_id: channels }, function () {
        console.log(`Channel ${channelId} deleted.`);
        // Refresh the list or take any other necessary action
        refreshLiveChannels();
      });
    });

    // Hide the context menu
    document.getElementById("customContextMenu").style.display = "none";
  }

  document.addEventListener("click", function (event) {
    document.getElementById("customContextMenu").style.display = "none";
  });

  // Listen for messages about login/consent issues
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "loginRequired") {
      // Display a detailed message in the popup UI using CSS classes
      statusDiv.innerHTML = `
      <p class='login-required-message'>
        You need to be logged into YouTube or accept cookies to check live status.
      </p>
      <p class='login-required-instruction'>Go to youtube.com and login in.</p>
      <p class='login-required-instruction'>
        This extension can't check the live status of any channel if you aren't logged in on the YouTube website.
      </p>
    `;
    }
  });

  // Initial call to load live channels list
  refreshLiveChannels();

  // messages from background.js
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkComplete") {
      updateStatusMessage("", PRIORITY.LOW); // Clear any existing status messages
      refreshLiveChannels(); // Refresh the display
    }
  });

  // Show search container in header, hide live channels list and title
  showSearchButton.addEventListener("click", function () {
    statusDiv.style.display = "none";
    searchSection.style.display = "block";
    showSearchButton.style.display = "none"; // Hide the showSearch button
    searchContainer.style.display = "flex"; // Show search container in header
    headerTitle.style.display = "none"; // Hide the "YouTube Live" title
    backButton.style.display = "block"; // Show the back button in header
  });

  // Back to live channels list, hide search container, show title
  backButton.addEventListener("click", function () {
    searchSection.style.display = "none";
    statusDiv.style.display = "block";
    showSearchButton.style.display = "block"; // Show the showSearch button
    searchContainer.style.display = "none"; // Hide search container in header
    headerTitle.style.display = "block"; // Show the "YouTube Live" title
    backButton.style.display = "none"; // Hide the back button
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
  const doneTypingInterval = 1400; // 1400ms = 1.4 seconds

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
    const maxResults = 15; // Set the number of results per page

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
          endpoint = `http://51.38.179.70:5110/youtube/search?part=snippet&type=channel&q=${encodeURIComponent(id)}&maxResults=${maxResults}`;
        } else {
          // Use channels endpoint for direct channel ID
          endpoint = `http://51.38.179.70:5110/channels?id=${id}&part=snippet,contentDetails,statistics&maxResults=${maxResults}`;
          updateStatusMessage("Constructed API endpoint for text search.");
        }
      }
    } else {
      // Regular text search for channels
      endpoint = `http://51.38.179.70:5110/youtube/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    }

    console.log("Constructed API endpoint:", endpoint); // Log the constructed API endpoint

    if (!endpoint) {
      updateStatusMessage("Failed to construct a valid API endpoint.");
      return;
    }

    // Perform the search
    performSearch(endpoint);
    updateStatusMessage("");
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
    clearGlobalTimer();
    currentMessagePriority = PRIORITY.LOW;

    if (endpoint) {
      const stopCountdown = startCountdown(15, "Sending request to API endpoint, about", PRIORITY.LOW, "remaining");
      loadingSpinner.style.display = "block";

      fetch(endpoint)
        .then((response) => {
          if (!response.ok) {
            return response.json().then(errData => {
              throw new Error(errData.error || "Network response was not ok.");
            });
          }
          return response.json();
        })
        .then((data) => {
          console.log("API Response:", data);
          stopCountdown(); // Stop the countdown when we receive a response
          if (!data || !data.items || !Array.isArray(data.items)) {
            console.error("Unexpected API response format:", data);
            updateStatusMessage("No valid data received. Try again later.", PRIORITY.HIGH);
            return;
          }
          displaySearchResults(data);
        })
        .catch((error) => {
          console.error("Error fetching search results:", error);
          stopCountdown(); // Stop the countdown on error

          if (error.message.includes("Unauthorized access")) {
            updateStatusMessage("Unauthorized access. Please use the appropriate Chrome extension.", PRIORITY.HIGH);
          } else if (error.message.includes("Rate limit exceeded")) {
            startCountdown(60, "Rate limit exceeded. Please try again in", PRIORITY.HIGH, "", "Rate limit expired. You can now try your search again.");
          } else {
            updateStatusMessage("YouTube API error: " + error.message +
              ".<br/><br/>Try adding the YouTube channel ID or any video link from that channel directly here; it might work.", PRIORITY.HIGH);
          }
        })
        .finally(() => {
          loadingSpinner.style.display = "none";
        });
    } else {
      updateStatusMessage("No valid endpoint constructed.", PRIORITY.MEDIUM);
      console.log("No valid endpoint constructed.");
      loadingSpinner.style.display = "none";
    }
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

  function fetchVideoDetails(videoId, callback) {
    const videoEndpoint = `http://51.38.179.70:5110/videos?id=${videoId}&part=snippet`;

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
    const channelEndpoint = `http://51.38.179.70:5110/channels?id=${channelId}&part=snippet,contentDetails,statistics&maxResults=1`;

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

  // Function to handle avatar refresh
  async function refreshChannelAvatar(channelId) {
    try {
      // Fetch new avatar URL from API
      const endpoint = `http://51.38.179.70:5110/channels?id=${channelId}&part=snippet`;
      const response = await fetch(endpoint);
      const data = await response.json();

      // Validate API response
      if (!data.items?.[0]?.snippet?.thumbnails?.default?.url) {
        throw new Error('No avatar URL found in API response');
      }

      const newAvatarURL = data.items[0].snippet.thumbnails.default.url;

      // Get current channels from storage
      const result = await chrome.storage.local.get(['yt_live_channels_id']);
      let channels = result.yt_live_channels_id || [];

      // Update the avatar URL for the matching channel
      channels = channels.map(channel =>
        channel[0] === channelId ? [channel[0], channel[1], newAvatarURL] : channel
      );

      // Save updated channels back to storage
      await chrome.storage.local.set({ 'yt_live_channels_id': channels });

      console.log(`Successfully refreshed avatar for channel ${channelId}`);
      return newAvatarURL;

    } catch (error) {
      console.error('Error refreshing channel avatar:', error);
      throw new Error(`Failed to refresh avatar: ${error.message}`);
    }
  }

  let lastStatusMessage = ""; // Variable to track the last status message

  // Global variables
  let currentMessagePriority = 0;
  let globalTimer = null;
  const PRIORITY = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2
  };

  // Updated updateStatusMessage function to use a notification popup
  function updateStatusMessage(message, priority = PRIORITY.LOW, duration = 0) {
    // Only update if the new message has higher or equal priority
    if (priority >= currentMessagePriority) {
      currentMessagePriority = priority;

      // Remove any existing notifications
      const existingNotification = document.querySelector('.notification-popup');
      if (existingNotification) {
        existingNotification.remove();
      }

      if (!message) return; // If empty message, just remove existing notification

      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'notification-popup';

      // Set notification style based on priority
      if (priority === PRIORITY.HIGH) {
        notification.classList.add('notification-error');
      } else if (priority === PRIORITY.MEDIUM) {
        notification.classList.add('notification-success');
      } else {
        notification.classList.add('notification-info');
      }

      notification.innerHTML = message;

      // Add to document
      document.body.appendChild(notification);

      // Clear the message after the specified duration
      if (duration > 0) {
        setTimeout(() => {
          if (currentMessagePriority === priority) {
            notification.style.opacity = '0';
            setTimeout(() => {
              notification.remove();
              currentMessagePriority = 0;
            }, 300); // Allow time for fade out animation
          }
        }, duration * 1000);
      }
    }
  }

  function clearGlobalTimer() {
    if (globalTimer) {
      clearTimeout(globalTimer);
      globalTimer = null;
    }
  }

  function startCountdown(duration, message, priority, suffix = "", finalMessage = "") {
    clearGlobalTimer();
    let timer = duration;

    function updateCountdown() {
      if (timer > 0) {
        const suffixText = suffix ? ` ${suffix}` : "";
        updateStatusMessage(`${message} ${timer} seconds${suffixText}...`, priority);
        timer--;
        globalTimer = setTimeout(updateCountdown, 1000);
      } else {
        updateStatusMessage(finalMessage || "", priority);
        clearGlobalTimer();
      }
    }

    updateCountdown();

    // Return a function to stop the countdown
    return function stopCountdown() {
      clearGlobalTimer();
      updateStatusMessage("", priority);
    };
  }

  function displaySearchResults(data) {
    const searchResults = document.getElementById("searchResults");
    searchResults.innerHTML = ""; // Clear previous results

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      data.items.forEach((item) => {
        if (item.id && item.id.kind === "youtube#channel") {
          // Handle channel search result
          const div = document.createElement("div");
          div.className = "search-result-item";

          // Thumbnail (Channel Logo)
          const thumbnail = document.createElement("img");
          thumbnail.src = item.snippet.thumbnails.default.url;
          thumbnail.alt = "Channel Logo";
          thumbnail.className = "search-result-channel-logo";

          // Channel Info (Name and Description)
          const infoDiv = document.createElement("div");
          const title = document.createElement("h3");
          title.textContent = item.snippet.title;
          const description = document.createElement("p");
          description.textContent =
            item.snippet.description || "No description available.";

          infoDiv.appendChild(title);
          infoDiv.appendChild(description);

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
          div.appendChild(infoDiv);
          div.appendChild(addButton);

          // Append the div to the search results container
          searchResults.appendChild(div);
        }
      });
    } else {
      // Display a message when no results are found
      const noResultsMsg = document.createElement("div");
      noResultsMsg.className = "no-results-message";
      noResultsMsg.innerHTML = `
              <p>No results found. Please try a different search.</p>
              <p class="search-examples">
                  E.g.,<br>
                  For channel name: <span class="example">MrBeast</span><br>
                  Channel link: <span class="example">https://www.youtube.com/@MrBeast</span><br>
                  Or a YouTube link from that channel: <span class="example">https://www.youtube.com/watch?v=Wdjh81uH6FU</span>
              </p>
          `;
      searchResults.appendChild(noResultsMsg);
    }

    // Clear the status message if it was not an error
    if (!lastStatusMessage.includes("error")) {
      updateStatusMessage("");
    }
  }

  // Function to add channel to local storage
  function addChannelToLocal(channelId, channelName, logoUrl) {
    chrome.storage.local.get(["yt_live_channels_id"], function (result) {
      let channels = result.yt_live_channels_id || [];
      channels.push([channelId, channelName, logoUrl]);
      chrome.storage.local.set({ yt_live_channels_id: channels }, function () {
        console.log(`Channel ${channelName} added to live check list.`);
        refreshLiveChannels();

        // Clear existing status messages and show success message
        updateStatusMessage(`Channel ${channelName} added successfully!`, PRIORITY.MEDIUM, 3);

        // Redirect back to the main menu (live channels list)
        searchSection.style.display = "none";
        statusDiv.style.display = "block";
        showSearchButton.style.display = "block";

        // Hide search container and show header title
        searchContainer.style.display = "none";
        headerTitle.style.display = "block";
        backButton.style.display = "none";

        // Send a message to background.js to check all channels after a delay
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: "checkAllChannels",
            fromPopup: true,
          });
        }, 1000); // Delay of 1 second
      });
    });
  }
});
