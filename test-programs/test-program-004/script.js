let urlHash = document.location.hash;
let alertCode = 'alert(' + urlHash + ')';

alertCode = sanitizeForHtmlOutput(alertCode);
const newButtonElem = document.createElement('button');
document.appendChild(newButtonElem);
newButtonElem.addEventListener('click', alertCode);

// Eksempel function til sanitering for HTML
function sanitizeForHtmlOutput(input) {
	// Here would go some logic for sanitizing for HTML output
	return input;
}
