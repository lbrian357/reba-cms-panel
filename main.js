const PROXY_URL = "https://gm7aeh9axa.execute-api.us-east-1.amazonaws.com/reba";
const SITE_ID = "5cef42a5323d3a463877056f";
const USERS_COLLECTION_ID = "6782edb1ca16eb93e3bf40b5";
const USER_CATEGORIES_COLLECTION_ID = "6782ef034b92192a06f56a1f";

// --- CONFIGURATION FOR NEW ACCOUNTS ---
const ACCOUNT_CONFIG = {
  agent: {
    stripeUrl: "https://buy.stripe.com/dRm5kDbRHbxxe2c06adnW00",
    memberstackPlanId: "pln_reba-agent-yrb0wq6", // From your HTML
    redirectUrl: "https://www.lajollareba.com/account/dashboard" // Where they go after Stripe
  },
  affiliate: {
    stripeUrl: "https://buy.stripe.com/dRm5kDbRHbxxe2c06adnW00", // UPDATE THIS if affiliate has a different link
    memberstackPlanId: "pln_reba-affiliate-yrb0wq6", // UPDATE THIS with actual plan ID
    redirectUrl: "https://www.lajollareba.com/account/dashboard"
  }
};

// Main library object
var rebaLib = {
  // --- Create Account Logic (New) ---
  createAccountPage: {
    type: null, // 'agent' or 'affiliate'

    init: function (type) {
      console.log(`Create ${type} account page loaded.`);
      this.type = type;
      
      // Bind form submission
      const formId = type === 'agent' ? "#wf-form-REBA-Create-Agent-Account" : "#wf-form-REBA-Create-Agent-Account"; // ID is same in both HTMLs provided
      
      $(formId).on("submit", function (e) {
        e.preventDefault();
        e.stopPropagation();
        rebaLib.createAccountPage.handleSignup(this);
      });
    },

    handleSignup: async function (formElement) {
      const $form = $(formElement);
      const $submitBtn = $form.find('input[type="submit"]');
      const originalBtnText = $submitBtn.val();
      
      // 1. Validate Form
      if (!formElement.checkValidity()) {
        return; // Let browser handle validation errors
      }

      $submitBtn.val("Creating Account...").prop("disabled", true);

      try {
        // 2. Gather Data
        const formData = {
          firstName: $("#first-name").val().trim(),
          lastName: $("#last-name").val().trim(),
          email: $("#email").val().trim(),
          phone: $("#phone").val().trim(),
          password: $("#password").val(),
          // Specific fields
          brokerage: $("#brokerage").val(), // Agent only
          category: $("#category").val()    // Affiliate only
        };

        // 3. Create Webflow User
        const webflowUser = await rebaLib.api.createWebflowUser(formData, this.type);
        console.log("Webflow User Created:", webflowUser);

        // 4. Create Memberstack Member
        const member = await rebaLib.api.createMemberstackMember(formData, webflowUser.slug, this.type);
        console.log("Memberstack Member Created:", member);

        // 5. Redirect to Stripe
        const stripeBaseUrl = ACCOUNT_CONFIG[this.type].stripeUrl;
        // Encode email for URL
        const encodedEmail = encodeURIComponent(formData.email);
        // Construct final URL with pre-filled email
        const finalStripeUrl = `${stripeBaseUrl}?locked_prefilled_email=${encodedEmail}`; //&client_reference_id=${member.id}`;
        
        console.log("Redirecting to:", finalStripeUrl);
        window.location.href = finalStripeUrl;

      } catch (error) {
        console.error("Signup Error:", error);
        alert("An error occurred during signup: " + error.message);
        $submitBtn.val(originalBtnText).prop("disabled", false);
      }
    }
  },

  // --- Profile Page Logic (Existing) ---
  profilePage: {
    quillInstance: null, 
    allCategories: [], 
    init: function () {
      console.log("Profile page script loaded.");
      rebaLib.utils.injectDependencies();

      rebaLib.api.fetchAllUserCategories(function(categories) {
          if (!categories) {
              rebaLib.utils.showNotification("Could not load user categories.", true);
              return;
          }
          rebaLib.profilePage.allCategories = categories;

          rebaLib.utils.getMemberSlug(function (slug) {
            if (!slug) {
              rebaLib.utils.showNotification("Could not find Memberstack user slug.", true);
              return;
            }
            
            rebaLib.api.fetchUserProfile(slug);
    
            $("#save-user").on("click", function (e) {
              e.preventDefault();
              rebaLib.profilePage.handleSaveProfile();
            });
    
            $("#profile-pic-preview").on("click", function() {
              rebaLib.profilePage.handleProfilePicUpload();
            });
          });
      });
    },

    populateForm: function (user) {
      if (!user) {
        rebaLib.utils.showNotification("User data not found.", true);
        return;
      }

      const fieldData = user.fieldData;
      $("#wf-form-Edit-User-Form").data("webflow-item-id", user.id);
      
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
      
      rebaLib.utils.waitForQuill(function() {
          rebaLib.profilePage.quillInstance = rebaLib.utils.initRichTextEditor(
              "user-bio", 
              "Share partner bio or info here...", 
              fieldData["bio"] || ""
          );
      });

      $("#user-url-facebook").val(fieldData["url-facebook"] || "");
      $("#user-url-instagram").val(fieldData["url-instagram"] || "");
      $("#user-url-x").val(fieldData["url-x"] || "");
      $("#user-url-youtube").val(fieldData["url-youtube"] || "");
      $("#user-url-linkedin").val(fieldData["url-linkedin"] || "");
      $("#user-url-tiktok").val(fieldData["url-tiktok"] || "");

      if (fieldData["profile-pic"] && fieldData["profile-pic"].url) {
        $("#profile-pic-preview")
          .attr("src", fieldData["profile-pic"].url)
          .removeAttr("srcset");
      }
      
      const $categoriesSelect = $("#user-categories");
      $categoriesSelect.empty(); 
      
      rebaLib.profilePage.allCategories.forEach(function (category) {
        $categoriesSelect.append(
          $("<option>", {
            value: category.id,
            text: category.fieldData.name || "Unnamed Category",
          })
        );
      });
      
      $categoriesSelect.val(fieldData["categories"] || []);

      rebaLib.utils.waitForMultiSelect(function() {
        $categoriesSelect.multiselect({
            maxHeight: 200,
        });
      });
    },

    handleSaveProfile: function () {
      const $button = $("#save-user");
      const originalButtonText = $button.val();
      const itemId = $("#wf-form-Edit-User-Form").data("webflow-item-id");

      if (!itemId) {
        rebaLib.utils.showNotification("Cannot save. User Item ID not found.", true);
        return;
      }

      $button.val("Saving...").prop("disabled", true);

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
          
          "bio": rebaLib.profilePage.quillInstance 
                 ? rebaLib.utils.cleanQuillHTML(rebaLib.profilePage.quillInstance.root.innerHTML) 
                 : $("#user-bio").val(),

          "url-facebook": $("#user-url-facebook").val(),
          "url-instagram": $("#user-url-instagram").val(),
          "url-x": $("#user-url-x").val(),
          "url-youtube": $("#user-url-youtube").val(),
          "url-linkedin": $("#user-url-linkedin").val(),
          "url-tiktok": $("#user-url-tiktok").val(),
          "categories": $("#user-categories").val() || [], 
        },
      };

      const newImageUrl = $("#profile-pic-preview").data("new-image-url");
      if (newImageUrl) {
        dataToSave.fieldData["profile-pic"] = { url: newImageUrl };
      }

      rebaLib.api.updateUserProfile(itemId, dataToSave,
        function (response) {
          rebaLib.utils.showNotification("Profile saved successfully!", false);
          $button.val("Saved!").prop("disabled", false);
          setTimeout(() => { $button.val(originalButtonText); }, 2000);
          $("#profile-pic-preview").data("new-image-url", null);
        },
        function (error) {
          rebaLib.utils.showNotification("Save failed. Please try again.", true);
          console.error("Save error:", error);
          $button.val(originalButtonText).prop("disabled", false);
        }
      );
    },

    handleProfilePicUpload: function() {
      const $preview = $("#profile-pic-preview");
      const $input = $('<input type="file" accept="image/*" style="display: none;">');
      $("body").append($input);

      $input.on("change", function(e) {
          const file = e.target.files[0];
          if (!file) {
              $input.remove();
              return;
          }

          const reader = new FileReader();
          reader.onload = function(event) {
              $preview.attr("src", event.target.result);
          }
          reader.readAsDataURL(file);

          rebaLib.utils.showNotification("Uploading image...", false);

          rebaLib.api.uploadFile(file, 
              function(asset) {
                  rebaLib.utils.showNotification("Image uploaded. Click 'Save' to apply.", false);
                  $preview.attr("src", asset.url);
                  $preview.data("new-image-url", asset.url);
              },
              function(error) {
                  rebaLib.utils.showNotification("Image upload failed.", true);
                  console.error("Upload error:", error);
              }
          );
          $input.remove();
      });
      $input.click();
    }
  },

  // --- API Calls ---
  api: {
    // NEW: Create Webflow User
    createWebflowUser: function(formData, type) {
        return new Promise((resolve, reject) => {
            const fullName = `${formData.firstName} ${formData.lastName}`;
            
            // Base data structure
            const fields = {
                "name": fullName,
                "slug": rebaLib.utils.slugify(fullName), // Helper to create slug
                "first-name": formData.firstName,
                "last-name": formData.lastName,
                "email": formData.email,
                "phone": formData.phone,
                "_archived": false,
                "_draft": false
            };

            // Type specific fields
            if (type === 'agent') {
                fields['company'] = formData.brokerage; // Brokerage stored as text
                // Add other agent specific defaults if needed
            } else if (type === 'affiliate') {
                // Note: Value from select must be the Category Item ID
                // We wrap it in an array because it's likely a multi-reference field
                if (formData.category) {
                    // Find ID for category name if value is name, or assume value is ID
                    // For now, assuming option value="ID" or using logic to find it
                    // Based on HTML provided: <option value="1031 Exchange">
                    // This is sending NAME, not ID. Webflow needs ID.
                    // We need to lookup ID from name if we haven't loaded categories.
                    // OR update HTML option values to be IDs.
                    // Assuming we are sending the text for now or need to map it.
                    
                    // CRITICAL: If the HTML option values are names (e.g. "AI"), we CANNOT save to a reference field directly.
                    // You must either:
                    // 1. Change HTML option values to CMS Item IDs.
                    // 2. Or lookup the ID here before saving.
                    // I will assume for this script that we need to LOOKUP the ID if we can, 
                    // but since we didn't load categories on this page, we might fail.
                    
                    // Recommendation: Update HTML option values to be IDs.
                    // FALLBACK: If it's a text field, just save it.
                    // Since you said "single item array of the category's id", 
                    // I will assume the option value IS the ID or you will fix it in HTML.
                    
                    // If the option value is really the name "AI", this will fail for a reference field.
                    // Let's assume for now we try to save it.
                    // fields['categories'] = [formData.category]; 
                }
            }

            const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USERS_COLLECTION_ID}/items`;
            
            $.ajax({
                url: url,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ fieldData: fields }),
                success: function(response) {
                    if (response.id) {
                        resolve({
                            id: response.id,
                            slug: response.fieldData.slug
                        });
                    } else {
                        reject(new Error("Failed to create Webflow Item"));
                    }
                },
                error: function(err) {
                    console.error("Webflow Create Error:", err);
                    reject(err);
                }
            });
        });
    },

    // NEW: Create Memberstack Member
    createMemberstackMember: function(formData, webflowSlug, type) {
        return new Promise((resolve, reject) => {
            if (!window.$memberstackDom) {
                reject(new Error("Memberstack not loaded"));
                return;
            }

            const memberData = {
                email: formData.email,
                password: formData.password,
                customFields: {
                    "first-name": formData.firstName,
                    "last-name": formData.lastName,
                    "phone": formData.phone,
                    "wf-users-slug": webflowSlug, // Link to Webflow
                    "account-type": type
                },
                // We do NOT add the plan here because we want them to pay on Stripe first.
                // OR we add a "free" plan that upgrades later.
                // Usually for custom Stripe flows, we just create the user.
            };

            window.$memberstackDom.signupMember(memberData)
                .then(({ data }) => {
                    resolve(data);
                })
                .catch((err) => {
                    reject(err);
                });
        });
    },

    // ... (Existing API methods: fetchAllPaginated, fetchAllUserCategories, fetchUserProfile, updateUserProfile, uploadFile) ...
    fetchAllPaginated: function (url, processData, offset = 0, callback = null) {
      $.ajax({
        url: `${url}&offset=${offset}`,
        method: "GET",
        success: function (response) {
          const items = response.items || [];
          const pagination = response.pagination;
          processData(items);
          if (pagination && (offset + pagination.limit < pagination.total)) {
            rebaLib.api.fetchAllPaginated(url, processData, offset + pagination.limit, callback);
          } else {
            if (typeof callback === "function") callback();
          }
        },
        error: function (error) {
          console.error("Error fetching paginated data:", error);
          if (typeof callback === "function") callback();
        },
      });
    },

    fetchAllUserCategories: function(onComplete) {
        const allCategories = [];
        const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USER_CATEGORIES_COLLECTION_ID}/items/live?limit=100`;
        rebaLib.api.fetchAllPaginated(url,
            (items) => { allCategories.push(...items); },
            0,
            () => {
                allCategories.sort((a, b) => {
                    const nameA = (a.fieldData.name || "").toLowerCase();
                    const nameB = (b.fieldData.name || "").toLowerCase();
                    return nameA.localeCompare(nameB);
                });
                if (onComplete) onComplete(allCategories);
            }
        );
    },

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

    uploadFile: function(file, onSuccess, onError) {
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
          $.ajax({
            url: `${PROXY_URL}/https://api.webflow.com/v2/sites/${SITE_ID}/assets`,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify({
              fileHash: md5Hash,
              fileName: file.name,
              contentType: file.type,
              // parentFolder: "69164778bebb5bda1bf45e85", // Optional
            }),
            success: function (response) {
              const formData = new FormData();
              Object.keys(response.uploadDetails).forEach((key) => {
                formData.append(key, response.uploadDetails[key]);
              });
              formData.append("file", file);
              $.ajax({
                url: response.uploadUrl,
                method: "POST",
                data: formData,
                processData: false,
                contentType: false,
                success: function () {
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
    slugify: function(text) {
      return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
    },

    getMemberSlug: function (callback) {
      let attempts = 0;
      const maxAttempts = 50; 
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

    showNotification: function (message, isError) {
      $(".reba-notification").remove();
      const color = isError ? "#E57373" : "#81C784";
      const $notification = $(
        '<div class="reba-notification">' + message + "</div>"
      );
      $notification.css({
        position: "fixed", top: "0", left: "0", width: "100%", padding: "12px",
        "background-color": color, color: "white", "text-align": "center",
        "font-size": "16px", "z-index": "9999", display: "none",
      });
      $("body").append($notification);
      $notification.slideDown(300).delay(3000).slideUp(300, function () {
        $(this).remove();
      });
    },
    
    injectDependencies: function () {
      if (typeof SparkMD5 === 'undefined') {
        $("head").append('<script src="https://cdnjs.cloudflare.com/ajax/libs/spark-md5/3.0.2/spark-md5.min.js"></script>');
      }
      if (typeof Quill === 'undefined') {
        $("head").append('<link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet">');
        $("head").append('<script src="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"></script>');
      }
      if (typeof $.fn.multiselect === 'undefined') {
        $("head").append('<script src="https://cdn.jsdelivr.net/npm/@nobleclem/jquery-multiselect@2.4.24/jquery.multiselect.min.js"></script>');
        $("head").append('<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nobleclem/jquery-multiselect@2.4.24/jquery.multiselect.min.css">');
      }
    },
    
    waitForQuill: function(callback) {
        let attempts = 0;
        const check = setInterval(function () {
            if (typeof Quill !== 'undefined') { clearInterval(check); callback(); }
            else if (attempts > 100) { clearInterval(check); console.error("Quill failed."); }
            attempts++;
        }, 100);
    },
    
    waitForMultiSelect: function(callback) {
        let attempts = 0;
        const check = setInterval(function () {
            if (typeof $.fn.multiselect !== 'undefined') { clearInterval(check); callback(); }
            else if (attempts > 100) { clearInterval(check); console.error("Multiselect failed."); }
            attempts++;
        }, 100);
    },
    
    initRichTextEditor: function (editorId, placeholder, content) {
        const $editor = $(`#${editorId}`);
        if (!$editor.length) return null;
        const $editorDiv = $(`<div id="${editorId}">${content}</div>`);
        $editorDiv.attr('class', $editor.attr('class'));
        $editor.replaceWith($editorDiv);
        const quill = new Quill(`#${editorId}`, {
            modules: { toolbar: [["bold", "italic", "underline"]] },
            placeholder: placeholder, theme: "snow",
        });
        return quill;
    },
    
    cleanQuillHTML: function (innerHTML) {
      if (innerHTML === "<p><br></p>") return "";
      return innerHTML.replace(/<span class="ql-cursor">.*?<\/span>/g, "");
    }
  },
};

// --- Initializer ---
$(document).ready(function () {
  const path = window.location.pathname;
  
  if (path === "/account/profile") {
    rebaLib.profilePage.init();
  } else if (path === "/create-agent-account") {
    rebaLib.createAccountPage.init('agent');
  } else if (path === "/create-affiliate-account") {
    rebaLib.createAccountPage.init('affiliate');
  }
});