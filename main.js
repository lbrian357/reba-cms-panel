const PROXY_URL = "https://gm7aeh9axa.execute-api.us-east-1.amazonaws.com/reba";
const SITE_ID = "5cef42a5323d3a463877056f";
const USERS_COLLECTION_ID = "6782edb1ca16eb93e3bf40b5";

// Main library object
var rebaLib = {
  // --- Profile Page Logic ---
  profilePage: {
    quillInstance: null, // To store the editor instance
    init: function () {
      console.log("Profile page script loaded.");
      // 1. Get the current user's slug from Memberstack
      rebaLib.utils.getMemberSlug(function (slug) {
        if (!slug) {
          rebaLib.utils.showNotification("Could not find Memberstack user slug. Please ensure [data-ms-member='wf-users-slug'] exists and is populated.", true);
          return;
        }
        
        // 2. Fetch profile data from Webflow
        rebaLib.api.fetchUserProfile(slug);

        // 3. Bind the save button
        $("#save-user").on("click", function (e) {
          e.preventDefault();
          rebaLib.profilePage.handleSaveProfile();
        });

        // 4. Bind the profile picture click (for upload)
        $("#profile-pic-preview").on("click", function() {
          rebaLib.profilePage.handleProfilePicUpload();
        });
      });
      
      // Inject required 3rd-party scripts
      rebaLib.utils.injectDependencies();
    },

    /**
     * Fills the profile form with data from Webflow.
     * @param {object} user - The Webflow user item.
     */
    populateForm: function (user) {
      if (!user) {
        rebaLib.utils.showNotification("User data not found.", true);
        return;
      }

      const fieldData = user.fieldData;
      
      // Store the Webflow Item ID on the form for saving later
      $("#wf-form-Edit-User-Form").data("webflow-item-id", user.id);
      
      // --- Populate Text Fields ---
      // These keys are now matched to your JSON response
      $("#user-first-name").val(fieldData["first-name"] || "");
      $("#user-last-name").val(fieldData["last-name"] || "");
      $("#user-company").val(fieldData["company"] || "");
      $("#user-title").val(fieldData["title"] || "");
      $("#user-license-number").val(fieldData["license-number"] || "");
      $("#user-phone").val(fieldData["phone"] || "");
      $("#user-email").val(fieldData["email"] || "");
      $("#user-website").val(fieldData["website"] || "");
      $("#user-address").val(fieldData["address"] || "");
      $("#user-city").val(fieldData["city-state-zip"] || "");
      
      // Wait for Quill to be loaded, then initialize it
      rebaLib.utils.waitForQuill(function() {
          rebaLib.profilePage.quillInstance = rebaLib.utils.initRichTextEditor(
              "user-bio", 
              "Share partner bio or info here...", 
              fieldData["bio"] || ""
          );
      });

      // --- Populate Social Links ---
      $("#user-url-facebook").val(fieldData["url-facebook"] || "");
      $("#user-url-instagram").val(fieldData["url-instagram"] || "");
      $("#user-url-x").val(fieldData["url-x"] || "");
      $("#user-url-youtube").val(fieldData["url-youtube"] || "");
      $("#user-url-linkedin").val(fieldData["url-linkedin"] || "");
      $("#user-url-tiktok").val(fieldData["url-tiktok"] || "");

      // --- Populate Image ---
      if (fieldData["profile-pic"] && fieldData["profile-pic"].url) {
        $("#profile-pic-preview")
          .attr("src", fieldData["profile-pic"].url)
          .removeAttr("srcset");
      }
      
      // TODO: Populate multi-select 'User-Categories'
      // This requires fetching the categories collection and matching IDs.
      // Example: $("#user-categories").val(fieldData["categories"] || []);
    },

    /**
     * Handles the click event for the "Save & Publish" button.
     */
    handleSaveProfile: function () {
      const $button = $("#save-user");
      const originalButtonText = $button.val();
      const itemId = $("#wf-form-Edit-User-Form").data("webflow-item-id");

      if (!itemId) {
        rebaLib.utils.showNotification("Cannot save. User Item ID not found.", true);
        return;
      }

      $button.val("Saving...").prop("disabled", true);

      // --- Collect all data into a Webflow-ready object ---
      // These keys are now matched to your JSON response
      const dataToSave = {
        fieldData: {
          "first-name": $("#user-first-name").val(),
          "last-name": $("#user-last-name").val(),
          "company": $("#user-company").val(),
          "title": $("#user-title").val(),
          "license-number": $("#user-license-number").val(),
          "phone": $("#user-phone").val(),
          "email": $("#user-email").val(),
          "website": $("#user-website").val(),
          "address": $("#user-address").val(),
          "city-state-zip": $("#user-city").val(),
          
          // Get content from Quill instance
          "bio": rebaLib.profilePage.quillInstance 
                 ? rebaLib.utils.cleanQuillHTML(rebaLib.profilePage.quillInstance.root.innerHTML) 
                 : $("#user-bio").val(), // Fallback just in case

          "url-facebook": $("#user-url-facebook").val(),
          "url-instagram": $("#user-url-instagram").val(),
          "url-x": $("#user-url-x").val(),
          "url-youtube": $("#user-url-youtube").val(),
          "url-linkedin": $("#user-url-linkedin").val(),
          "url-tiktok": $("#user-url-tiktok").val(),
          // "categories": $("#user-categories").val() || [], // Example for multi-select
        },
      };

      // DEBUG: Log the data object just before sending it to the API
      console.log("handleSaveProfile: Data object being saved:", dataToSave);

      // --- Handle Image Save ---
      // Get the image URL from the preview. This assumes it was
      // updated by the handleProfilePicUpload function.
      const newImageUrl = $("#profile-pic-preview").data("new-image-url");
      if (newImageUrl) {
        dataToSave.fieldData["profile-pic"] = { url: newImageUrl };
      }

      // --- Send to API ---
      rebaLib.api.updateUserProfile(itemId, dataToSave,
        function (response) {
          // Success
          rebaLib.utils.showNotification("Profile saved successfully!", false);
          $button.val("Saved!").prop("disabled", false);
          
          // Reset button text after a moment
          setTimeout(() => { $button.val(originalButtonText); }, 2000);
          
          // Clear the 'new-image-url' data so it doesn't re-save
          $("#profile-pic-preview").data("new-image-url", null);
        },
        function (error) {
          // Error
          rebaLib.utils.showNotification("Save failed. Please try again.", true);
          console.error("Save error:", error);
          $button.val(originalButtonText).prop("disabled", false);
        }
      );
    },

    /**
     * Handles clicking the profile picture to upload a new one.
     */
    handleProfilePicUpload: function() {
        // This function replaces the complex upload logic from your old script
        // with a simpler, two-step process:
        // 1. Upload the image using Webflow's native asset uploader.
        // 2. Save the *URL* of the uploaded image to the user item.

        const $preview = $("#profile-pic-preview");

        // Create a temporary file input
        const $input = $('<input type="file" accept="image/*" style="display: none;">');
        $("body").append($input);

        $input.on("change", function(e) {
            const file = e.target.files[0];
            if (!file) {
                $input.remove();
                return;
            }

            // Show an optimistic local preview
            const reader = new FileReader();
            reader.onload = function(event) {
                $preview.attr("src", event.target.result);
            }
            reader.readAsDataURL(file);

            rebaLib.utils.showNotification("Uploading image...", false);

            // Upload the file to Webflow Assets
            rebaLib.api.uploadFile(file, 
                function(asset) {
                    // Success!
                    rebaLib.utils.showNotification("Image uploaded. Click 'Save' to apply.", false);
                    
                    // Update the preview with the real Webflow URL
                    $preview.attr("src", asset.url);
                    
                    // Store the new URL to be saved with the profile
                    $preview.data("new-image-url", asset.url);
                },
                function(error) {
                    // Error
                    rebaLib.utils.showNotification("Image upload failed.", true);
                    console.error("Upload error:", error);
                }
            );

            // Clean up the temporary input
            $input.remove();
        });

        $input.click();
    }
  },

  // --- API Calls ---
  api: {
    /**
     * Fetches a single user profile from Webflow using their slug.
     * @param {string} slug - The user's Memberstack slug.
     */
    fetchUserProfile: function (slug) {
      const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USERS_COLLECTION_ID}/items/live?slug=${slug}`;

      $.ajax({
        url: url,
        method: "GET",
        success: function (response) {
          if (response.items && response.items.length > 0) {
            rebaLib.profilePage.populateForm(response.items[0]);
          } else {
            rebaLib.utils.showNotification("Could not find user profile in Webflow.", true);
          }
        },
        error: function (error) {
          rebaLib.utils.showNotification("Error fetching profile.", true);
          console.error("Fetch profile error:", error);
        },
      });
    },

    /**
     * Updates a user's item in Webflow.
     * @param {string} itemId - The Webflow Item ID.
     * @param {object} data - The data object to save.
     * @param {function} onSuccess - Callback on success.
     * @param {function} onError - Callback on error.
     */
    updateUserProfile: function (itemId, data, onSuccess, onError) {
      const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USERS_COLLECTION_ID}/items/${itemId}/live`;

      $.ajax({
        url: url,
        method: "PATCH",
        contentType: "application/json",
        data: JSON.stringify(data),
        success: onSuccess,
        error: onError,
      });
    },

    /**
     * Uploads a file to the Webflow Site's assets.
     * @param {File} file - The file to upload.
     * @param {function} onSuccess - Callback with asset object.
     * @param {function} onError - Callback on error.
     */
    uploadFile: function(file, onSuccess, onError) {
      // This is the correct 2-step upload process from your old main.js
      
      const generateMD5Hash = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsBinaryString(file);
          reader.onload = function () {
            const md5Hash = SparkMD5.hashBinary(reader.result);
            resolve(md5Hash);
          };
          reader.onerror = (error) => reject(error);
        });
      };

      generateMD5Hash(file)
        .then((md5Hash) => {
          // Step 1: Tell Webflow about the file
          $.ajax({
            url: `${PROXY_URL}/https://api.webflow.com/v2/sites/${SITE_ID}/assets`,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            data: JSON.stringify({
              fileHash: md5Hash,
              fileName: file.name,
              contentType: file.type,
              // Using the parentFolder ID from your old script.
              // This is likely the "Backend Uploads" folder.
              parentFolder: "69164778bebb5bda1bf45e85", 
            }),
            success: function (response) {
              // Step 2: Upload the file to the S3 URL Webflow provided
              const formData = new FormData();

              // Add all the upload details from Webflow to the form
              Object.keys(response.uploadDetails).forEach((key) => {
                formData.append(key, response.uploadDetails[key]);
              });

              // Append the actual file
              formData.append("file", file);

              // Upload to S3
              $.ajax({
                url: response.uploadUrl,
                method: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: function () {
                  // Step 3: Success! Return the asset details.
                  onSuccess({
                    id: response.id,
                    url: response.assetUrl || response.hostedUrl,
                  });
                },
                error: function (error) {
                  console.error("Error uploading to S3:", error);
                  if (onError) onError(error);
                },
              });
            },
            error: function (error) {
              console.error("Error getting upload details:", error);
              if (onError) onError(error);
            },
          });
        })
        .catch((error) => {
          console.error("Error generating file hash:", error);
          if (onError) onError(error);
        });
    }
  },

  // --- Utility Functions ---
  utils: {
    /**
     * Waits for Memberstack to load and retrieves the user's slug.
     * @param {function} callback - Function to call with the slug.
     */
    getMemberSlug: function (callback) {
      let attempts = 0;
      const maxAttempts = 50; // Wait 5 seconds
      
      // We look for [data-ms-member='wf-users-slug']
      // *** You must add this element to your page, e.g.:
      // <div data-ms-member="wf-users-slug" style="display:none;"></div>
      const check = setInterval(function () {
        const $slugEl = $("[data-ms-member='wf-users-slug']");
        
        if ($slugEl.length > 0 && $slugEl.text().trim() !== "") {
          clearInterval(check);
          callback($slugEl.text().trim());
        } else if (attempts > maxAttempts) {
          clearInterval(check);
          console.error("Memberstack slug not found.");
          callback(null);
        }
        attempts++;
      }, 100);
    },

    /**
     * Shows a simple notification bar at the top of the page.
     * @param {string} message - The message to display.
     * @param {boolean} isError - True for red, false for green.
     */
    showNotification: function (message, isError) {
      // Remove any existing notification
      $(".reba-notification").remove();

      const color = isError ? "#E57373" : "#81C784";
      const $notification = $(
        '<div class="reba-notification">' + message + "</div>"
      );

      $notification.css({
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        padding: "12px",
        "background-color": color,
        color: "white",
        "text-align": "center",
        "font-size": "16px",
        "z-index": "9999",
        display: "none",
      });

      $("body").append($notification);
      $notification.slideDown(300).delay(3000).slideUp(300, function () {
        $(this).remove();
      });
    },
    
    /**
     * Injects 3rd-party scripts required by the library.
     */
    injectDependencies: function () {
      // SparkMD5 is required for the new upload function
      if (typeof SparkMD5 === 'undefined') {
        const scriptTagForSparkMD5 = '<script src="https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js"></script>';
        $("head").append(scriptTagForSparkMD5);
      }
      
      // Quill Rich Text Editor
      if (typeof Quill === 'undefined') {
        const quillCssLink = '<link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet">';
        const quillJsScript = '<script src="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"></script>';
        $("head").append(quillCssLink);
        $("head").append(quillJsScript);
      }
    },
    
    /**
     * Waits for Quill to be loaded on the page.
     * @param {function} callback - Function to run once Quill is available.
     */
    waitForQuill: function(callback) {
        let attempts = 0;
        const maxAttempts = 100; // Wait 10 seconds
        
        const check = setInterval(function () {
            if (typeof Quill !== 'undefined') {
                clearInterval(check);
                callback();
            } else if (attempts > maxAttempts) {
                clearInterval(check);
                console.error("Quill.js failed to load.");
            }
            attempts++;
        }, 100);
    },
    
    /**
     * Initializes a Quill editor on a specific element.
     * @param {string} editorId - The ID of the textarea to replace.
     * @param {string} placeholder - The placeholder text.
     * @param {string} content - The initial HTML content.
     * @returns {Quill} The Quill instance.
     */
    initRichTextEditor: function (editorId, placeholder, content) {
        // This is the corrected function, modeled on your main.js
        
        // Find the element to replace
        const $editor = $(`#${editorId}`);
        if (!$editor.length) return null;

        // Create the new div with the same ID and existing content
        const $editorDiv = $(`<div id="${editorId}">${content}</div>`);
        
        // Copy classes from the old textarea to the new div
        $editorDiv.attr('class', $editor.attr('class'));
        
        // Replace the textarea with the new div
        $editor.replaceWith($editorDiv);

        const quill = new Quill(`#${editorId}`, {
            modules: {
              toolbar: [["bold", "italic", "underline"]], // Simple toolbar
            },
            placeholder: placeholder,
            theme: "snow",
        });
        
        return quill;
    },
    
    /**
     * Cleans Quill's HTML output for saving to Webflow.
     * @param {string} innerHTML - The innerHTML from quill.root.
     * @returns {string} Cleaned HTML.
     */
    cleanQuillHTML: function (innerHTML) {
      // A simple cleaner. Quill sometimes adds <p><br></p> for empty lines.
      // Webflow rich text fields often prefer just <p> tags.
      if (innerHTML === "<p><br></p>") {
        return "";
      }
      // Remove the cursor span elements from Quill editor innerHTML
      return innerHTML.replace(/<span class="ql-cursor">.*?<\/span>/g, "");
    }
  },
};

// --- Initializer ---
// Runs the script based on the current page.
$(document).ready(function () {
  if (window.location.pathname === "/account/profile") {
    rebaLib.profilePage.init();
  }
  // You can add more pages here in the future
  /*
  else if (window.location.pathname === "/account/dashboard") {
    // rebaLib.dashboardPage.init();
  }
  */
});