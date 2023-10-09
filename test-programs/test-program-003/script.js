const divElem = document.getElementById('theDiv');
const inputElem = document.getElementById('theInput');
const inputValue = inputElem.value;
let count = 0;
let textOutput = '';
while (count < 10) {
    count++;
    textOutput += `Counter has reached ${count}\n`;

    if (count > 42) {
        textOutput += `And input is ${inputValue}`;
    }
    divElem.innerHTML = textOutput;
}
