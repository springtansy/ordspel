
"use strict";

// =========================
// CONSTANTS
// =========================

const MAX_GUESSES = 6;
const MIN_LENGTH = 3;
const MAX_LENGTH = 8;

const WORDLIST_URL = "../ordlista/filtered_list";

const KEYBOARD_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "Å"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"]
];

// =========================
// DOM ELEMENTS
// =========================

const board = document.getElementById("game-board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("message");
const lengthSelector = document.getElementById("word-length");
const restartButton = document.getElementById("restart-button");

// =========================
// GAME STATE
// =========================

let wordLists = {};

let wordLength = 5;
let answer = "";

let currentGuess = "";
let guesses = [];

let gameOver = false;

let keyStates = {};

// =========================
// LOAD WORD LIST
// =========================

async function loadWordList() {
    try {
        const response = await fetch(WORDLIST_URL);

        if (!response.ok) {
            throw new Error("Kunde inte ladda ordlistan.");
        }

        const text = await response.text();

        const words = text
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .map(word => word.trim().toLocaleUpperCase("sv-SE"))
            .filter(word => word.length > 0);

        for (let length = MIN_LENGTH; length <= MAX_LENGTH; length++) {
            wordLists[length] = words.filter(
                word => Array.from(word).length === length
            );
        }

        return true;

    } catch (error) {
        console.error(error);
        showMessage("Kunde inte ladda ordlistan.");
        return false;
    }
}

// =========================
// START NEW GAME
// =========================

function newGame() {
    wordLength = Number(lengthSelector.value);

    currentGuess = "";
    guesses = [];
    gameOver = false;
    keyStates = {};

    board.innerHTML = "";
    keyboard.innerHTML = "";

    restartButton.hidden = true;

    showMessage("");

    board.style.setProperty("--word-length", wordLength);

    if (!wordLists[wordLength] || wordLists[wordLength].length === 0) {
        showMessage("Inga ord med denna längd.");
        return;
    }

    const words = wordLists[wordLength];

    answer = words[Math.floor(Math.random() * words.length)];

    createBoard();
    createKeyboard();
    updateBoard();
}

// =========================
// CREATE GAME BOARD
// =========================

function createBoard() {
    for (let row = 0; row < MAX_GUESSES; row++) {
        for (let col = 0; col < wordLength; col++) {
            const tile = document.createElement("div");

            tile.classList.add("tile");
            tile.dataset.row = row;
            tile.dataset.col = col;

            board.appendChild(tile);
        }
    }
}

// =========================
// CREATE KEYBOARD
// =========================

function createKeyboard() {
    KEYBOARD_ROWS.forEach(rowLetters => {
        const row = document.createElement("div");

        row.classList.add("keyboard-row");

        rowLetters.forEach(letter => {
            const button = document.createElement("button");

            button.type = "button";
            button.classList.add("key");

            button.dataset.key = letter;

            if (letter === "ENTER" || letter === "BACKSPACE") {
                button.classList.add("wide");

                button.textContent =
                    letter === "ENTER" ? "ENTER" : "⌫";
            } else {
                button.textContent = letter;
            }

            button.addEventListener("click", () => {
                handleInput(letter);
            });

            row.appendChild(button);
        });

        keyboard.appendChild(row);
    });
}

// =========================
// INPUT HANDLING
// =========================

function handleInput(key) {
    if (gameOver) return;

    if (key === "ENTER") {
        submitGuess();
        return;
    }

    if (key === "BACKSPACE") {
        currentGuess = Array.from(currentGuess)
            .slice(0, -1)
            .join("");

        updateBoard();
        return;
    }

    if (!/^[A-ZÅÄÖ]$/.test(key)) return;

    if (Array.from(currentGuess).length >= wordLength) return;

    currentGuess += key;

    updateBoard();
}

// Physical keyboard
document.addEventListener("keydown", event => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    if (event.key === "Enter") {
        event.preventDefault();
        handleInput("ENTER");
    } else if (event.key === "Backspace") {
        event.preventDefault();
        handleInput("BACKSPACE");
    } else {
        const key = event.key.toLocaleUpperCase("sv-SE");

        if (/^[A-ZÅÄÖ]$/.test(key)) {
            handleInput(key);
        }
    }
});

// =========================
// UPDATE BOARD
// =========================

function updateBoard() {
    const letters = Array.from(currentGuess);

    for (let col = 0; col < wordLength; col++) {
        const tile = board.querySelector(
            `[data-row="${guesses.length}"][data-col="${col}"]`
        );

        if (!tile) continue;

        tile.textContent = letters[col] || "";
        tile.classList.toggle("filled", !!letters[col]);
    }
}

// =========================
// SUBMIT GUESS
// =========================

function submitGuess() {
    if (gameOver) return;

    if (Array.from(currentGuess).length !== wordLength) {
        showMessage("Fel antal bokstäver.");
        return;
    }

    if (!wordLists[wordLength].includes(currentGuess)) {
        showMessage("Ordet finns inte i ordlistan.");
        return;
    }

    showMessage("");

    const guess = currentGuess;
    const result = checkGuess(guess);

    guesses.push({
        word: guess,
        result: result
    });

    updateGuessRow(guess, result);
    updateKeyboard(guess, result);

    currentGuess = "";

    // WIN
    if (guess === answer) {
        gameOver = true;

        showMessage(`Grattis! Det tog ${guesses.length} försök.`);
        restartButton.hidden = false;

        return;
    }

    // LOSS
    if (guesses.length >= MAX_GUESSES) {
        gameOver = true;

        showMessage(`Tyvärr! Ordet var ${answer}.`);
        restartButton.hidden = false;

        return;
    }

    updateBoard();
}

// =========================
// CHECK GUESS
// =========================

// 0 = correct position
// 1 = wrong position
// 2 = incorrect letter

function checkGuess(guess) {
    const guessLetters = Array.from(guess);
    const answerLetters = Array.from(answer);

    const result = Array(wordLength).fill(2);
    const remaining = [...answerLetters];

    // First pass: correct positions
    for (let i = 0; i < wordLength; i++) {
        if (guessLetters[i] === answerLetters[i]) {
            result[i] = 0;
            remaining[i] = null;
        }
    }

    // Second pass: wrong positions
    for (let i = 0; i < wordLength; i++) {
        if (result[i] === 0) continue;

        const index = remaining.indexOf(guessLetters[i]);

        if (index !== -1) {
            result[i] = 1;
            remaining[index] = null;
        }
    }

    return result;
}

// =========================
// UPDATE GUESS ROW
// =========================

function updateGuessRow(guess, result) {
    const letters = Array.from(guess);
    const row = guesses.length - 1;

    for (let col = 0; col < wordLength; col++) {
        const tile = board.querySelector(
            `[data-row="${row}"][data-col="${col}"]`
        );

        tile.classList.remove("filled");

        if (result[col] === 0) {
            tile.classList.add("correct");
        } else if (result[col] === 1) {
            tile.classList.add("present");
        } else {
            tile.classList.add("absent");
        }
    }
}

// =========================
// UPDATE KEYBOARD COLORS
// =========================

function updateKeyboard(guess, result) {
    const letters = Array.from(guess);

    const priority = {
        absent: 1,
        present: 2,
        correct: 3
    };

    const classes = [
        "correct",
        "present",
        "absent"
    ];

    for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        const state = classes[result[i]];

        if (
            !keyStates[letter] ||
            priority[state] > priority[keyStates[letter]]
        ) {
            keyStates[letter] = state;
        }
    }

    Object.entries(keyStates).forEach(([letter, state]) => {
        const button = keyboard.querySelector(
            `[data-key="${letter}"]`
        );

        if (!button) return;

        button.classList.remove(...classes);
        button.classList.add(state);
    });
}

// =========================
// MESSAGES
// =========================

function showMessage(text) {
    message.textContent = text;
}

// =========================
// CHANGE WORD LENGTH
// =========================

lengthSelector.addEventListener("change", () => {
    newGame();
});

// =========================
// RESTART BUTTON
// =========================

restartButton.addEventListener("click", () => {
    newGame();
});

// =========================
// INITIALIZE
// =========================

async function initializeGame() {
    lengthSelector.disabled = true;
    restartButton.hidden = true;

    showMessage("Laddar ordlista...");

    const loaded = await loadWordList();

    lengthSelector.disabled = false;

    if (loaded) {
        newGame();
    }
}

initializeGame();
