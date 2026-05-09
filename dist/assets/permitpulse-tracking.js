(function () {
  var FORM_ATTR_FIELDS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "landing_page",
    "referrer",
    "page_path"
  ];

  var FORM_START_EVENTS = new WeakSet();
  var OFFICIAL_HOST_HINTS = [
    "accela.com",
    "arcgis.com",
    "beverlyhills.org",
    "boston.gov",
    "ca.gov",
    "cityofpasadena.net",
    "culvercity.org",
    "data.lacity.org",
    "data.sandiegocounty.gov",
    "data.santamonica.gov",
    "epicla.lacounty.gov",
    "glendaleca.gov",
    "honolulu.gov",
    "ladbs.org",
    "lacity.org",
    "lacounty.gov",
    "longbeach.gov",
    "mypermits.cityofpasadena.net",
    "opendsd.sandiego.gov",
    "sacramento.gov",
    "sandiego.gov",
    "sanjoseca.gov",
    "santamonica.gov",
    "tylerhost.net"
  ];

  function pagePath() {
    return window.location.pathname || "/";
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function safeUrl(rawUrl) {
    try {
      return new URL(rawUrl, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function isInternalUrl(url) {
    return !url || url.origin === window.location.origin;
  }

  function track(eventName, params) {
    var payload = params || {};
    if (!payload.page_path) payload.page_path = pagePath();

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, payload);
    }
  }

  function ctaLocation(element) {
    if (!element) return pagePath();
    var explicit = element.getAttribute("data-pp-location");
    if (explicit) return explicit;
    if (element.closest(".sticky-cta")) return "sticky_cta";
    if (element.closest("header")) return "header";
    if (element.closest("footer")) return "footer";
    var section = element.closest("section[id], main[id], article[id]");
    if (section && section.id) return section.id;
    var labelled = element.closest("[aria-labelledby]");
    if (labelled) return labelled.getAttribute("aria-labelledby") || pagePath();
    return pagePath();
  }

  function formName(form) {
    if (!form) return "lead_form";
    var named = form.querySelector('[name="form_name"], [name="form_type"], [name="lead_source"]');
    if (named && named.value) return named.value;
    return form.getAttribute("id") || form.getAttribute("name") || "lead_form";
  }

  function leadType(formOrData) {
    if (formOrData && typeof formOrData.get === "function") {
      return formOrData.get("lead_type") || formOrData.get("lead_source") || formOrData.get("form_type") || "lead";
    }
    if (formOrData && formOrData.querySelector) {
      var field = formOrData.querySelector('[name="lead_type"], [name="lead_source"], [name="form_type"]');
      return field && field.value ? field.value : "lead";
    }
    return "lead";
  }

  function getAttribution() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      landing_page: window.location.origin + window.location.pathname,
      referrer: document.referrer || "",
      page_path: pagePath()
    };
  }

  function ensureHiddenField(form, name, value) {
    var field = form.querySelector('input[name="' + name + '"]');
    if (!field) {
      field = document.createElement("input");
      field.type = "hidden";
      field.name = name;
      form.appendChild(field);
    }
    field.value = value || "";
  }

  function populateFormAttribution(form) {
    if (!form || !/formspree\.io/i.test(form.getAttribute("action") || "")) return;
    var attribution = getAttribution();
    FORM_ATTR_FIELDS.forEach(function (name) {
      ensureHiddenField(form, name, attribution[name]);
    });
    if (!form.querySelector('input[name="_next"]')) {
      var next = new URL("/thank-you/", window.location.origin);
      next.searchParams.set("form_name", formName(form));
      next.searchParams.set("lead_type", leadType(form));
      ensureHiddenField(form, "_next", next.toString());
    }
  }

  function populateAllForms() {
    document.querySelectorAll('form[action*="formspree.io"]').forEach(populateFormAttribution);
  }

  function handleFormStart(event) {
    var form = event.target && event.target.closest ? event.target.closest('form[action*="formspree.io"]') : null;
    if (!form || FORM_START_EVENTS.has(form)) return;
    FORM_START_EVENTS.add(form);
    populateFormAttribution(form);
    track("pp_form_start", {
      form_name: formName(form),
      page_path: pagePath()
    });
  }

  function inferPrice(text, link) {
    var explicit = link && link.getAttribute("data-pp-price");
    if (explicit) return Number(explicit);
    if (/\$?\s*149\b/.test(text)) return 149;
    if (/\$?\s*300\b/.test(text)) return 300;
    return undefined;
  }

  function inferOfferType(text, price) {
    if (/express|rush/i.test(text) || price === 300) return "express";
    return "standard";
  }

  function isCheckoutLink(url) {
    return !!url && (/buy\.stripe\.com/i.test(url.hostname) || /\/api\/checkout\b/i.test(url.pathname) || /checkout/i.test(url.pathname));
  }

  function isSampleAsset(link, url, text) {
    var href = link.getAttribute("href") || "";
    return /sample-report|sample-dossier|preview-pack|redacted|sample.*\.pdf|preview.*\.pdf/i.test(href + " " + text) ||
      (!!url && /\/assets\/docs\/.*(sample|preview|redacted).*\.pdf/i.test(url.pathname));
  }

  function isMajorCta(link) {
    if (!link) return false;
    if (link.getAttribute("data-pp-event") || link.getAttribute("data-pp-cta")) return true;
    if (link.closest(".sticky-cta, .hero-cta, .hero-actions, .final-cta-actions, .offer-actions, .actions, .cta-actions")) return true;
    return /\b(btn|button|cta|sticky-primary|sticky-ghost)\b/i.test(link.className || "");
  }

  function sourceName(link, url) {
    var explicit = link.getAttribute("data-pp-source-name");
    if (explicit) return explicit;
    var text = cleanText(link.textContent);
    if (text) return text.slice(0, 80);
    return url ? url.hostname.replace(/^www\./, "") : "";
  }

  function isOfficialSourceLink(link, url, text) {
    if (!url || isInternalUrl(url)) return false;
    if (isCheckoutLink(url) || /formspree\.io|stripe\.com|mailto:|tel:|sms:/i.test(url.href)) return false;
    var host = url.hostname.replace(/^www\./, "");
    if (/\.gov$/i.test(host)) return true;
    if (OFFICIAL_HOST_HINTS.some(function (hint) { return host === hint || host.endsWith("." + hint); })) return true;
    return /official|public record|permit portal|building records|citizen access|open records|source/i.test(text);
  }

  function assetName(link, url, text) {
    var explicit = link.getAttribute("data-pp-asset-name");
    if (explicit) return explicit;
    if (text) return text.slice(0, 80);
    if (url) return url.pathname.split("/").filter(Boolean).pop() || url.pathname;
    return "sample_asset";
  }

  function handleClick(event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var url = safeUrl(href);
    var text = cleanText(link.textContent);
    var location = ctaLocation(link);

    if (link.getAttribute("data-pp-event")) {
      track(link.getAttribute("data-pp-event"), {
        cta_location: location,
        destination: link.getAttribute("data-pp-destination") || href,
        price: link.getAttribute("data-pp-price") ? Number(link.getAttribute("data-pp-price")) : undefined,
        page_path: pagePath()
      });
    }

    if (isMajorCta(link)) {
      track("pp_cta_click", {
        cta_text: text || link.getAttribute("aria-label") || "",
        cta_location: location,
        page_path: pagePath(),
        target_url: href
      });
    }

    if (/^sms:/i.test(href)) {
      track("pp_sms_click", {
        cta_location: location,
        page_path: pagePath()
      });
      track("hotline_click", {
        cta_location: location,
        page_path: pagePath()
      });
    } else if (/^tel:\+15626762691/i.test(href)) {
      track("hotline_click", {
        cta_location: location,
        page_path: pagePath()
      });
    }

    if (isCheckoutLink(url)) {
      var price = inferPrice(text, link);
      track("pp_checkout_click", {
        offer_type: inferOfferType(text, price),
        price: price,
        page_path: pagePath()
      });
    }

    if (isSampleAsset(link, url, text)) {
      track("pp_sample_view", {
        asset_name: assetName(link, url, text),
        page_path: pagePath()
      });
    }

    if (isOfficialSourceLink(link, url, text)) {
      track("pp_outbound_official_source_click", {
        source_name: sourceName(link, url),
        target_url: href,
        page_path: pagePath()
      });
    }
  }

  function patchFetch() {
    if (typeof window.fetch !== "function" || window.fetch.__ppPatched) return;
    var originalFetch = window.fetch;
    window.fetch = function ppFetch(input, init) {
      var requestUrl = typeof input === "string" ? input : input && input.url;
      var body = init && init.body;
      var isFormspree = requestUrl && /formspree\.io/i.test(requestUrl);

      return originalFetch.apply(this, arguments).then(function (response) {
        if (isFormspree && response && response.ok) {
          track("generate_lead", {
            form_name: body && typeof body.get === "function" ? body.get("form_name") || body.get("form_type") || body.get("lead_source") || "lead_form" : "lead_form",
            lead_type: leadType(body),
            page_path: pagePath()
          });
        }
        return response;
      });
    };
    window.fetch.__ppPatched = true;
  }

  function trackThankYouView() {
    if (/\/(snapshot-thank-you|thank-you|success)\/?$/i.test(pagePath())) {
      var params = new URLSearchParams(window.location.search);
      track("generate_lead", {
        form_name: params.get("form_name") || (pagePath().indexOf("snapshot") >= 0 ? "PermitPulse Snapshot" : "lead_form"),
        lead_type: params.get("lead_type") || "lead",
        page_path: pagePath()
      });
    }
  }

  window.ppTrack = track;
  window.ppPopulateTrackingFields = populateAllForms;

  document.addEventListener("click", handleClick);
  document.addEventListener("focusin", handleFormStart);
  document.addEventListener("input", handleFormStart);
  document.addEventListener("change", handleFormStart);
  document.addEventListener("submit", function (event) {
    populateFormAttribution(event.target);
  }, true);

  patchFetch();
  populateAllForms();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      populateAllForms();
      trackThankYouView();
    });
  } else {
    trackThankYouView();
  }
})();
