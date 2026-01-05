// --- UPDATED URLS TO MATCH SERVERLESS.YML ---
const PROXY_URL = "https://gm7aeh9axa.execute-api.us-east-1.amazonaws.com/reba/api"; 
const BILLING_PROXY_URL = "https://gm7aeh9axa.execute-api.us-east-1.amazonaws.com/reba"; 

const SITE_ID = "5cef42a5323d3a463877056f";
const USERS_COLLECTION_ID = "6782edb1ca16eb93e3bf40b5";
const USER_CATEGORIES_COLLECTION_ID = "6782ef034b92192a06f56a1f";
const USER_TYPES_COLLECTION_ID = "6898242371de0de33b215c88"; 
const BROKERAGES_COLLECTION_ID = "5d1c4a6720876632e4d52d6f";

// --- USER TYPE IDs ---
const AGENT_TYPE_ID = "6898242a265d27ca0725f430";
const AFFILIATE_TYPE_ID = "689824336c6c8212033ff4bb";

// --- CONFIGURATION FOR NEW ACCOUNTS ---
const ACCOUNT_CONFIG = {
  agent: {
    // stripeUrl: "https://buy.stripe.com/dRm5kDbRHbxxe2c06adnW00", // gabe's buy link
    stripeUrl: "https://buy.stripe.com/6oUdR28Ax00g6j79tJ2B200", // reba's buy link
    memberstackPlanId: "pln_reba-agent-yrb0wq6", 
    redirectUrl: "https://www.lajollareba.com/account/dashboard" 
  },
  affiliate: {
    // stripeUrl: "https://buy.stripe.com/dRm5kDbRHbxxe2c06adnW00",  // gabe's 
    stripeUrl: "https://buy.stripe.com/dRmbIUbMJ3cscHv5dt2B201", // reba's https://buy.stripe.com/dRmbIUbMJ3cscHv5dt2B201
    memberstackPlanId: "pln_reba-affiliate-yrb0wq6",
    redirectUrl: "https://www.lajollareba.com/account/dashboard"
  },
  agentWithOffice: {
    // stripeUrl: "https://buy.stripe.com/dRm5kDbRHbxxe2c06adnW00",  // gabe's
    stripeUrl: "https://buy.stripe.com/4gMcMYcQN4gw0YN9tJ2B202",  // reba's https://buy.stripe.com/4gMcMYcQN4gw0YN9tJ2B202
    memberstackPlanId: "pln_reba-agent-office-yrb0wq6",
    redirectUrl: "https://www.lajollareba.com/account/dashboard"
  }
};

// Main library object
var rebaLib = {
  user: null, // Store current user data here

  // --- Global Initialization (Runs on every page) ---
  globalInit: function() {
      // 1. Initialize Billing Portal Listeners
      rebaLib.billingPortal.init();

      // 2. Fetch Current User Data (if logged in)
      rebaLib.utils.getMemberSlug(function (slug) {
        if (slug) {
          console.log("Member logged in, fetching profile...");
          rebaLib.api.fetchUserProfile(slug);
          
          // 3. Update 'View Profile' button links
          const profileUrl = `https://www.lajollareba.com/user/${slug}`;
          const $viewProfileBtn = $("#view-profile-btn");
          if ($viewProfileBtn.length) {
              $viewProfileBtn.attr("href", profileUrl);
          }
        }
      });
  },
  
  // --- Update Resubscribe Button Logic ---
  updateResubscribeButton: function(user) {
      const $btn = $("#reba-subscribe-btn");
      if ($btn.length === 0 || !user) return;

      const userTypes = user.fieldData['type'] || []; // This is an array of IDs
      let stripeUrl = "#";

      if (userTypes.includes(AFFILIATE_TYPE_ID)) {
          stripeUrl = ACCOUNT_CONFIG.affiliate.stripeUrl;
      } else if (userTypes.includes(AGENT_TYPE_ID)) {
          stripeUrl = ACCOUNT_CONFIG.agent.stripeUrl;
      }

      if (stripeUrl !== "#") {
          // Pre-fill email in Stripe link if available
          const email = user.fieldData['email'];
          if (email) {
              const encodedEmail = encodeURIComponent(email);
              // Also pass the client reference ID (Webflow Item ID)
              stripeUrl = `${stripeUrl}?locked_prefilled_email=${encodedEmail}&client_reference_id=${user.id}`;
          }
          $btn.attr("href", stripeUrl);
          console.log("Updated Resubscribe button URL:", stripeUrl);
      }
  },

  // --- Billing Portal Logic ---
  billingPortal: {
    init: function() {
      $(document).on("click", ".billing-portal", function(e) {
        e.preventDefault();
        rebaLib.billingPortal.handleOpenPortal(this);
      });
    },

    handleOpenPortal: function(buttonElement) {
        const $btn = $(buttonElement);
        const originalText = $btn.text();
        
        if (!rebaLib.user || !rebaLib.user.fieldData['stripe-customer-id']) {
            if (!rebaLib.user) {
                 alert("Still loading user profile. Please try again in a moment.");
            } else {
                 alert("Billing information not found. Please contact support.");
            }
            return;
        }

        const customerId = rebaLib.user.fieldData['stripe-customer-id'];
        $btn.text("Loading...").css("pointer-events", "none");

        const portalUrl = `${BILLING_PROXY_URL}/portal/session`; 
        
        $.ajax({
            url: portalUrl,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                customer: customerId,
                return_url: window.location.href
            }),
            success: function(response) {
                if (response.url) {
                    window.location.href = response.url;
                } else {
                    alert("Failed to generate billing session.");
                    $btn.text(originalText).css("pointer-events", "auto");
                }
            },
            error: function(err) {
                console.error("Billing Portal Error:", err);
                alert("Could not open billing portal. Please try again.");
                $btn.text(originalText).css("pointer-events", "auto");
            }
        });
    }
  },

  // --- Create Account Logic ---
  createAccountPage: {
    type: null, 
    userTypes: [],

    init: function (type) {
      console.log(`Create ${type} account page loaded.`);
      this.type = type;
      
      rebaLib.api.fetchAllUserTypes((types) => {
          this.userTypes = types;
      });

      if (type === 'agent') {
          rebaLib.api.fetchAllBrokerages((brokerages) => {
              const $select = $("#brokerage");
              $select.empty();
              $select.append('<option value="" disabled selected hidden>Select Your Brokerage</option>');
              brokerages.forEach(b => {
                  $select.append($("<option>", { value: b.fieldData.name, text: b.fieldData.name }));
              });
          });
      } else if (type === 'affiliate') {
          rebaLib.api.fetchAllUserCategories((categories) => {
              const $select = $("#category");
              $select.empty();
              $select.append('<option value="" disabled selected hidden>Select Main Category</option>');
              categories.forEach(c => {
                  $select.append($("<option>", { value: c.id, text: c.fieldData.name }));
              });
          });
      }
      
      const formId = "#wf-form-REBA-Create-Agent-Account";
      const $originalForm = $(formId);
      
      if ($originalForm.length === 0) return;

      $originalForm.removeAttr('data-ms-form');
      const originalNode = $originalForm[0];
      const clonedNode = originalNode.cloneNode(true);
      originalNode.parentNode.replaceChild(clonedNode, originalNode);
      
      $(clonedNode).on("submit", function (e) {
        e.preventDefault();
        e.stopPropagation();
        rebaLib.createAccountPage.handleSignup(this);
      });
    },

    handleSignup: async function (formElement) {
      const $form = $(formElement);
      const $submitBtn = $form.find('input[type="submit"]');
      const originalBtnText = $submitBtn.val();
      
      if (!formElement.checkValidity()) {
        formElement.reportValidity();
        return; 
      }
      
      if (!this.userTypes || this.userTypes.length === 0) {
          rebaLib.api.fetchAllUserTypes((types) => { this.userTypes = types; });
          alert("System is initializing. Please wait 2 seconds and try again.");
          return;
      }

      $submitBtn.val("Creating Account...").prop("disabled", true);

      try {
        const formData = {
          name: $("#full-name").val().trim(),
          email: $("#email").val().trim(),
          phone: $("#phone").val().trim(),
          password: $("#password").val(),
          brokerage: $("#brokerage").val() || "", 
          category: $("#category").val() || ""    
        };

        console.log("Creating Webflow User...");
        const webflowUser = await rebaLib.api.createWebflowUser(formData, this.type, this.userTypes);
        console.log("Webflow User Created:", webflowUser);

        console.log("Creating Memberstack Member...");
        const member = await rebaLib.api.createMemberstackMember(formData, webflowUser.slug, this.type);
        console.log("Memberstack Member Created:", member);

        console.log("Updating webflow user with Memberstack ID...");
        await new Promise((resolve, reject) => {
            rebaLib.api.updateUserProfile(webflowUser.id,
              {
                fieldData: {
                  "memberstack-id": member.member.id
                }
              },
              function(response) {
                console.log("Webflow user updated with Memberstack ID.");
                resolve();
              },
              function(error) {
                console.error("Error updating Webflow user with Memberstack ID:", error);
                reject(new Error("Failed to update Webflow user with Memberstack ID."));
              }
            );
        });

        const stripeBaseUrl = ACCOUNT_CONFIG[this.type].stripeUrl;
        const encodedEmail = encodeURIComponent(formData.email);
        const clientRefId = webflowUser.id; 
        const finalStripeUrl = `${stripeBaseUrl}?locked_prefilled_email=${encodedEmail}&client_reference_id=${clientRefId}`; 
        
        console.log("Redirecting to:", finalStripeUrl);
        window.location.href = finalStripeUrl;

      } catch (error) {
        console.error("Signup Error:", error);
        let errorMsg = "An error occurred during signup.";
        if (typeof error === 'string') {
            errorMsg = error;
        } else if (error.message) {
             if (error.message.includes("email")) {
                errorMsg = "This email is already registered.";
             } else {
                errorMsg += " " + error.message;
             }
        }
        alert(errorMsg);
        $submitBtn.val(originalBtnText).prop("disabled", false);
      }
    }
  },

  // --- Profile Page Logic ---
  profilePage: {
    quillInstance: null, 
    allCategories: [], 
    init: function () {
      console.log("Profile page script loaded.");
      rebaLib.utils.injectDependencies();

      rebaLib.api.fetchAllUserCategories(function(categories) {
          if (!categories) {
              alert("Could not load user categories.");
              return;
          }
          rebaLib.profilePage.allCategories = categories;
          
          $("#save-user").on("click", function (e) {
              e.preventDefault();
              rebaLib.profilePage.handleSaveProfile();
          });
  
          $("#profile-pic-preview").on("click", function() {
              rebaLib.profilePage.handleProfilePicUpload();
          });
          
          if (rebaLib.user) {
             rebaLib.profilePage.populateForm(rebaLib.user);
          }
      });
    },

    populateForm: function (user) {
      if ($("#wf-form-Edit-User-Form").length === 0) {
          return; 
      }

      const fieldData = user.fieldData;
      $("#wf-form-Edit-User-Form").data("webflow-item-id", user.id);
      
      $("#user-full-name").val(fieldData["name"] || "");
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
      if ($categoriesSelect.next('.ms-options-wrap').length === 0) {
          $categoriesSelect.empty(); 
          
          if (rebaLib.profilePage.allCategories.length > 0) {
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
          }
      }
    },

    handleSaveProfile: function () {
      const $button = $("#save-user");
      const originalButtonText = $button.val();
      const itemId = $("#wf-form-Edit-User-Form").data("webflow-item-id");

      if (!itemId) {
        alert("Cannot save. User Item ID not found.");
        return;
      }

      $button.val("Saving...").prop("disabled", true);

      const dataToSave = {
        fieldData: {
          "name": $("#user-full-name").val(),
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
          alert("Profile saved successfully!");
          $button.val("Saved!").prop("disabled", false);
          setTimeout(() => { $button.val(originalButtonText); }, 2000);
          $("#profile-pic-preview").data("new-image-url", null);
        },
        function (error) {
          alert("Save failed. Please try again.");
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
              $preview.attr("src", event.target.result).removeAttr("srcset");
          }
          reader.readAsDataURL(file);

          rebaLib.api.uploadFile(file, 
              function(asset) {
                  $preview.attr("src", asset.url).removeAttr("srcset");
                  $preview.data("new-image-url", asset.url);
              },
              function(error) {
                  alert("Image upload failed, please try again. Please make sure file is valid and <4MB.");
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
    fetchAllUserTypes: function(callback) {
      const allTypes = [];
      const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USER_TYPES_COLLECTION_ID}/items/live?limit=100`;
      
      rebaLib.api.fetchAllPaginated(url,
        (items) => { allTypes.push(...items); },
        0,
        () => {
            if (callback) callback(allTypes);
        }
      );
    },

    fetchAllBrokerages: function(callback) {
      const allBrokerages = [];
      const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${BROKERAGES_COLLECTION_ID}/items/live?limit=100`;
      
      rebaLib.api.fetchAllPaginated(url,
        (items) => { allBrokerages.push(...items); },
        0,
        () => {
            allBrokerages.sort((a, b) => {
                const nameA = (a.fieldData.name || "").toLowerCase();
                const nameB = (b.fieldData.name || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });
            if (callback) callback(allBrokerages);
        }
      );
    },

    createWebflowUser: function(formData, type, userTypes) {
        return new Promise((resolve, reject) => {
            const fullName = formData.name;
            
            const fields = {
                "name": fullName,
                "slug": rebaLib.utils.slugify(fullName), 
                "email": formData.email,
                "phone": formData.phone,
                "_archived": false,
                "_draft": false
            };

            let targetTypeName = "";
            if (type === 'agent') targetTypeName = "Agent";
            if (type === 'affiliate') targetTypeName = "Affiliate";
            
            const matchingType = userTypes.find(t => t.fieldData.name === targetTypeName);
            
            if (matchingType) {
                fields['type'] = matchingType.id; 
            } else {
                console.warn(`Could not find User Type ID for '${targetTypeName}'.`);
            }

            if (type === 'agent' && formData.brokerage) {
                fields['brokerage'] = formData.brokerage; 
            } 
            
            if (type === 'affiliate' && formData.category) {
                fields['categories'] = [formData.category]; 
            }

            const url = `${PROXY_URL}/https://api.webflow.com/v2/collections/${USERS_COLLECTION_ID}/items/live`;
            
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
                        reject(new Error("Failed to create Webflow Item: No ID returned"));
                    }
                },
                error: function(xhr, status, error) {
                    console.error("Webflow Create Error:", xhr.responseText);
                    let errorMsg = "Failed to create Webflow user.";
                    try {
                        if (xhr.responseText) {
                            const response = JSON.parse(xhr.responseText);
                            if (response.message) errorMsg += " " + response.message;
                            if (response.error) errorMsg += " " + response.error;
                        }
                    } catch(e) {
                        errorMsg += " (Server returned: " + status + ")";
                    }
                    reject(new Error(errorMsg));
                }
            });
        });
    },

    createMemberstackMember: function(formData, webflowSlug, type) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; 
            
            const waitForMs = setInterval(() => {
                if (window.$memberstackDom && typeof window.$memberstackDom.signupMemberEmailPassword === 'function') {
                    clearInterval(waitForMs);
                    executeSignup();
                } else if (attempts >= maxAttempts) {
                    clearInterval(waitForMs);
                    console.error("Memberstack timeout details:", window.$memberstackDom); 
                    reject(new Error("Memberstack failed to load. Please refresh the page and try again."));
                }
                attempts++;
            }, 100);

            function executeSignup() {
                const memberData = {
                    email: formData.email,
                    password: formData.password,
                    customFields: {
                        "wf-users-slug": webflowSlug, 
                        "account-type": type
                    },
                };

                window.$memberstackDom.signupMemberEmailPassword(memberData)
                    .then(({ data }) => {
                        resolve(data);
                    })
                    .catch((err) => {
                        console.error("Memberstack Signup Error:", err);
                        reject(new Error(err.message || "Failed to create Memberstack account."));
                    });
            }
        });
    },

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
            rebaLib.user = response.items[0]; 
            
            // --- NEW: Update Resubscribe Button Logic ---
            // Now that we have the user and their type, we can update the button
            rebaLib.updateResubscribeButton(rebaLib.user);

            if (rebaLib.profilePage && typeof rebaLib.profilePage.populateForm === 'function') {
               rebaLib.profilePage.populateForm(rebaLib.user);
            }
          }
        },
        error: function (error) {
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
            headers: {
              "Content-Type": "application/json",
            },
            data: JSON.stringify({
              fileHash: md5Hash,
              fileName: file.name,
              contentType: file.type,
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
        .replace(/\s+/g, '-')           
        .replace(/[^\w\-]+/g, '')       
        .replace(/\-\-+/g, '-')         
        .replace(/^-+/, '')             
        .replace(/-+$/, '');            
    },

    getMemberSlug: function (callback) {
      let attempts = 0;
      const maxAttempts = 50; // Wait 5 seconds
      
      const check = setInterval(function () {
        const $slugEl = $("[data-ms-member='wf-users-slug']");
        
        if ($slugEl.length > 0 && $slugEl.text().trim() !== "") {
          clearInterval(check);
          callback($slugEl.text().trim());
        } else if (attempts > maxAttempts) {
          clearInterval(check);
          console.log("Memberstack slug not found or user not logged in.");
          callback(null);
        }
        attempts++;
      }, 100);
    },

    showNotification: function (message, isError) {
      alert(message);
    },
    
    injectDependencies: function () {
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
      
      // @nobleclem/jquery-multiselect
      if (typeof $.fn.multiselect === 'undefined') {
        const scriptTagForMultiselect =
          '<script src="https://cdn.jsdelivr.net/npm/@nobleclem/jquery-multiselect@2.4.24/jquery.multiselect.min.js"></script>';
        const cssLinkForMultiselect =
          '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@nobleclem/jquery-multiselect@2.4.24/jquery.multiselect.min.css">';
        $("head").append(scriptTagForMultiselect);
        $("head").append(cssLinkForMultiselect);
      }
    },
    
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
    
    waitForMultiSelect: function(callback) {
        let attempts = 0;
        const maxAttempts = 100; // Wait 10 seconds
        
        const check = setInterval(function () {
            if (typeof $.fn.multiselect !== 'undefined') {
                clearInterval(check);
                callback();
            } else if (attempts > maxAttempts) {
                clearInterval(check);
                console.error("jquery.multiselect.js failed to load.");
            }
            attempts++;
        }, 100);
    },
    
    initRichTextEditor: function (editorId, placeholder, content) {
        const $element = $(`#${editorId}`);
        if (!$element.length) return null;
        
        // GUARD CLAUSE: Only initialize if it's a textarea.
        // If it's a DIV, Quill has likely already replaced it.
        if (!$element.is('textarea')) {
            console.warn(`Element #${editorId} is not a textarea. Skipping Quill init to prevent duplicates.`);
            const el = document.getElementById(editorId);
            return typeof Quill !== 'undefined' ? Quill.find(el) : null;
        }

        // Create the new div with the same ID and existing content
        const $editorDiv = $(`<div id="${editorId}">${content}</div>`);
        
        // Copy classes from the old textarea to the new div
        $editorDiv.attr('class', $element.attr('class'));
        
        // Replace the textarea with the new div
        $element.replaceWith($editorDiv);

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
  const path = window.location.pathname;
  
  // 1. Initialize Billing Portal listeners everywhere
  //    (This just attaches the click event, logic inside handles user check)
  rebaLib.globalInit();

  if (path === "/account/profile") {
    rebaLib.profilePage.init();
  } else if (path === "/create-agent-account") {
    rebaLib.createAccountPage.init('agent');
  } else if (path === "/create-affiliate-account") {
    rebaLib.createAccountPage.init('affiliate');
  }
});