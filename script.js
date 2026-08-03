import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.min.mjs';

// Pdf.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.54/pdf.worker.min.mjs';

// Flex PDF
const pdfName = document.querySelector('.pdf-name');
const pdfCard = document.querySelector('.pdf-card');
const removePdf = document.querySelector('.remove-pdf');

// PDF text section
const displayText = document.querySelector('#pdf-text');

// Chapters section
const chapterOverlay = document.querySelector('#chapter-overlay');
const backBtn = document.querySelector('#back-btn');
const overlayTitle = document.querySelector('#overlay-title');
const closeChapters = document.querySelector('#close-chapters');
const overlayContent = document.querySelector('#overlay-content');
const openChapters = document.querySelector('#open-chapters');

// Control Section
const voiceSelect = document.querySelector('#voice-select');

// Pitch Control
const pitch = document.querySelector('#pitch');
const decrease = document.querySelector('#decrease');
const increase = document.querySelector('#increase');

// Speaking
let isSpeaking = false;

// Background Theme Toggle
document.querySelector('#theme-toggle').addEventListener('click', () => {
  const html = document.querySelector('html');
  if (html.dataset.theme != 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else {
    html.removeAttribute('data-theme', 'dark');
  }
});

let currentChapterText = '';
let utterance = null;
let currentPosition = 0;
let selectedVoice = null;
// To get voices
let voices = [];
// current section
let currentSections = [];
let navigationStack = [];
let currentPdf = null;
let currentOutline = [];
let currentMenu = 'sections';
let isPaused = false;
let currentChunks = [];
let currentChunkIndex = 0;

async function getText(e) {
  try {
    displayText.textContent = 'Loading PDF...';

    const file = e.target.files[0];

    if (!file) {
      displayText.textContent = 'No PDF selected.';
      return;
    }

    pdfName.textContent = file.name;
    pdfCard.style.display = 'flex';

    const arrayBuffer = await file.arrayBuffer();

    // The pdf.js opens it and understands it
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise;

    // Gets Outline of how the pdf is structured
    const outline = await pdf.getOutline();

    currentPdf = pdf;
    currentOutline = outline;

    // Clear previous UI
    displayText.textContent = 'Select a chapter to begin reading.';

    // Check to see if it has an outline or not
    if (outline && outline.length > 0) {
      showOutlineMenu(outline);

      chapterOverlay.classList.add('active');
    } else {
      displayText.textContent = 'This PDF does not contain a chapter outline.';
    }
  } catch (error) {
    console.log(error);

    displayText.textContent = 'Could not load PDF. Please try another file.';
  }
}

async function extractPages(pdf, startPage, endPage) {
  let fullText = '';

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
    const page = await pdf.getPage(pageNumber);

    const textContent = await page.getTextContent();

    const pageText = textContent.items.map((item) => item.str).join(' ');

    fullText = fullText + pageText + '\n\n';
  }

  return fullText.replace(/\s+/g, ' ').replace(/([.!?])\s+/g, '$1\n');
}

const ONES = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
};

function wordToNumber(raw) {
  const cleaned = raw.trim().toLowerCase().replace(/-/g, ' ');
  const parts = cleaned.split(/\s+/);

  if (parts.length === 1) {
    return ONES[parts[0]] ?? TENS[parts[0]] ?? null;
  }
  return (TENS[parts[0]] ?? 0) + (ONES[parts[1]] ?? 0);
}

function splitIntoChapters(text) {
  // const regex =
  //   /Chapter\s+(\d{1,2}|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen|Sixteen|Seventeen|Eighteen|Nineteen|Twenty)\b/gi;

  // const matches = text.match(/Chapter\s+\S+/gi);
  // console.log(matches);

  const WORD_NUMBER_PATTERN =
    '(?:' +
    '(?:' +
    Object.keys(TENS).join('|') +
    ')(?:[\\s-](?:' +
    Object.keys(ONES).slice(0, 9).join('|') +
    '))?' +
    '|' +
    Object.keys(ONES).join('|') +
    ')';

  const regex = new RegExp(`Chapter\\s+(${WORD_NUMBER_PATTERN})\\b`, 'gi');

  const chapters = text.split(regex);

  // No chapter headings found
  if (chapters.length === 1) {
    return [
      {
        title: 'Read Section',
        text,
      },
    ];
  }

  const chapterObjects = [];

  for (let i = 1; i < chapters.length; i += 2) {
    chapterObjects.push({
      title: `Chapter ${wordToNumber(chapters[i])}`,
      text: chapters[i + 1],
    });
  }
  return chapterObjects;
}

function showOutlineMenu(outline) {
  currentMenu = 'sections';
  overlayTitle.textContent = 'Contents';

  overlayContent.innerHTML = '';

  outline.forEach((chapter, index) => {
    const button = document.createElement('button');

    button.className = 'chapter-btn';
    button.innerHTML = `
        <span>${chapter.title}</span>
        <span>›</span>
    `;

    button.addEventListener('click', () => {
      showSectionMenu(index);
    });

    overlayContent.appendChild(button);
  });
}

async function showSectionMenu(index) {
  const chapter = currentOutline[index];

  const pageRef = chapter.dest[0];

  const pageIndex = await currentPdf.getPageIndex(pageRef);

  const startPage = pageIndex + 1;

  let endPage;

  if (currentOutline[index + 1]) {
    const nextPageRef = currentOutline[index + 1].dest[0];

    const nextIndex = await currentPdf.getPageIndex(nextPageRef);

    endPage = nextIndex;
  } else {
    endPage = currentPdf.numPages;
  }

  currentChapterText = await extractPages(currentPdf, startPage, endPage);
  ``;

  currentSections = splitIntoChapters(currentChapterText);
  // console.log(currentSections.map((section) => section.title));

  showReadMenu(currentSections);
}

function showReadMenu(sections) {
  currentMenu = 'contents';
  overlayTitle.textContent = 'Select Section';

  overlayContent.innerHTML = '';

  sections.forEach((section) => {
    const button = document.createElement('button');

    button.className = 'chapter-btn';

    button.innerHTML = `
        <span>${section.title}</span>
        <span>📖</span>
    `;

    button.addEventListener('click', () => {
      currentChapterText = section.text;

      displayText.innerHTML = '';

      const paragraphs = section.text
        .split('\n')
        .filter((paragraph) => paragraph.trim() !== '');

      paragraphs.forEach((paragraph) => {
        const p = document.createElement('p');
        p.textContent = paragraph;
        p.classList.add('speech-paragraph');

        displayText.appendChild(p);
      });

      displayText.scrollTop = 0;

      chapterOverlay.classList.remove('active');

      showOutlineMenu(currentOutline);
    });

    overlayContent.appendChild(button);
  });
}

const input = document.querySelector('#pdf-file');
input.addEventListener('change', getText);

const playBtn = document.querySelector('#read-btn');
const pauseBtn = document.querySelector('#pause-btn');
const resumeBtn = document.querySelector('#resume-btn');
const stopBtn = document.querySelector('#stop-btn');

function loadVoices() {
  voices = speechSynthesis.getVoices();

  voiceSelect.innerHTML = '';

  const englishVoices = voices.filter((voice) => voice.lang.startsWith('en'));

  voices.forEach((voice) => {
    const option = document.createElement('option');

    option.value = voice.name;
    option.textContent = `${voice.name} `;

    if (voice.default) {
      option.innerHTML += ' <strong>       (-DEFAULT)</strong>';
    }

    voiceSelect.appendChild(option);
  });
}
loadVoices();

speechSynthesis.onvoiceschanged = loadVoices;

function chunkText() {
  const paragraphs = document.querySelectorAll('.speech-paragraph');

  const chunks = [];

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const sentences = paragraph.textContent.match(/[^.!?]+[.!?]+|\s*$/g) || [
      paragraph.textContent,
    ];

    let current = '';

    sentences.forEach((sentence) => {
      if ((current + sentence).length > 200 && current) {
        chunks.push({
          text: current.trim(),
          paragraph: paragraphIndex,
        });

        current = sentence;
      } else {
        current += sentence;
      }
    });

    if (current.trim()) {
      chunks.push({
        text: current.trim(),
        paragraph: paragraphIndex,
      });
    }
  });

  return chunks;
}

function highlightParagraph(index) {
  const paragraphs = document.querySelectorAll('.speech-paragraph');

  // Remove the previous highlight
  paragraphs.forEach((paragraph) => {
    paragraph.classList.remove('active');
  });

  // Highlight the current paragraph
  if (paragraphs[index]) {
    paragraphs[index].classList.add('active');

    const paragraph = paragraphs[index];

    paragraph.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

function speakChunks(chunks, index = 0) {
  currentChunks = chunks;
  currentChunkIndex = index;
  isPaused = false;

  if (index >= chunks.length) return;

  highlightParagraph(chunks[index].paragraph);

  utterance = new SpeechSynthesisUtterance(chunks[index].text);

  const selectedVoice = voices.find(
    (voice) => voice.name === voiceSelect.value,
  );

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.pitch = Number(pitch.value);

  utterance.onend = () => {
    if (!isPaused) {
      if (index + 1 < chunks.length) {
        speakChunks(chunks, index + 1);
      } else {
        isSpeaking = false;
        playBtn.disabled = false;
      }
    }
  };

  utterance.onerror = (e) => {
    console.log(e.error);
  };

  isSpeaking = true;
  playBtn.disabled = true;

  speechSynthesis.speak(utterance);
}

playBtn.addEventListener('click', () => {
  if (isSpeaking) return;

  if (!currentChapterText) {
    alert('Please select a chapter first.');
    return;
  }

  speechSynthesis.cancel();
  speakChunks(chunkText());
});

pauseBtn.addEventListener('click', () => {
  isPaused = true;
  speechSynthesis.cancel();
});

resumeBtn.addEventListener('click', () => {
  if (isPaused) {
    speakChunks(currentChunks, currentChunkIndex);
  }
});

stopBtn.addEventListener('click', () => {
  speechSynthesis.cancel();
  utterance = null;

  isSpeaking = false;
  playBtn.disabled = false;
});

removePdf.addEventListener('click', () => {
  // Remove PDF card
  pdfCard.style.display = 'none';
  pdfName.textContent = '';

  // Reset
  isSpeaking = false;
  playBtn.disabled = false;

  // Clear chapters

  overlayContent.innerHTML = '';

  // Clear displayed text
  displayText.textContent = 'Select a PDF to begin reading.';

  // Stop speech
  speechSynthesis.cancel();

  // Reset speech variables
  utterance = null;
  currentChapterText = '';

  // Reset file input
  input.value = '';
});

backBtn.addEventListener('click', () => {
  if (overlayTitle.textContent === 'Select Section') {
    showOutlineMenu(currentOutline);
  } else {
    chapterOverlay.classList.remove('active');
  }
});

openChapters.addEventListener('click', () => {
  chapterOverlay.classList.add('active');
});

closeChapters.addEventListener('click', () => {
  chapterOverlay.classList.remove('active');
});

increase.addEventListener('click', () => {
  pitch.stepUp();
  pitch.dispatchEvent(new Event('change'));
});

decrease.addEventListener('click', () => {
  pitch.stepDown();
  pitch.dispatchEvent(new Event('change'));
});
