
const mazeEl = document.getElementById("maze");
const stackEl = document.getElementById("stackList");
const logEl = document.getElementById("log");

const $ = id => document.getElementById(id);

let rows = 21;
let cols = 21;
let grid = [];
let start = 0;
let end = 0;

let stack = [];
let visited = new Set();
let parent = new Map();
let path = new Set();
let current = -1;

let timer = null;
let paused = false;
let running = false;
let startedAt = 0;
let elapsed = 0;
let finalTime = 0;
let steps = 0;
let solution = [];

function neighbors(id) {
  const r = Math.floor(id / cols);
  const c = id % cols;
  const result = [];

  if (r > 0) result.push(id - cols);
  if (c < cols - 1) result.push(id + 1);
  if (r < rows - 1) result.push(id + cols);
  if (c > 0) result.push(id - 1);

  return result;
}

function log(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";

  const time = document.createElement("span");
  time.textContent = new Date().toLocaleTimeString() + " ";

  entry.append(time, document.createTextNode(message));
  logEl.prepend(entry);

  while (logEl.children.length > 80) {
    logEl.lastElementChild.remove();
  }
}

function resetSearch() {
  stopTimer();

  running = false;
  paused = false;
  stack = [];
  visited = new Set();
  parent = new Map();
  path = new Set();
  current = -1;
  solution = [];
  steps = 0;
  elapsed = 0;
  finalTime = 0;

  $("visitedCount").textContent = "0";
  $("pathCount").textContent = "0";
  $("stackCount").textContent = "0";
  $("timeCount").textContent = "0 ms";
  $("status").textContent = "Ready";
  $("pauseBtn").textContent = "Ⅱ Pause";

  renderMaze();
  renderStack();
}

function stopTimer() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function renderMaze() {
  mazeEl.replaceChildren();
  mazeEl.style.gridTemplateColumns =
    `repeat(${cols}, minmax(0, 1fr))`;

  const size = Math.max(
    9,
    Math.min(26, Math.floor(620 / cols))
  );

  for (let id = 0; id < grid.length; id++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.style.width = size + "px";
    cell.dataset.id = id;

    if (grid[id]) cell.classList.add("wall");
    if (visited.has(id)) cell.classList.add("visited");
    if (path.has(id)) cell.classList.add("path");
    if (id === start) cell.classList.add("start");
    if (id === end) cell.classList.add("finish");
    if (id === current) cell.classList.add("current");

    cell.title = `Row ${Math.floor(id / cols) + 1}, Column ${id % cols + 1}`;

    mazeEl.appendChild(cell);
  }
}

function renderStack() {
  stackEl.replaceChildren();

  $("stackCount").textContent = stack.length;

  if (!stack.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Stack is empty.";
    stackEl.appendChild(empty);
    return;
  }

  // The last array element is the stack top.
  stack.slice().reverse().slice(0, 100).forEach((id, i) => {
    const item = document.createElement("div");
    item.className = "stack-item";

    const label = document.createElement("span");
    label.textContent = i === 0 ? "TOP → " : "";
    label.textContent += `(${Math.floor(id / cols)}, ${id % cols})`;

    const number = document.createElement("span");
    number.textContent = `#${stack.length - i}`;

    item.append(label, number);
    stackEl.appendChild(item);
  });
}

function generateMaze() {
  stopTimer();

  rows = Number($("sizeSelect").value);
  cols = rows;

  grid = Array(rows * cols).fill(true);
  start = 0;
  end = grid.length - 1;

  // Randomized depth-first maze carving.
  const carveStack = [0];
  const carved = new Set([0]);
  grid[0] = false;

  while (carveStack.length) {
    const id = carveStack[carveStack.length - 1];
    const r = Math.floor(id / cols);
    const c = id % cols;

    const candidates = [];

    // Move two cells at a time, leaving walls between cells.
    if (r >= 2) candidates.push(id - 2 * cols);
    if (c + 2 < cols) candidates.push(id + 2);
    if (r + 2 < rows) candidates.push(id + 2 * cols);
    if (c >= 2) candidates.push(id - 2);

    const available = candidates.filter(n => !carved.has(n));

    if (!available.length) {
      carveStack.pop();
      continue;
    }

    const next = available[
      Math.floor(Math.random() * available.length)
    ];

    const between = (id + next) / 2;

    grid[between] = false;
    grid[next] = false;

    carved.add(between);
    carved.add(next);
    carveStack.push(next);
  }

  grid[start] = false;
  grid[end] = false;

  logEl.replaceChildren();
  resetSearch();
  log("New randomized maze generated.");
}

function setEdit(id) {
  if (running) return;

  const mode = $("editSelect").value;

  if (mode === "start") {
    if (id === end) return;
    start = id;
    grid[id] = false;
  } else if (mode === "end") {
    if (id === start) return;
    end = id;
    grid[id] = false;
  } else if (id !== start && id !== end) {
    grid[id] = mode === "wall";
  }

  resetSearch();
  log(`Cell ${id} edited: ${mode}.`);
}

mazeEl.addEventListener("click", event => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  setEdit(Number(cell.dataset.id));
});

function updateStats() {
  $("visitedCount").textContent = visited.size;
  $("pathCount").textContent = solution.length
    ? solution.length - 1
    : 0;

  const elapsedNow = running
    ? performance.now() - startedAt
    : finalTime;

  $("timeCount").textContent =
    Math.max(0, Math.round(elapsedNow)) + " ms";
}

function reconstructPath() {
  const result = [];
  let node = end;

  while (node !== undefined) {
    result.push(node);
    if (node === start) break;
    node = parent.get(node);
  }

  if (result[result.length - 1] !== start) return [];

  return result.reverse();
}

function finish(message, success = false) {
  stopTimer();
  running = false;
  paused = false;
  finalTime = performance.now() - startedAt;

  if (success) {
    solution = reconstructPath();
    path = new Set(solution);
    $("status").textContent = "Solved!";
    log(`Solution found! Path length: ${solution.length - 1}.`);
  } else {
    $("status").textContent = message;
    log(message);
  }

  renderMaze();
  renderStack();
  updateStats();
}

function solveMaze() {
  if (running || paused) return;

  if (grid[start] || grid[end]) {
    log("Start or finish is blocked.");
    return;
  }

  resetSearch();

  running = true;
  startedAt = performance.now();
  stack.push(start);
  visited.add(start);

  $("status").textContent = "Solving...";
  log("DFS started. Pushed start cell onto stack.");

  tick();
}

function tick() {
  if (!running || paused) return;

  if (!stack.length) {
    finish("No path found.");
    return;
  }

  const id = stack.pop();
  current = id;
  steps++;

  if (id === end) {
    finish("Solved!", true);
    return;
  }

  // Shuffle neighbors for variety in exploration order.
  const nextCells = neighbors(id).sort(() => Math.random() - 0.5);

  for (const next of nextCells) {
    if (grid[next] || visited.has(next)) continue;

    visited.add(next);
    parent.set(next, id);
    stack.push(next);
  }

  if (steps % 5 === 0) {
    log(`Visited ${id}; stack size: ${stack.length}.`);
  }

  renderMaze();
  renderStack();
  updateStats();

  timer = setTimeout(tick, Number($("speedRange").value));
}

function togglePause() {
  if (!running && !paused) return;

  if (paused) {
    paused = false;
    running = true;

    // Continue elapsed-time measurement without resetting it.
    startedAt = performance.now() - elapsed;
    $("pauseBtn").textContent = "Ⅱ Pause";
    $("status").textContent = "Solving...";
    tick();
  } else {
    elapsed = performance.now() - startedAt;
    paused = true;
    running = false;
    stopTimer();

    $("pauseBtn").textContent = "▶ Resume";
    $("status").textContent = "Paused";
    log("DFS paused.");
    updateStats();
  }
}

$("generateBtn").addEventListener("click", generateMaze);
$("solveBtn").addEventListener("click", solveMaze);
$("pauseBtn").addEventListener("click", togglePause);
$("resetBtn").addEventListener("click", () => {
  resetSearch();
  log("Search reset.");
});

$("sizeSelect").addEventListener("change", generateMaze);

$("speedRange").addEventListener("input", () => {
  $("speedValue").textContent = $("speedRange").value + " ms";
});

$("clearLogBtn").addEventListener("click", () => {
  logEl.replaceChildren();
});

$("themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");
});

generateMaze();
