document.addEventListener("DOMContentLoaded", () => {
  // Elements for profile fields and left column
  const profilePic = document.getElementById("profile-pic");
  const profileName = document.querySelector(".profile-name");
  const profileDesignation = document.querySelector(".profile-designation");
  const profileCompany = document.querySelector(".profile-company");
  const inputs = document.querySelectorAll("#profile .form-group input");
  const trialWarning = document.getElementById("trial-warning");
  const subscriptionStart = document.getElementById("subscription-start");
  const subscriptionEnd = document.getElementById("subscription-end");

  // Function to update profile picture based on gender
  const updateProfilePic = (gender) => {
    try {
      profilePic.src = `./Images/${gender.toLowerCase()}.png`;
    } catch (e) {
      console.warn("Profile image not found, using placeholder");
      profilePic.src = "./Images/profile-placeholder.png";
    }
  };

  // Check session and trial/subscription status on page load
  fetch("/api/check-session", { credentials: "include" })
    .then((response) => {
      if (!response.ok) {
        window.location.href = "/auth.html";
      }
      // Check trial or subscription status
      return fetch("/api/check-trial", { credentials: "include" });
    })
    .then((response) => response.json())
    .then((data) => {
      if (data.error === "Trial or subscription expired") {
        trialWarning.style.display = "block";
        return Promise.reject("Trial or subscription expired");
      }
      // If trial or subscription is active, proceed to fetch user data
      return fetch("/api/user", { credentials: "include" });
    })
    .then((response) => response.json())
    .then((userData) => {
      // Update profile fields with fetched data
      inputs[0].value = userData.firstName || "";
      inputs[0].dataset.original = userData.firstName || "";
      inputs[1].value = userData.lastName || "";
      inputs[1].dataset.original = userData.lastName || "";
      inputs[2].value = userData.gender || "Male";
      inputs[2].dataset.original = userData.gender || "Male";
      inputs[3].value = userData.email || "";
      inputs[3].dataset.original = userData.email || "";
      inputs[4].value = userData.mobile || "";
      inputs[4].dataset.original = userData.mobile || "";
      inputs[5].value = userData.designation || "";
      inputs[5].dataset.original = userData.designation || "";
      inputs[6].value = userData.company || "";
      inputs[6].dataset.original = userData.company || "";

      // Update left column
      profileName.textContent = `${userData.firstName || ""} ${
        userData.lastName || ""
      }`.trim();
      profileDesignation.textContent = userData.designation || "";
      profileCompany.textContent = userData.company || "";

      // Update profile picture based on gender
      updateProfilePic(userData.gender || "Male");
    })
    .catch((err) => {
      if (err !== "Trial or subscription expired") {
        console.error("Error fetching user data:", err);
        window.location.href = "/auth.html";
      }
    });

  // Fetch subscription or trial details for the subscription tab
  fetch("/api/subscription-details", { credentials: "include" })
    .then((response) => response.json())
    .then((data) => {
      if (data.error) {
        // If subscription/trial is expired, the popup is already shown by the /api/check-trial call
        subscriptionStart.textContent = "Expired";
        subscriptionEnd.textContent = "Expired";
      } else {
        subscriptionStart.textContent = data.start;
        subscriptionEnd.textContent = data.end;
      }
      const subscriptionType = document.getElementById("subscription-type");
      // In the fetch("/api/subscription-details") block:
      if (data.error) {
        subscriptionType.textContent = "Expired";
        subscriptionStart.textContent = "Expired";
        subscriptionEnd.textContent = "Expired";
      } else {
        subscriptionType.textContent =
          data.type === "trial" ? "Free Trial" : "Paid Subscription";
        subscriptionStart.textContent = data.start;
        subscriptionEnd.textContent = data.end;
      }
    })

    .catch((err) => {
      console.error("Error fetching subscription details:", err);
      subscriptionStart.textContent = "Error";
      subscriptionEnd.textContent = "Error";
    });

  // Logout button in left column
  const logoutBtn = document.querySelector(".logout-btn");
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/auth.html";
    } catch (err) {
      alert("Failed to log out. Please try again.");
    }
  });

  // Existing tab switching and edit profile logic
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      const tabId = tab.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");
    });
  });

  const editBtn = document.querySelector(".edit-btn");
  const editActions = document.querySelector(".edit-actions");
  const saveBtn = document.querySelector(".save-btn");
  const cancelBtn = document.querySelector(".cancel-btn");
  let isEditing = false;

  const originalValues = Array.from(inputs).map((input) => input.value);
  const originalPic = profilePic.src;

  const genderField = document.querySelector("#gender-field");
  if (genderField) {
    updateProfilePic(genderField.value);
  }

  editBtn.addEventListener("click", () => {
    isEditing = true;
    editBtn.style.display = "none";
    editActions.style.display = "flex";

    inputs.forEach((input, index) => {
      if (input.id === "gender-field") {
        const select = document.createElement("select");
        select.innerHTML = `
          <option value="Male" ${
            input.value === "Male" ? "selected" : ""
          }>Male</option>
          <option value="Female" ${
            input.value === "Female" ? "selected" : ""
          }>Female</option>
        `;
        select.className = input.className;
        select.dataset.original = input.dataset.original;
        input.replaceWith(select);
      } else {
        input.removeAttribute("readonly");
      }
    });
  });

  saveBtn.addEventListener("click", () => {
    isEditing = false;
    editBtn.style.display = "inline-block";
    editActions.style.display = "none";

    const newValues = [];
    document
      .querySelectorAll(
        "#profile .form-group input, #profile .form-group select"
      )
      .forEach((field, index) => {
        newValues.push(field.value);
        if (field.tagName === "SELECT") {
          const input = document.createElement("input");
          input.type = "text";
          input.value = field.value;
          input.readOnly = true;
          input.className = field.className;
          input.dataset.original = field.value;
          input.id = "gender-field";
          field.replaceWith(input);
        } else {
          field.setAttribute("readonly", true);
          field.dataset.original = field.value;
        }
      });

    profileName.textContent = `${newValues[0]} ${newValues[1]}`.trim();
    profileDesignation.textContent = newValues[5] || "";
    profileCompany.textContent = newValues[6] || "";

    const newGender = newValues[2];
    updateProfilePic(newGender);

    fetch("/api/update-profile", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: newValues[0],
        lastName: newValues[1],
        gender: newValues[2],
        email: newValues[3],
        mobile: newValues[4],
        designation: newValues[5],
        company: newValues[6],
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Failed to update profile");
        alert("Profile updated successfully!");
      })
      .catch((err) => {
        console.error("Error updating profile:", err);
        alert("Failed to update profile. Please try again.");
      });
  });

  cancelBtn.addEventListener("click", () => {
    isEditing = false;
    editBtn.style.display = "inline-block";
    editActions.style.display = "none";

    document
      .querySelectorAll(
        "#profile .form-group input, #profile .form-group select"
      )
      .forEach((field, index) => {
        if (field.tagName === "SELECT") {
          const input = document.createElement("input");
          input.type = "text";
          input.value = originalValues[index];
          input.readOnly = true;
          input.className = field.className;
          input.dataset.original = originalValues[index];
          input.id = "gender-field";
          field.replaceWith(input);
        } else {
          field.value = originalValues[index];
          field.setAttribute("readonly", true);
        }
      });

    profileName.textContent =
      `${originalValues[0]} ${originalValues[1]}`.trim();
    profileDesignation.textContent = originalValues[5] || "";
    profileCompany.textContent = originalValues[6] || "";

    profilePic.src = originalPic;
  });
});
