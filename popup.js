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

        statusDiv.innerHTML = "<div id='channel-list'></div>"; // Create a new container for channels

        const channelList = document.getElementById("channel-list"); // Get the new container

        storedChannels.forEach(([channelId, channelName, logoUrl]) => {
          const channelDiv = document.createElement("div");
          channelDiv.className = "channel-info";
          channelDiv.classList.add(
            liveChannels[channelName] ? "live" : "not-live"
          );
          channelDiv.style.cursor = "pointer"; // Change cursor to pointer on hover
          channelDiv.addEventListener("click", function () {
            chrome.tabs.create({
              url: `https://www.youtube.com/channel/${channelId}/live`,
            });
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
          const noChannelMsg = document.createElement("p");
          noChannelMsg.textContent = "No YouTube channels added yet.";
          noChannelMsg.style.fontFamily = "Roboto, sans-serif";
          noChannelMsg.style.fontSize = "17px";
          noChannelMsg.style.color = "grey";
          statusDiv.appendChild(noChannelMsg);
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
    // Clear any existing countdown interval
    clearInterval(countdownInterval);

    // Only start the countdown if an API call is going to be made
    if (endpoint) {
      var timeInSeconds = 15;
      updateStatusMessage(
        "Sending request to API endpoint, about " +
        timeInSeconds +
        " seconds remaining..."
      );
      startCountdown(timeInSeconds, document.getElementById("statusMessage"));

      fetch(endpoint)
        .then((response) => {
          if (!response.ok) {
            // If response is not okay, return a custom error
            return response.json().then(errData => {
              throw new Error(errData.error || "Network response was not ok.");
            });
          }
          return response.json();
        })
        .then((data) => {
          console.log("API Response:", data); // Log the response data

          // Check if the response has 'items' and is an array
          if (!data || !data.items || !Array.isArray(data.items)) {
            console.error("Unexpected API response format:", data);
            updateStatusMessage("No valid data received. Try again later.");
            return;
          }

          displaySearchResults(data);
        })
        .catch((error) => {
          console.error("Error fetching search results:", error);

          // Check if the error message indicates unauthorized access
          if (error.message.includes("Unauthorized access")) {
            updateStatusMessage("Unauthorized access. Please use the appropriate Chrome extension.");
          } else if (error.message.includes("Rate limit exceeded")) {
            // Start a 60-second countdown for rate limit errors
            let secondsLeft = 60;
            updateStatusMessage(`Rate limit exceeded. Please try again in ${secondsLeft} seconds.`);

            countdownInterval = setInterval(() => {
              secondsLeft--;
              if (secondsLeft > 0) {
                updateStatusMessage(`Rate limit exceeded. Please try again in ${secondsLeft} seconds.`);
              } else {
                clearInterval(countdownInterval);
                updateStatusMessage("You can now try your search again.");
              }
            }, 1000);
          } else {
            updateStatusMessage("An error occurred: " + error.message + ". Please try again.");
          }
        })
        .finally(() => {
          if (!countdownInterval) {
            clearInterval(countdownInterval);
            updateStatusMessage(""); // Clear the status message
          }
          loadingSpinner.style.display = "none"; // Hide the loading spinner
        });
    } else {
      updateStatusMessage("No valid endpoint constructed.");
      console.log("No valid endpoint constructed."); // Log when no valid endpoint is constructed
      loadingSpinner.style.display = "none"; // Hide the loading spinner
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

    // Clear the status message
    updateStatusMessage("");
  }

  function updateStatusMessage(message) {
    let statusDiv = document.getElementById("statusMessage");

    if (!statusDiv) {
      // Create the status div if it doesn't exist
      statusDiv = document.createElement("div");
      statusDiv.id = "statusMessage";
      statusDiv.style = "color: grey; margin-bottom: 10px;"; // Add your styling here

      // Assuming you have a spinner with the ID 'loadingSpinner'
      const spinner = document.getElementById("loadingSpinner");
      if (spinner) {
        // Insert the statusDiv after the spinner
        spinner.parentNode.insertBefore(statusDiv, spinner.nextSibling);
      } else {
        // Insert the statusDiv at the beginning of the body
        document.body.insertBefore(statusDiv, document.body.firstChild);
      }
    }

    // Update the text content of the statusDiv
    statusDiv.textContent = message;
  }

  var countdownInterval;

  function startCountdown(duration, display) {
    var timer = duration;
    countdownInterval = setInterval(function () {
      var seconds = parseInt(timer % 60, 10);
      display.textContent = "Sending request to API endpoint, about " + seconds + " seconds remaining...";

      if (--timer < 0) {
        clearInterval(countdownInterval);
        // Update the message to indicate that it's taking longer than expected
        display.textContent = "This is taking longer than it should. Just wait or try again...";
      }
    }, 1000);
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
