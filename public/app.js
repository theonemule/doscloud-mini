"use strict";

const byId = (id) => document.getElementById(id);
const state = { games: [], rooms: [], activeRoom: null, playerId: null, events: null };

function element(tag, className, content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
}

function status(message, isError = false) {
  const box = byId("status");
  box.textContent = message;
  box.className = isError ? "status error" : "status";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) throw new Error(body.error || "Request failed: " + response.status);
  return body;
}

function addLabelled(parent, tag, className, content) {
  const child = element(tag, className, content);
  parent.appendChild(child);
  return child;
}

function renderGames() {
  const list = byId("game-list");
  const select = byId("room-game");
  list.replaceChildren();
  select.replaceChildren();
  byId("game-count").textContent = String(state.games.length);
  for (const game of state.games) {
    const card = addLabelled(list, "article", "game-card");
    addLabelled(card, "div", "game-icon", game.kind === "quiz" ? "◈" : "✦");
    addLabelled(card, "h3", null, game.title);
    addLabelled(card, "p", null, game.description);
    const launch = addLabelled(card, "button", null, "Launch game →");
    launch.type = "button";
    launch.addEventListener("click", () => launchGame(game));
    const option = document.createElement("option");
    option.value = game.id;
    option.textContent = game.title;
    select.appendChild(option);
  }
}

async function refreshGames() {
  state.games = (await api("/api/games")).games;
  renderGames();
}

function renderRooms() {
  const list = byId("room-list");
  list.replaceChildren();
  byId("room-count").textContent = String(state.rooms.length);
  if (!state.rooms.length) {
    addLabelled(list, "p", "muted small", "No rooms yet. Create the first one.");
    return;
  }
  for (const room of state.rooms) {
    const game = state.games.find((g) => g.id === room.gameId);
    const card = addLabelled(list, "div", "room-card");
    addLabelled(card, "b", null, (game?.title || room.gameId) + " · " + room.id);
    addLabelled(card, "p", null, room.players.length + " player(s) online");
    const join = addLabelled(card, "button", null, "Join room →");
    join.addEventListener("click", () => joinRoom(room.id));
  }
}

async function refreshRooms() {
  state.rooms = (await api("/api/rooms")).rooms;
  renderRooms();
}

function renderActiveRoom(room) {
  state.activeRoom = room;
  const box = byId("active-room");
  box.hidden = false;
  box.replaceChildren();
  addLabelled(box, "h3", null, "Live room " + room.id);
  addLabelled(box, "p", "muted small", "Open a second tab and join from the room list.");
  const ul = addLabelled(box, "ul");
  for (const player of room.players) {
    addLabelled(ul, "li", null, player.name + " — " + player.score + " points");
  }
}

function followRoom(room, playerId) {
  state.playerId = playerId;
  renderActiveRoom(room);
  if (state.events) state.events.close();
  state.events = new EventSource("/api/rooms/" + room.id + "/events");
  state.events.onmessage = (event) => {
    const update = JSON.parse(event.data);
    renderActiveRoom(update);
    refreshRooms().catch((error) => status(error.message, true));
  };
  state.events.onerror = () => status("Live room connection interrupted; browser will retry.", true);
  status("Connected to multiplayer room " + room.id + ". Launch that game to submit a score.");
}

async function createRoom() {
  try {
    const result = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ gameId: byId("room-game").value, name: byId("player-name").value || "Host" })
    });
    followRoom(result.room, result.playerId);
    await refreshRooms();
  } catch (error) { status(error.message, true); }
}

async function joinRoom(id) {
  try {
    const result = await api("/api/rooms/" + id + "/join", {
      method: "POST",
      body: JSON.stringify({ name: byId("player-name").value || "Guest" })
    });
    followRoom(result.room, result.playerId);
    await refreshRooms();
  } catch (error) { status(error.message, true); }
}

async function saveScore(gameId, score) {
  if (!state.activeRoom || state.activeRoom.gameId !== gameId || !state.playerId) {
    status("Finished with " + score + " points. Join a matching room to share your score.");
    return;
  }
  try {
    await api("/api/rooms/" + state.activeRoom.id + "/score", {
      method: "POST",
      body: JSON.stringify({ playerId: state.playerId, score })
    });
    status("Score " + score + " posted to live multiplayer room " + state.activeRoom.id + ".");
  } catch (error) { status(error.message, true); }
}

function launchGame(game) {
  const stage = byId("game-stage");
  stage.replaceChildren();
  addLabelled(stage, "h3", null, game.title);
  addLabelled(stage, "p", "muted", game.description);
  if (game.kind === "tap") launchTap(stage, game);
  if (game.kind === "quiz") launchQuiz(stage, game);
}

function launchTap(stage, game) {
  const scoreboard = addLabelled(stage, "p", "score", "0 points");
  const timerLabel = addLabelled(stage, "p", "muted", game.durationSeconds + " seconds to play");
  const target = addLabelled(stage, "button", "tap-target", game.targetLabel);
  target.disabled = true;
  const begin = addLabelled(stage, "button", "primary-button", "Start the game");
  let score = 0;
  let interval = null;
  begin.addEventListener("click", () => {
    if (interval) return;
    begin.disabled = true;
    target.disabled = false;
    let remaining = game.durationSeconds;
    interval = setInterval(() => {
      remaining -= 1;
      timerLabel.textContent = remaining + " seconds left";
      if (remaining <= 0) {
        clearInterval(interval);
        interval = null;
        target.disabled = true;
        begin.textContent = "Game over";
        saveScore(game.id, score);
      }
    }, 1000);
  });
  target.addEventListener("click", () => {
    if (target.disabled) return;
    score += 1;
    scoreboard.textContent = score + " points";
  });
}

function launchQuiz(stage, game) {
  let questionIndex = 0;
  let score = 0;
  const questionArea = addLabelled(stage, "div");
  function next() {
    questionArea.replaceChildren();
    if (questionIndex >= game.questions.length) {
      addLabelled(questionArea, "h3", null, "Finished! " + score + " / " + game.questions.length);
      saveScore(game.id, score);
      return;
    }
    const question = game.questions[questionIndex];
    addLabelled(questionArea, "p", "muted", "Question " + (questionIndex + 1) + " of " + game.questions.length);
    addLabelled(questionArea, "h3", null, question.prompt);
    question.answers.forEach((answer, index) => {
      const button = addLabelled(questionArea, "button", "quiz-answer", answer);
      button.addEventListener("click", () => {
        if (index === question.correctIndex) score += 1;
        questionIndex += 1;
        next();
      });
    });
  }
  next();
}

async function importFromFile(event) {
  const input = event.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error("Game JSON must be smaller than 64 KiB");
    const game = JSON.parse(await file.text());
    const result = await api("/api/games/import", { method: "POST", body: JSON.stringify(game) });
    await refreshGames();
    status(result.game.title + " imported into games/. Commit and push to preserve on GitHub.");
  } catch (error) {
    status(error.message, true);
  } finally {
    input.value = "";
  }
}

byId("create-room").addEventListener("click", createRoom);
byId("refresh-rooms").addEventListener("click", () => refreshRooms().catch((error) => status(error.message, true)));
byId("game-upload").addEventListener("change", importFromFile);
Promise.all([refreshGames(), refreshRooms()]).catch((error) => status(error.message, true));
