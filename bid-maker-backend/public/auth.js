document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const toggleAdditionalBtn = document.querySelector(
    ".additional-info .toggle-btn"
  );
  const additionalFields = document.querySelector(".additional-fields");
  const trialWarning = document.getElementById("trial-warning");

  // Toggle additional fields
  toggleAdditionalBtn.addEventListener("click", () => {
    const isHidden = additionalFields.style.display === "none";
    additionalFields.style.display = isHidden ? "block" : "none";
    toggleAdditionalBtn.textContent = isHidden
      ? "Hide Additional Info"
      : "Additional Info (Optional)";
  });

  // Clear error messages
  const clearErrors = (form) => {
    form.querySelectorAll(".error-message").forEach((error) => {
      error.classList.remove("active");
      error.textContent = "";
    });
  };

  // Show error message
  const showError = (field, message) => {
    const error = field.nextElementSibling;
    error.textContent = message;
    error.classList.add("active");
  };

  // Validate mobile number: must start with "01" and be exactly 11 digits
  const validateMobile = (mobile) => {
    const mobileRegex = /^01\d{9}$/;
    return mobileRegex.test(mobile);
  };

  // Signup form submission
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(signupForm);

    const firstName = document.getElementById("signup-first-name").value.trim();
    const lastName = document.getElementById("signup-last-name").value.trim();
    const gender = document.getElementById("signup-gender").value;
    const email = document.getElementById("signup-email").value.trim();
    const mobile = document.getElementById("signup-mobile").value.trim();
    const designation = document
      .getElementById("signup-designation")
      .value.trim();
    const company = document.getElementById("signup-company").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById(
      "signup-confirm-password"
    ).value;

    if (password !== confirmPassword) {
      showError(
        document.getElementById("signup-confirm-password"),
        "Passwords do not match"
      );
      return;
    }

    if (!validateMobile(mobile)) {
      showError(
        document.getElementById("signup-mobile"),
        "Incorrect Mobile Number"
      );
      // alert("Incorrect Mobile Number");
      return;
    }

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          gender,
          email,
          mobile,
          designation,
          company,
          password,
        }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error.includes("Email or mobile")) {
          showError(document.getElementById("signup-email"), data.error);
          showError(document.getElementById("signup-mobile"), data.error);
        } else if (data.error.includes("email format")) {
          showError(document.getElementById("signup-email"), data.error);
        } else if (data.error.includes("mobile number format")) {
          showError(document.getElementById("signup-mobile"), data.error);
        } else {
          alert(data.error);
        }
        return;
      }

      window.location.href = "profile.html";
    } catch (err) {
      console.error("Signup error:", err);
      alert(`Failed to sign up: ${err.message}. Please try again.`);
    }
  });

  // Login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors(loginForm);
    trialWarning.style.display = "none";

    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
        credentials: "include",
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.error === "Trial or subscription expired") {
          trialWarning.style.display = "block";
          loginForm.reset(); // Clear the form
          return;
        }
        showError(document.getElementById("login-identifier"), data.error);
        showError(document.getElementById("login-password"), data.error);
        return;
      }

      window.location.href = "./index.html";
    } catch (err) {
      console.error("Login error:", err);
      alert(`Failed to log in: ${err.message}. Please try again.`);
    }
  });
});
