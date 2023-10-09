let divElem = document.getElementById('theDiv');
let urlHash = document.location.hash;
let outputText = 'Hello';

if (divElem && urlHash) {
	divElem.innerHTML = outputText; // Safe
} else {
	divElem.innerHTML = 'Hello again';
}

function taintOutputOnLoad() {
	outputText = `${outputText} ${urlHash}`;
	divElem.innerHTML = outputText; // Tainted
}
