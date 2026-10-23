for (const button of document.querySelectorAll('[data-print-receipt]')) {
  button.addEventListener('click', () => window.print());
}
