const emailForm = document.getElementById("email-form");
const codeForm = document.getElementById("code-form");
const errorEl = document.getElementById("error");
const captchaHost = document.getElementById("captcha");
let captchaToken = "";
let provider = "";
let signedInEmail = "";

function showError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message || "";
}

async function post(path, body) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Sign-in failed");
  return data;
}

function mountCaptcha(nextProvider, siteKey) {
  provider = nextProvider;
  captchaHost.innerHTML = "";
  const script = document.createElement("script");
  if (nextProvider === "turnstile") {
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = () => {
      window.turnstile.render(captchaHost, {
        sitekey: siteKey,
        callback: (token) => {
          captchaToken = token;
        },
      });
    };
  } else {
    script.src = "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.onload = () => {
      window.hcaptcha.render(captchaHost, {
        sitekey: siteKey,
        callback: (token) => {
          captchaToken = token;
        },
      });
    };
  }
  document.head.appendChild(script);
}

emailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("");
  try {
    signedInEmail = document.getElementById("email").value;
    const data = await post("/api/auth/request", {
      email: signedInEmail,
      captchaToken,
    });
    if (data.captchaRequired && !captchaToken) {
      mountCaptcha(data.captchaProvider, data.captchaSiteKey);
      showError("Complete the check, then request the code again.");
      return;
    }
    document.getElementById("info").textContent = data.message || "";
    if (data.devCode) {
      document.getElementById("dev").hidden = false;
      document.getElementById("dev-code").textContent = data.devCode;
    }
    emailForm.hidden = true;
    codeForm.hidden = false;
    document.getElementById("code").focus();
  } catch (error) {
    showError(error instanceof Error ? error.message : "Sign-in failed");
  }
});

async function submitCode() {
  showError("");
  try {
    await post("/api/auth/verify", {
      email: signedInEmail,
      code: document.getElementById("code").value,
    });
    location.href = "/dashboard";
  } catch (error) {
    showError(error instanceof Error ? error.message : "Sign-in failed");
  }
}

document.getElementById("sign-in-button").addEventListener("click", () => {
  void submitCode();
});
codeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitCode();
});

const params = new URLSearchParams(location.search);
const invite = params.get("invite");
const magic = params.get("token");
if (invite) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Confirm and continue";
  button.addEventListener("click", async () => {
    try {
      await post("/api/auth/invite", { token: invite });
      location.href = "/dashboard";
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sign-in failed");
    }
  });
  document.querySelector("main").insertBefore(button, emailForm);
} else if (magic) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Confirm and continue";
  button.addEventListener("click", async () => {
    try {
      await post("/api/auth/verify", { token: magic });
      location.href = "/dashboard";
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sign-in failed");
    }
  });
  document.querySelector("main").insertBefore(button, emailForm);
}
