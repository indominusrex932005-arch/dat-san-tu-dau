const choice = document.querySelector('#checkout-choice');
if (choice && typeof choice.showModal === 'function') {
  choice.close();
  choice.showModal();
  choice.addEventListener('cancel', event => event.preventDefault());
}
