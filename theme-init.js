// Runs before body paints -- prevents flash of wrong theme on reload
  (function () {
    try {
      var saved = localStorage.getItem('uc-plan-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        document.documentElement.setAttribute('data-theme', saved);
      }
    } catch (e) { /* storage blocked -- fine, default attribute stays */ }
  })();
