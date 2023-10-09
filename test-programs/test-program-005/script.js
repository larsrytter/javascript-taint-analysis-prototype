let divElem = document.getElementById('theDiv');
let urlHash = document.location.hash;
let outputText = 'Hello';
divElem.innerHTML = outputText; // Safe

function taintOutputOnLoad() {
	outputText = `${outputText} ${urlHash}`;
	divElem.innerHTML = outputText; // Tainted
}
