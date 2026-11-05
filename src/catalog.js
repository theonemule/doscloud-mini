"use strict";

const fs = require("node:fs");
const path = require("node:path");

class GameValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "GameValidationError";
  }
}

function textField(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new GameValidationError(field + " must be 1-" + max + " characters");
  }
  return value.trim();
}

function validateGame(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new GameValidationError("A game must be a JSON object");
  }
  if (typeof input.id !== "string" || !/^[a-z][a-z0-9-]{2,39}$/.test(input.id)) {
    throw new GameValidationError("id must be 3-40 lowercase letters, numbers or hyphens, starting with a letter");
  }
  const game = {
    id: input.id,
    title: textField(input.title, "title", 80),
    description: textField(input.description, "description", 240),
    kind: input.kind
  };
  if (game.kind === "tap") {
    const duration = input.durationSeconds ?? 20;
    if (!Number.isInteger(duration) || duration < 5 || duration > 60) {
      throw new GameValidationError("durationSeconds must be an integer from 5 to 60");
    }
    game.durationSeconds = duration;
    game.targetLabel = textField(input.targetLabel ?? "STAR", "targetLabel", 20);
  } else if (game.kind === "quiz") {
    if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 10) {
      throw new GameValidationError("quiz requires 1-10 questions");
    }
    game.questions = input.questions.map((q) => {
      if (!q || typeof q !== "object" || !Array.isArray(q.answers) ||
          q.answers.length < 2 || q.answers.length > 4) {
        throw new GameValidationError("each question requires 2-4 answers");
      }
      if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.answers.length) {
        throw new GameValidationError("correctIndex must reference an answer");
      }
      return {
        prompt: textField(q.prompt, "question prompt", 140),
        answers: q.answers.map((a) => textField(a, "answer", 80)),
        correctIndex: q.correctIndex
      };
    });
  } else {
    throw new GameValidationError("kind must be tap or quiz");
  }
  return game;
}

function listGames(directory) {
  fs.mkdirSync(directory, { recursive: true });
  return fs.readdirSync(directory)
    .filter((name) => /^[a-z][a-z0-9-]*\.json$/.test(name))
    .sort()
    .map((name) => validateGame(JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"))));
}

function importGame(directory, payload) {
  const game = validateGame(payload);
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, game.id + ".json");
  fs.writeFileSync(filename, JSON.stringify(game, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  return game;
}

module.exports = { GameValidationError, validateGame, listGames, importGame };
