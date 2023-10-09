const divElem = document.getElementById('theDiv');
const urlHash = document.location.hash;
if (divElem && urlHash) {
    let textOutput = '';
	textOutput = `Url location is ${urlHash}`;
	textOutput = sanitizeForHtmlOutput(textOutput);
	
	divElem.innerHTML = textOutput;	
}
// Eksempel function til sanitering for HTML
function sanitizeForHtmlOutput(input) {
	// Here would go some logic for sanitizing for HTML output
	return input;
}
