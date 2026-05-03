(function () {
  function pagePath() {
    return window.location.pathname || "/";
  }

  window.ppTrack = function ppTrack(eventName, params) {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params || {});
    }
  };

  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var explicitEvent = link.getAttribute("data-pp-event");
    var destination = link.getAttribute("data-pp-destination") || href;
    var params = { page_path: pagePath() };

    if (explicitEvent) {
      if (destination) params.destination = destination;
      if (link.getAttribute("data-pp-location")) params.cta_location = link.getAttribute("data-pp-location");
      if (link.getAttribute("data-pp-price")) params.price = Number(link.getAttribute("data-pp-price"));
      window.ppTrack(explicitEvent, params);
      return;
    }

    if (href.indexOf("tel:+15626762691") === 0 || href.indexOf("sms:+15626762691") === 0) {
      window.ppTrack("hotline_click", {
        page_path: pagePath(),
        cta_location: link.getAttribute("data-pp-location") || pagePath()
      });
      return;
    }

    if (href.indexOf("https://buy.stripe.com/9B614ofhJ72H5Ft93Q1wY0l") === 0) {
      window.ppTrack("permit_review_plus_click", {
        page_path: pagePath(),
        price: 149
      });
      if (pagePath().indexOf("/resources/") === 0) {
        window.ppTrack("resources_cta_click", {
          page_path: pagePath(),
          destination: "permit-review-plus"
        });
      }
      return;
    }

    if (href.indexOf("/sample-report/") === 0) {
      window.ppTrack("sample_report_click", { page_path: pagePath() });
      return;
    }

    if (pagePath().indexOf("/resources/") === 0 && (href.indexOf("/snapshot/") === 0 || href.indexOf("/permit-due-diligence-los-angeles/") === 0)) {
      window.ppTrack("resources_cta_click", {
        page_path: pagePath(),
        destination: href
      });
    }
  });

  if (pagePath() === "/snapshot-thank-you/") {
    window.ppTrack("snapshot_thank_you_view", { page_path: pagePath() });
  }
})();
