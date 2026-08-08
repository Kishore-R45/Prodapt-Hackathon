const HOST_ID = "inboxpilot-host";
const PANEL_ID = "inboxpilot-panel";

mountSidebar();
observeUrlChanges();

function mountSidebar(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.right = "0";
  host.style.bottom = "0";
  host.style.zIndex = "2147483647";
  host.style.display = "flex";
  host.style.alignItems = "stretch";
  host.style.pointerEvents = "none";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "InboxPilot";
  toggle.style.position = "absolute";
  toggle.style.top = "16px";
  toggle.style.left = "-112px";
  toggle.style.width = "112px";
  toggle.style.height = "44px";
  toggle.style.border = "0";
  toggle.style.borderRadius = "16px 0 0 16px";
  toggle.style.background = "linear-gradient(135deg, #0f172a, #0ea5e9)";
  toggle.style.color = "#ffffff";
  toggle.style.fontWeight = "700";
  toggle.style.letterSpacing = "0.04em";
  toggle.style.cursor = "pointer";
  toggle.style.pointerEvents = "auto";
  toggle.style.boxShadow = "0 18px 40px rgba(15, 23, 42, 0.28)";

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.width = "420px";
  panel.style.height = "100%";
  panel.style.transform = "translateX(0)";
  panel.style.transition = "transform 220ms ease";
  panel.style.pointerEvents = "auto";
  panel.style.boxShadow = "-24px 0 48px rgba(15, 23, 42, 0.22)";
  panel.style.background = "transparent";

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("sidebar.html");
  iframe.title = "InboxPilot sidebar";
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "0";
  iframe.style.background = "transparent";

  let open = true;
  toggle.addEventListener("click", () => {
    open = !open;
    panel.style.transform = open ? "translateX(0)" : "translateX(calc(100% - 40px))";
    toggle.textContent = open ? "Hide" : "InboxPilot";
  });

  panel.appendChild(iframe);
  host.appendChild(panel);
  host.appendChild(toggle);
  document.documentElement.appendChild(host);
}

function observeUrlChanges(): void {
  const observer = new MutationObserver(() => mountSidebar());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", mountSidebar);
  window.addEventListener("hashchange", mountSidebar);
}