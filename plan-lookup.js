(function () {
  'use strict';

  // Fetch plan data, then initialize the form
  fetch('plan_data.json')
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(init)
    .catch(function (err) {
      console.error('Failed to load plan data', err);
      var resultsContainer = document.getElementById('results');
      if (resultsContainer) {
        resultsContainer.textContent = 'Sorry, the plan data failed to load. Please refresh the page or try again later.';
        resultsContainer.style.color = 'var(--error-ink)';
      }
    });

  function init(raw) {
    var ZIP_DATA = raw.zipData;
    var COUNTY_DATA = raw.countyData;
    var ZIP_COUNTIES = raw.zipCounties;
    var ALL_COUNTIES = raw.allCounties;

    // ---- DOM refs ----
    var form = document.getElementById('lookup-form');
    var zipInput = document.getElementById('zip-input');
    var countySelect = document.getElementById('county-select');
    var zipError = document.getElementById('zip-error');
    var countyError = document.getElementById('county-error');
    var submitBtn = document.getElementById('submit-btn');
    var resetBtn = document.getElementById('reset-btn');
    var resultsContainer = document.getElementById('results');
    var placeholder = document.getElementById('results-placeholder');



    // ---- Helpers (XSS-safe: textContent only) ----
    function clearChildren(el) {
      while (el.firstChild) el.removeChild(el.firstChild);
    }

    function el(tag, opts, children) {
      var n = document.createElement(tag);
      if (opts) {
        if (opts.className) n.className = opts.className;
        if (opts.text) n.textContent = opts.text;
        if (opts.attrs) {
          for (var k in opts.attrs) {
            if (Object.prototype.hasOwnProperty.call(opts.attrs, k)) {
              n.setAttribute(k, opts.attrs[k]);
            }
          }
        }
      }
      if (children) {
        for (var i = 0; i < children.length; i++) {
          if (children[i]) n.appendChild(children[i]);
        }
      }
      return n;
    }

    function setError(inputEl, messageEl, msg) {
      if (msg) {
        messageEl.textContent = msg;
        inputEl.setAttribute('aria-invalid', 'true');
      } else {
        messageEl.textContent = '';
        inputEl.removeAttribute('aria-invalid');
      }
    }

    // ---- County dropdown management ----
    function populateCounties(zip) {
      clearChildren(countySelect);
      if (zip && ZIP_COUNTIES[zip]) {
        var counties = ZIP_COUNTIES[zip];
        var prompt = el('option', { attrs: { value: '' }, text: counties.length === 1 ? 'Select county' : 'Select your county' });
        countySelect.appendChild(prompt);
        for (var i = 0; i < counties.length; i++) {
          countySelect.appendChild(el('option', { attrs: { value: counties[i] }, text: counties[i] }));
        }
        countySelect.disabled = false;
        // If only one county, auto-select for convenience
        if (counties.length === 1) {
          countySelect.value = counties[0];
        }
      } else {
        countySelect.appendChild(el('option', { attrs: { value: '' }, text: zip ? 'ZIP not found — enter a valid California ZIP' : 'Enter a ZIP code first' }));
        countySelect.disabled = true;
      }
    }

    // ---- Availability logic ----
    // Combine ZIP-level service code with county-level code to determine what's available
    function combine(zipCode, countyCode) {
      // zipCode: 'BAS', 'ALL', 'RSK', or null
      // countyCode: 'BAS', 'ALL', or null (counties don't have RSK)
      if (!countyCode) return null;
      var hasZipNonMed = zipCode === 'BAS' || zipCode === 'ALL';
      var hasZipMed   = zipCode === 'RSK' || zipCode === 'ALL';
      var hasCountyNonMed = countyCode === 'BAS' || countyCode === 'ALL';
      var hasCountyMed    = countyCode === 'ALL';
      var nm = hasZipNonMed && hasCountyNonMed;
      var med = hasZipMed && hasCountyMed;
      if (nm && med) return 'non-Medicare and Kaiser Senior Advantage';
      if (nm) return 'non-Medicare';
      if (med) return 'Medicare';
      return null;
    }

    function lookup(zip, county) {
      var zipEntry = ZIP_DATA[zip] || {};
      var countyEntry = COUNTY_DATA[county] || {};
      var zipCountiesForZip = ZIP_COUNTIES[zip] || [];
      var countyMatchesZip = zipCountiesForZip.indexOf(county) !== -1;

      // Health Net Blue & Gold HMO -- ZIP carrier "HB", county column "HN"
      var hnZipCode = (zipEntry.HB || {})[county] || null;
      var hnCountyCode = countyEntry.HN || null;
      var hn = combine(hnZipCode, hnCountyCode);

      // Kaiser Permanente North -- ZIP carrier "KP", county column "Kaiser"
      var kpZipCode = (zipEntry.KP || {})[county] || null;
      var kpCountyCode = countyEntry.Kaiser || null;
      var kp = combine(kpZipCode, kpCountyCode);

      // Western Health Advantage -- no ZIP-level data in the sheet, so rely on
      // county coverage (only when the ZIP actually sits in that county)
      var whaCountyCode = countyEntry.WHA || null;
      var wha = null;
      if (countyMatchesZip && whaCountyCode) {
        if (whaCountyCode === 'ALL') wha = 'non-Medicare and Medicare';
        else if (whaCountyCode === 'BAS') wha = 'non-Medicare';
      }

      return {
        zip: zip,
        county: county,
        countyMatchesZip: countyMatchesZip,
        plans: [
          { name: 'Health Net Blue & Gold HMO', availability: hn },
          { name: 'Kaiser Permanente North',     availability: kp },
          { name: 'Western Health Advantage',    availability: wha }
        ]
      };
    }

    // ---- Render results ----
    function renderResults(result) {
      clearChildren(resultsContainer);

      // Context banner
      var context = el('div', { className: 'results-context' });
      context.appendChild(document.createTextNode('Results for ZIP '));
      context.appendChild(el('strong', { text: result.zip }));
      context.appendChild(document.createTextNode(' in '));
      context.appendChild(el('strong', { text: result.county + ' County' }));
      context.appendChild(document.createTextNode('.'));
      resultsContainer.appendChild(context);

      // Mismatch warning (shouldn't happen since county dropdown is filtered, but safety)
      if (!result.countyMatchesZip) {
        var warn = el('div', { className: 'mismatch-warning' });
        warn.appendChild(el('strong', { text: 'ZIP and county do not match.' }));
        warn.appendChild(document.createTextNode('Please select a county that overlaps with your ZIP code.'));
        resultsContainer.appendChild(warn);
      }

      // Plans list
      var list = el('ul', { className: 'results-list', attrs: { 'aria-label': 'HMO plan availability' } });
      for (var i = 0; i < result.plans.length; i++) {
        var p = result.plans[i];
        var isAvailable = !!p.availability;
        var item = el('li', { className: 'result-item ' + (isAvailable ? 'ok' : 'na') });

        // Visually + semantically pair plan name with status
        var name = el('span', { className: 'result-plan', text: p.name });
        var status = el('span', {
          className: 'result-status ' + (isAvailable ? '' : 'status-na'),
          text: isAvailable ? ('Available (' + p.availability + ')') : 'Not available'
        });

        // Hidden context for screen readers -- announce plan name with status
        var srText = el('span', {
          className: 'sr-only',
          text: p.name + ': ' + (isAvailable ? 'available, ' + p.availability : 'not available') + '.'
        });
        item.appendChild(srText);

        item.appendChild(name);
        item.appendChild(status);
        list.appendChild(item);
      }
      resultsContainer.appendChild(list);

      // Count summary for SR users
      var availableCount = 0;
      for (var j = 0; j < result.plans.length; j++) {
        if (result.plans[j].availability) availableCount++;
      }
      var summary = el('p', {
        className: 'sr-only',
        attrs: { role: 'status' },
        text: availableCount === 0
          ? 'No HMO plans available for this combination.'
          : availableCount + ' HMO plan' + (availableCount === 1 ? '' : 's') + ' available for your ZIP and county.'
      });
      resultsContainer.appendChild(summary);
    }

    function showPlaceholder() {
      clearChildren(resultsContainer);
      resultsContainer.appendChild(placeholder);
    }

    // ---- Validation ----
    function validate() {
      var zip = zipInput.value.trim();
      var county = countySelect.value;
      var ok = true;

      if (!zip) {
        setError(zipInput, zipError, 'Enter your 5-digit ZIP code.');
        ok = false;
      } else if (!/^\d{5}$/.test(zip)) {
        setError(zipInput, zipError, 'ZIP code must be exactly 5 digits.');
        ok = false;
      } else if (!ZIP_DATA[zip]) {
        setError(zipInput, zipError, 'This ZIP code is not in the UC service area data.');
        ok = false;
      } else {
        setError(zipInput, zipError, '');
      }

      if (ok) {
        if (!county) {
          setError(countySelect, countyError, 'Select a county that matches your ZIP code.');
          ok = false;
        } else {
          setError(countySelect, countyError, '');
        }
      }

      return ok ? { zip: zip, county: county } : null;
    }

    // ---- Event wiring ----
    zipInput.addEventListener('input', function () {
      // Strip non-digits
      var cleaned = zipInput.value.replace(/\D/g, '').slice(0, 5);
      if (cleaned !== zipInput.value) zipInput.value = cleaned;

      if (cleaned.length === 5) {
        populateCounties(cleaned);
        if (ZIP_DATA[cleaned]) {
          setError(zipInput, zipError, '');
        } else {
          setError(zipInput, zipError, 'This ZIP code is not in the UC service area data.');
        }
      } else {
        populateCounties(null);
        if (cleaned.length > 0 && cleaned.length < 5) {
          setError(zipInput, zipError, '');  // don't nag mid-type
        }
      }
    });

    countySelect.addEventListener('change', function () {
      if (countySelect.value) {
        setError(countySelect, countyError, '');
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = validate();
      if (!v) {
        // Move focus to first invalid field for keyboard users
        if (zipInput.getAttribute('aria-invalid') === 'true') {
          zipInput.focus();
        } else if (countySelect.getAttribute('aria-invalid') === 'true') {
          countySelect.focus();
        }
        return;
      }
      var result = lookup(v.zip, v.county);
      renderResults(result);
      // Move focus to results for AT users
      resultsContainer.setAttribute('tabindex', '-1');
      resultsContainer.focus();
    });

    resetBtn.addEventListener('click', function () {
      form.reset();
      populateCounties(null);
      setError(zipInput, zipError, '');
      setError(countySelect, countyError, '');
      showPlaceholder();
      zipInput.focus();
    });

    // Initial state
    populateCounties(null);

    // ---- Theme toggle ----
    (function () {
      var buttons = document.querySelectorAll('.theme-btn');
      var current = document.documentElement.getAttribute('data-theme') || 'auto';

      function apply(theme) {
        if (theme !== 'light' && theme !== 'dark' && theme !== 'auto') theme = 'auto';
        document.documentElement.setAttribute('data-theme', theme);
        try { localStorage.setItem('uc-plan-theme', theme); } catch (e) { /* ignore */ }
        for (var i = 0; i < buttons.length; i++) {
          var isActive = buttons[i].getAttribute('data-theme-value') === theme;
          buttons[i].setAttribute('aria-pressed', isActive ? 'true' : 'false');
        }
      }

      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function () {
          apply(this.getAttribute('data-theme-value'));
        });
      }

      // Sync initial button state with whatever FOUC script set
      apply(current);
    })();
  }
})();
