/* M1 English content. Source: English_M1_Course_Mapping.xlsx (page plans) and
   M1_Letter_Pages_BulkCreate.xlsx (words, cues). Edit here, then ask Claude to
   regenerate the audio (tools/build.py). */
var CONTENT = (function () {
  'use strict';

  // 9 theme colours rotate A→Z, same as the printed book.
  var COLOURS = [
    ['#E5484D', '#FDECEC'], ['#1E7BE0', '#E8F1FC'], ['#2FB45A', '#E6F7EC'],
    ['#F5883A', '#FEF0E6'], ['#A445C9', '#F5EAFA'], ['#13A8B8', '#E4F6F8'],
    ['#E8457A', '#FDEAF1'], ['#5B4FE0', '#ECEAFC'], ['#E8A800', '#FDF5DC']
  ];

  // pic: emoji; alt: fallback emoji for older panels that can't show the first one.
  // svg: simple drawing where no emoji exists.
  var LETTERS = {
    A: { cue: 'A says ऐ, as in apple', words: [['APPLE', '🍎'], ['ANT', '🐜'], ['AXE', '🪓', '🔨']] },
    B: { cue: 'B says ब्, as in ball', words: [['BALL', '⚽'], ['BANANA', '🍌'], ['BUS', '🚌']] },
    C: { cue: 'C says क्, as in cat', words: [['CAT', '🐱'], ['COW', '🐄'], ['CAR', '🚗']] },
    D: { cue: 'D says ड्, as in dog', words: [['DOG', '🐶'], ['DUCK', '🦆'], ['DOLL', '🪆', '👧']] },
    E: { cue: 'E says ए, as in elephant', words: [['ELEPHANT', '🐘'], ['EGG', '🥚'], ['ELBOW', '💪']] },
    F: { cue: 'F says फ़्, as in fish', words: [['FISH', '🐟'], ['FAN', '🪭', '🌀'], ['FLOWER', '🌸']] },
    G: { cue: 'G says ग्, as in goat', words: [['GOAT', '🐐'], ['GRAPES', '🍇'], ['GIRL', '👧']] },
    H: { cue: 'H says ह्, as in hat', words: [['HAT', '👒'], ['HEN', '🐔'], ['HAND', '✋']] },
    I: { cue: 'I says इ, as in igloo', words: [['IGLOO', 'svg:igloo'], ['INK', '🖋️'], ['INSECT', '🐞']] },
    J: { cue: 'J says ज्, as in jug', words: [['JUG', '🫗', '🏺'], ['JUICE', '🧃'], ['JEEP', '🚙']] },
    K: { cue: 'K says क्, as in kite', words: [['KITE', '🪁', '🎏'], ['KEY', '🔑'], ['KITTEN', '🐈']] },
    L: { cue: 'L says ल्, as in lion', words: [['LION', '🦁'], ['LEMON', '🍋'], ['LOLLIPOP', '🍭']] },
    M: { cue: 'M says म्, as in mango', words: [['MANGO', '🥭'], ['MONKEY', '🐒'], ['MILK', '🥛']] },
    N: { cue: 'N says न्, as in nest', words: [['NEST', '🪹', '🐣'], ['NOSE', '👃'], ['NUT', '🥜']] },
    O: { cue: 'O says ऑ, as in orange', words: [['ORANGE', '🍊'], ['OX', '🐂'], ['OCTOPUS', '🐙']] },
    P: { cue: 'P says प्, as in parrot', words: [['PARROT', '🦜'], ['PEACOCK', '🦚'], ['POT', '🪴', '🍯']] },
    Q: { cue: 'Q says क्व्, as in queen', words: [['QUEEN', '👸'], ['QUILT', 'svg:quilt'], ['QUESTION MARK', '❓']] },
    R: { cue: 'R says र्, as in rabbit', words: [['RABBIT', '🐰'], ['RING', '💍'], ['ROSE', '🌹']] },
    S: { cue: 'S says स्, as in sun', words: [['SUN', '☀️'], ['STAR', '⭐'], ['SPOON', '🥄']] },
    T: { cue: 'T says ट्, as in tiger', words: [['TIGER', '🐯'], ['TOMATO', '🍅'], ['TOY', '🧸']] },
    U: { cue: 'U says अ, as in umbrella', words: [['UMBRELLA', '☂️'], ['UNCLE', '👨'], ['UP', '⬆️']] },
    V: { cue: 'V says व्, as in van', words: [['VAN', '🚐'], ['VEGETABLES', '🥦'], ['VIOLIN', '🎻']] },
    W: { cue: 'W says व्, as in watermelon', words: [['WATERMELON', '🍉'], ['WATCH', '⌚'], ['WHEEL', '🛞', '⚙️']] },
    X: { cue: 'X says क्स्, as in X-mas', words: [['X-MAS', '🎄'], ['BOX', '📦'], ['FOX', '🦊']] },
    Y: { cue: 'Y says य्, as in yo-yo', words: [['YO-YO', '🪀', '🔴'], ['YELLOW', '🟡'], ['YARN', '🧶']] },
    Z: { cue: 'Z says ज़्, as in zebra', words: [['ZEBRA', '🦓'], ['ZIP', '🤐'], ['ZOO', '🦒']] }
  };

  // Print-capital stroke order, drawn in a 300 x 300 box (top 34, middle 150, bottom 266).
  var STROKES = {
    A: ['M150 34 L62 266', 'M150 34 L238 266', 'M96 180 L204 180'],
    B: ['M92 34 L92 266', 'M92 34 L168 34 C236 34 236 150 168 150 L92 150', 'M92 150 L178 150 C252 150 252 266 178 266 L92 266'],
    C: ['M226 80 C200 36 140 26 104 56 C60 92 60 208 104 244 C140 274 200 264 226 220'],
    D: ['M88 34 L88 266', 'M88 34 L140 34 C250 34 250 266 140 266 L88 266'],
    E: ['M92 34 L92 266', 'M92 34 L214 34', 'M92 150 L196 150', 'M92 266 L214 266'],
    F: ['M92 34 L92 266', 'M92 34 L214 34', 'M92 150 L196 150'],
    G: ['M228 80 C202 36 140 26 104 56 C60 92 60 208 104 244 C150 280 228 258 228 170 L228 160', 'M228 160 L164 160'],
    H: ['M80 34 L80 266', 'M220 34 L220 266', 'M80 150 L220 150'],
    I: ['M150 34 L150 266', 'M100 34 L200 34', 'M100 266 L200 266'],
    J: ['M196 34 L196 200 C196 284 88 284 82 212'],
    K: ['M88 34 L88 266', 'M222 34 L88 172', 'M132 126 L226 266'],
    L: ['M96 34 L96 266', 'M96 266 L214 266'],
    M: ['M66 266 L66 34', 'M66 34 L150 182', 'M150 182 L234 34', 'M234 34 L234 266'],
    N: ['M76 266 L76 34', 'M76 34 L224 266', 'M224 266 L224 34'],
    O: ['M150 34 C84 34 62 100 62 150 C62 214 96 266 150 266 C204 266 238 214 238 150 C238 86 204 34 150 34'],
    P: ['M92 34 L92 266', 'M92 34 L168 34 C240 34 240 158 168 158 L92 158'],
    Q: ['M150 34 C84 34 62 100 62 150 C62 214 96 266 150 266 C204 266 238 214 238 150 C238 86 204 34 150 34', 'M166 196 L238 274'],
    R: ['M92 34 L92 266', 'M92 34 L168 34 C240 34 240 156 168 156 L92 156', 'M150 156 L228 266'],
    S: ['M222 72 C196 30 90 26 86 88 C82 150 216 140 220 210 C224 278 100 280 74 232'],
    T: ['M70 34 L230 34', 'M150 34 L150 266'],
    U: ['M76 34 L76 180 C76 290 224 290 224 180 L224 34'],
    V: ['M64 34 L150 266', 'M150 266 L236 34'],
    W: ['M40 34 L96 266', 'M96 266 L150 92', 'M150 92 L204 266', 'M204 266 L260 34'],
    X: ['M72 34 L228 266', 'M228 34 L72 266'],
    Y: ['M72 34 L150 150', 'M228 34 L150 150', 'M150 150 L150 266'],
    Z: ['M72 34 L228 34', 'M228 34 L72 266', 'M72 266 L228 266']
  };

  // Pre-writing skills: which shape the child traces.
  var SKILLS = {
    standing: { title: 'Standing Line', shape: 'standing' },
    sleeping: { title: 'Sleeping Line', shape: 'sleeping' },
    circle: { title: 'Circle', shape: 'circle' },
    cross: { title: 'Standing + Sleeping Cross', shape: 'cross' },
    square: { title: 'Square', shape: 'square' },
    diagonal: { title: 'Diagonal Line', shape: 'diagonal' },
    triangle: { title: 'Triangle', shape: 'triangle' }
  };

  // Page order = the printed book. Each entry covers one or two book pages.
  var BOOKS = {
    1: {
      title: 'Book 1 · A–N', pages: 47,
      items: [
        { type: 'chart', pages: [1] },
        { type: 'prewriting', skill: 'standing', scene: '🎈', word: 'balloon', say: 'Trace the strings on the balloons.', pages: [2, 3] },
        { type: 'letter', letter: 'A', pages: [4, 5] },
        { type: 'letter', letter: 'B', pages: [6, 7] },
        { type: 'prewriting', skill: 'standing', scene: '🌧️', word: 'rain', say: 'Trace the raindrops falling down.', pages: [8, 9] },
        { type: 'letter', letter: 'C', pages: [10, 11] },
        { type: 'letter', letter: 'D', pages: [12, 13] },
        { type: 'prewriting', skill: 'sleeping', scene: '🚌', word: 'bus', say: 'Trace the road lines to the school.', pages: [14, 15] },
        { type: 'letter', letter: 'E', pages: [16, 17] },
        { type: 'letter', letter: 'F', pages: [18, 19] },
        { type: 'prewriting', skill: 'sleeping', scene: '🐦', word: 'bird', say: 'Trace the flight lines to the nests.', pages: [20, 21] },
        { type: 'letter', letter: 'G', pages: [22, 23] },
        { type: 'letter', letter: 'H', pages: [24, 25] },
        { type: 'prewriting', skill: 'circle', scene: '🫧', alt: '🔵', word: 'bubble', say: 'Trace the round bubbles.', pages: [26, 27] },
        { type: 'letter', letter: 'I', pages: [28, 29] },
        { type: 'letter', letter: 'J', pages: [30, 31] },
        { type: 'prewriting', skill: 'circle', scene: '👕', word: 'button', say: 'Trace the round buttons.', pages: [32, 33] },
        { type: 'letter', letter: 'K', pages: [34, 35] },
        { type: 'letter', letter: 'L', pages: [36, 37] },
        { type: 'prewriting', skill: 'cross', scene: '🪁', alt: '🎏', word: 'kite', say: 'Trace the cross on each kite.', pages: [38, 39] },
        { type: 'letter', letter: 'M', pages: [40, 41] },
        { type: 'letter', letter: 'N', pages: [42, 43] },
        { type: 'prewriting', skill: 'circle', scene: '🌸', word: 'flower', say: 'Trace the round petals.', pages: [44, 45] },
        { type: 'colourletters', pages: [46, 47] }
      ]
    },
    2: {
      title: 'Book 2 · O–Z', pages: 43,
      items: [
        { type: 'chart', pages: [1] },
        { type: 'prewriting', skill: 'cross', scene: '🪟', alt: '🏠', word: 'window', say: 'Trace the cross on each window.', pages: [2, 3] },
        { type: 'letter', letter: 'O', pages: [4, 5] },
        { type: 'letter', letter: 'P', pages: [6, 7] },
        { type: 'prewriting', skill: 'circle', scene: '🚲', word: 'wheel', say: 'Trace the round wheels.', pages: [8, 9] },
        { type: 'letter', letter: 'Q', pages: [10, 11] },
        { type: 'letter', letter: 'R', pages: [12, 13] },
        { type: 'prewriting', skill: 'square', scene: '🎁', word: 'gift', say: 'Trace the square on each gift.', pages: [14, 15] },
        { type: 'letter', letter: 'S', pages: [16, 17] },
        { type: 'letter', letter: 'T', pages: [18, 19] },
        { type: 'prewriting', skill: 'square', scene: '🧱', word: 'block', say: 'Trace the square blocks.', pages: [20, 21] },
        { type: 'letter', letter: 'U', pages: [22, 23] },
        { type: 'letter', letter: 'V', pages: [24, 25] },
        { type: 'prewriting', skill: 'diagonal', scene: '🛝', alt: '🎢', word: 'slide', say: 'Trace the slanting slides.', pages: [26, 27] },
        { type: 'letter', letter: 'W', pages: [28, 29] },
        { type: 'letter', letter: 'X', pages: [30, 31] },
        { type: 'prewriting', skill: 'diagonal', scene: '⛰️', word: 'mountain', say: 'Trace the slanting mountain sides.', pages: [32, 33] },
        { type: 'letter', letter: 'Y', pages: [34, 35] },
        { type: 'letter', letter: 'Z', pages: [36, 37] },
        { type: 'prewriting', skill: 'triangle', scene: '⛺', word: 'tent', say: 'Trace the triangle on each tent.', pages: [38, 39] },
        { type: 'blank', pages: [40, 41] },
        { type: 'colourletters', pages: [42, 43] }
      ]
    }
  };

  // Periwinkle "Phonics Letter X with Four Words" videos. Empty = no video button yet.
  var VIDEOS = { A: 'y6X_8nsZwec', B: 'F4m2w7irgUg' };

  function slug(word) { return word.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, ''); }

  // Fill in the derived fields (title, colour, audio file names) for every letter.
  Object.keys(LETTERS).forEach(function (key, i) {
    var L = LETTERS[key];
    var main = L.words[0][0];
    L.key = key;
    L.title = key + ' is for ' + main.charAt(0) + main.slice(1).toLowerCase();
    L.color = COLOURS[i % 9][0];
    L.tint = COLOURS[i % 9][1];
    L.strokes = STROKES[key];
    L.video = VIDEOS[key] || '';
    L.words = L.words.map(function (w) { return { name: w[0], pic: w[1], alt: w[2] || '', audio: 'w_' + slug(w[0]) }; });
  });

  // The Home page: outer blocks are subjects, inside them are books. A book belongs to a class level (1 = M1, 2 = M2, 3 = M3).
  // To add a book: add its pages to BOOKS above (keyed by its number), then add a line to CATALOGUE.
  var SUBJECTS = [
    { id: 'rhymes', name: 'LMS Rhymes', icon: '🎵', color: '#E8457A' },
    { id: 'english', name: 'English', icon: '🔤', color: '#1E7BE0' },
    { id: 'hindi', name: 'Hindi', icon: 'अ', color: '#F5883A' },
    { id: 'maths', name: 'Maths', icon: '123', color: '#2FB45A' },
    { id: 'ga', name: 'General Awareness', icon: '🌍', color: '#A445C9' }
  ];
  var CATALOGUE = [
    { key: '1', subject: 'english', level: '1', title: 'Book 1', range: 'A–N', term: 'Term 1' },
    { key: '2', subject: 'english', level: '1', title: 'Book 2', range: 'O–Z', term: 'Term 2' }
  ];

  return { LETTERS: LETTERS, SKILLS: SKILLS, BOOKS: BOOKS, COLOURS: COLOURS, SUBJECTS: SUBJECTS, CATALOGUE: CATALOGUE, slug: slug };
})();
