// The Email button copies the address instead of opening a mail client: many
// readers have none set up, and then a mailto: click silently does nothing.
// A toast confirms the copy. The mailto: href stays as the fallback — it is
// what runs without JavaScript, and when the clipboard can't be written.
(() => {
  const button = document.querySelector("[data-copy-email]");
  const toast = document.querySelector("[data-toast]");
  const text = toast?.querySelector("[data-toast-text]");
  if (!button || !text || !navigator.clipboard) return;

  const VISIBLE_MS = 3000;
  const FADE_MS = 300;
  const address = button.dataset.copyEmail;
  let timer;

  // Rebuilt on every copy, not just shown again: a live region only
  // announces a change, so a second click must change the text too.
  const show = () => {
    const label = document.createElement("span");
    label.textContent = "Email copied";
    const value = document.createElement("span");
    value.className = "toast-address";
    value.textContent = address;
    text.replaceChildren(label, " · ", value);
    toast.classList.add("is-visible");

    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.classList.remove("is-visible");
      // Emptied once faded out (toast.css), so it doesn't shrink mid-fade.
      timer = setTimeout(() => text.replaceChildren(), FADE_MS);
    }, VISIBLE_MS);
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    // Tracked here, not with data-umami-event: Umami follows a tracked link's
    // href itself once the event is sent, which would open the mail client.
    window.umami?.track("contact-email");
    navigator.clipboard.writeText(address).then(show, () => {
      window.location.href = button.href;
    });
  });
})();
