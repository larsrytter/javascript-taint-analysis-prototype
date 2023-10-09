let divElem = document.getElementById('theDiv');
let urlHash = document.location.hash;
if (theDiv && urlHash) {
    let textOutput = '';
	textOutput = `Url location is ${urlHash}`;
	divElem.innerHTML = textOutput;
}