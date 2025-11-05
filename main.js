const PROXY_URL = "https://gm7aeh9axa.execute-api.us-east-1.amazonaws.com/reba";
const SITE_ID = "5cef42a5323d3a463877056f";
const USERS_COLLECTION_ID = "6782edb1ca16eb93e3bf40b5";

// Main library object
var rebaLib = {
  // --- Profile Page Logic ---
  profilePage: {
    init: function () {
      console.log("Profile page script loaded.");
      // 1. Get the current user's slug from Memberstack
      rebaLib.utils.getMemberSlug(function (slug) {
        if (!slug) {
          rebaLib.utils.showNotification("Could not find Memberstack user slug. Please ensure [data-ms-member='slug'] exists and is populated.", true);
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
      // Note: Webflow field names are case-sensitive and use-kebab-case.
      // These keys are guesses based on your form's input IDs.
      // You may need to adjust them to match your Webflow collection.
      $("#user-first-name").val(fieldData["first-name"] || "");
      $("#user-last-name").val(fieldData["last-name"] || "");
      $("#user-company").val(fieldData["company"] || "");
      $("#user-title").val(fieldData["title"] || "");
      $("#user-license-number").val(fieldData["user-license-number"] || "");
      $("#user-phone").val(fieldData["phone"] || "");
      $("#user-email").val(fieldData["email"] || "");
      $("#user-website").val(fieldData["user-website"] || "");
      $("#user-address").val(fieldData["user-address"] || "");
      $("#user-city").val(fieldData["user-city"] || "");
      $("#user-bio").val(fieldData["user-bio"] || "");

      // --- Populate Social Links ---
      $("#user-url-facebook").val(fieldData["user-url-facebook"] || "");
      $("#user-url-instagram").val(fieldData["user-url-instagram"] || "");
      $("#user-url-x").val(fieldData["user-url-x"] || "");
      $("#user-url-youtube").val(fieldData["user-url-youtube"] || "");
      $("#user-url-linkedin").val(fieldData["user-url-linkedin"] || "");
      $("#user-url-tiktok").val(fieldData["user-url-tiktok"] || "");

      // --- Populate Image ---
      if (fieldData["profile-picture"] && fieldData["profile-picture"].url) {
        $("#profile-pic-preview")
          .attr("src", fieldData["profile-picture"].url)
          .removeAttr("srcset");
      }
      
      // TODO: Populate multi-select 'User-Categories'
      // This requires fetching the categories collection and matching IDs.
      // Example: $("#user-categories").val(fieldData["user-categories"] || []);
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
      // Note: Adjust the keys here to match your Webflow collection schema.
      const dataToSave = {
        fieldData: {
          "first-name": $("#user-first-name").val(),
          "last-name": $("#user-last-name").val(),
          "company": $("#user-company").val(),
          "title": $("#user-title").val(),
          "user-license-number": $("#user-license-number").val(),
          "phone": $("#user-phone").val(),
          "email": $("#user-email").val(),
          "user-website": $("#user-website").val(),
          "user-address": $("#user-address").val(),
          "user-city": $("#user-city").val(),
          "user-bio": $("#user-bio").val(),
          "user-url-facebook": $("#user-url-facebook").val(),
          "user-url-instagram": $("#user-url-instagram").val(),
          "user-url-x": $("#user-url-x").val(),
          "user-url-youtube": $("#user-url-youtube").val(),
          "user-url-linkedin": $("#user-url-linkedin").val(),
          "user-url-tiktok": $("#user-url-tiktok").val(),
          // "user-categories": $("#user-categories").val() || [], // Example for multi-select
        },
      };

      // --- Handle Image Save ---
      // Get the image URL from the preview. This assumes it was
      // updated by the handleProfilePicUpload function.
      const newImageUrl = $("#profile-pic-preview").data("new-image-url");
      if (newImageUrl) {
        dataToSave.fieldData["profile-picture"] = { url: newImageUrl };
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
        // This is a simplified uploader that sends the file directly.
        // Webflow's direct asset API is not public, so we proxy
        // a request to the /v2/sites/{site_id}/assets/upload endpoint.
        
        // This simplified uploader doesn't use MD5 hashing and multipart
        // S3 uploads like your old script. It sends the file directly.
        // This may fail for large files (> 4MB).

        const formData = new FormData();
        formData.append("file", file);
        
        const url = `${PROXY_URL}/https://api.webflow.com/v2/sites/${SITE_ID}/assets/upload`;

        $.ajax({
            url: url,
            method: "POST",
            data: formData,
            processData: false, // Important!
            contentType: false, // Important!
            success: function(response) {
                // The response from this endpoint should be the asset object
                onSuccess(response);
            },
            error: function(error) {
                console.error("Direct upload error:", error);
                // Fallback attempt for large files (not fully implemented)
                if (error.status === 400) {
                   onError("File may be too large. Direct S3 upload not implemented in this simple script.");
                } else {
                   onError(error);
                }
            }
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
      
      // We look for [data-ms-member='slug']
      // *** You must add this element to your page, e.g.:
      // <div data-ms-member="slug" style="display:none;"></div>
      const check = setInterval(function () {
        const $slugEl = $("[data-ms-member='slug']");
        
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
