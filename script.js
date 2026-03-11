"use strict";

const FILES = "abcdefgh";
const PIECE_TO_SYMBOL = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const movesEl = document.getElementById("moves");
const newGameBtn = document.getElementById("newGameBtn");
const undoBtn = document.getElementById("undoBtn");
const flipBtn = document.getElementById("flipBtn");

let state = createInitialState();
let turnLegalMoves = generateLegalMoves(state, state.turn);
let selected = null;
let selectedMoves = [];
let moveHistory = [];
let snapshots = [];
let orientation = "w";
let lastMove = null;

boardEl.addEventListener("click", onBoardClick);
newGameBtn.addEventListener("click", resetGame);
undoBtn.addEventListener("click", undoMove);
flipBtn.addEventListener("click", () => {
  orientation = orientation === "w" ? "b" : "w";
  render();
});

render();

function createInitialState() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];

  for (let col = 0; col < 8; col += 1) {
    board[0][col] = `b${backRank[col]}`;
    board[1][col] = "bP";
    board[6][col] = "wP";
    board[7][col] = `w${backRank[col]}`;
  }

  return {
    board,
    turn: "w",
    castling: {
      wK: true,
      wQ: true,
      bK: true,
      bQ: true,
    },
    enPassant: null,
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function opponent(color) {
  return color === "w" ? "b" : "w";
}

function colorName(color) {
  return color === "w" ? "White" : "Black";
}

function toSquare(row, col) {
  return `${FILES[col]}${8 - row}`;
}

function pieceName(piece) {
  if (!piece) {
    return "empty";
  }

  const names = {
    K: "king",
    Q: "queen",
    R: "rook",
    B: "bishop",
    N: "knight",
    P: "pawn",
  };

  const side = piece[0] === "w" ? "white" : "black";
  return `${side} ${names[piece[1]]}`;
}

function onBoardClick(event) {
  const target = event.target.closest(".square");
  if (!target) {
    return;
  }

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  handleSquareSelection(row, col);
}

function handleSquareSelection(row, col) {
  if (selected) {
    const pickedMove = selectedMoves.find((move) => move.to.r === row && move.to.c === col);
    if (pickedMove) {
      playMove(pickedMove);
      return;
    }

    if (selected.r === row && selected.c === col) {
      selected = null;
      selectedMoves = [];
      render();
      return;
    }
  }

  const piece = state.board[row][col];
  if (piece && piece[0] === state.turn) {
    selected = { r: row, c: col };
    selectedMoves = turnLegalMoves.filter((move) => move.from.r === row && move.from.c === col);
  } else {
    selected = null;
    selectedMoves = [];
  }

  render();
}

function requiresPromotion(game, move) {
  const piece = game.board[move.from.r][move.from.c];
  return piece && piece[1] === "P" && (move.to.r === 0 || move.to.r === 7);
}

function askPromotionPiece() {
  const reply = window.prompt("Promote to Q, R, B, or N:", "Q");
  const choice = (reply || "Q").trim().toUpperCase();
  return ["Q", "R", "B", "N"].includes(choice) ? choice : "Q";
}

function playMove(move) {
  const before = deepClone(state);
  const moveToPlay = { ...move };

  if (requiresPromotion(state, moveToPlay)) {
    moveToPlay.promotion = askPromotionPiece();
  }

  snapshots.push(before);
  applyMove(state, moveToPlay);
  lastMove = {
    from: moveToPlay.from,
    to: moveToPlay.to,
  };

  selected = null;
  selectedMoves = [];

  turnLegalMoves = generateLegalMoves(state, state.turn);
  moveHistory.push(moveToNotation(before, moveToPlay, state, turnLegalMoves));
  render();
}

function resetGame() {
  state = createInitialState();
  turnLegalMoves = generateLegalMoves(state, state.turn);
  selected = null;
  selectedMoves = [];
  moveHistory = [];
  snapshots = [];
  lastMove = null;
  render();
}

function undoMove() {
  if (snapshots.length === 0) {
    return;
  }

  state = snapshots.pop();
  moveHistory.pop();
  turnLegalMoves = generateLegalMoves(state, state.turn);
  selected = null;
  selectedMoves = [];
  lastMove = null;
  render();
}

function render() {
  renderBoard();
  renderStatus();
  renderMoves();
  undoBtn.disabled = snapshots.length === 0;
}

function renderBoard() {
  boardEl.innerHTML = "";

  const legalTargetKeys = new Set(selectedMoves.map((move) => `${move.to.r},${move.to.c}`));
  const checkedKing = isKingInCheck(state, state.turn) ? findKing(state, state.turn) : null;

  for (let visualRow = 0; visualRow < 8; visualRow += 1) {
    for (let visualCol = 0; visualCol < 8; visualCol += 1) {
      const boardCoords = visualToBoardCoords(visualRow, visualCol);
      const row = boardCoords.r;
      const col = boardCoords.c;

      const piece = state.board[row][col];
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      if (visualRow === 7) {
        square.dataset.file = FILES[col];
      }

      if (visualCol === 0) {
        square.dataset.rank = String(8 - row);
      }

      if (selected && selected.r === row && selected.c === col) {
        square.classList.add("selected");
      }

      if (legalTargetKeys.has(`${row},${col}`)) {
        square.classList.add("legal-target");
      }

      if (
        lastMove &&
        ((lastMove.from.r === row && lastMove.from.c === col) ||
          (lastMove.to.r === row && lastMove.to.c === col))
      ) {
        square.classList.add("last-move");
      }

      if (checkedKing && checkedKing.r === row && checkedKing.c === col) {
        square.classList.add("in-check");
      }

      square.textContent = piece ? PIECE_TO_SYMBOL[piece] : "";
      square.setAttribute("aria-label", `${toSquare(row, col)} ${pieceName(piece)}`);
      boardEl.appendChild(square);
    }
  }
}

function renderStatus() {
  const inCheck = isKingInCheck(state, state.turn);

  if (turnLegalMoves.length === 0) {
    if (inCheck) {
      statusEl.textContent = `${colorName(state.turn)} is checkmated. ${colorName(
        opponent(state.turn)
      )} wins.`;
      return;
    }

    statusEl.textContent = "Stalemate. Draw game.";
    return;
  }

  statusEl.textContent = `${colorName(state.turn)} to move${inCheck ? " (in check)." : "."}`;
}

function renderMoves() {
  movesEl.innerHTML = "";

  for (let index = 0; index < moveHistory.length; index += 2) {
    const item = document.createElement("li");
    const whiteMove = moveHistory[index] || "";
    const blackMove = moveHistory[index + 1] || "";
    item.textContent = `${Math.floor(index / 2) + 1}. ${whiteMove}${blackMove ? ` ${blackMove}` : ""}`;
    movesEl.appendChild(item);
  }

  movesEl.scrollTop = movesEl.scrollHeight;
}

function visualToBoardCoords(visualRow, visualCol) {
  if (orientation === "w") {
    return { r: visualRow, c: visualCol };
  }

  return { r: 7 - visualRow, c: 7 - visualCol };
}

function moveToNotation(beforeState, move, afterState, opponentLegalMoves) {
  if (move.castle === "K") {
    return withCheckSuffix("O-O", afterState, opponentLegalMoves);
  }

  if (move.castle === "Q") {
    return withCheckSuffix("O-O-O", afterState, opponentLegalMoves);
  }

  const piece = beforeState.board[move.from.r][move.from.c];
  const pieceType = piece[1];
  const capturedPiece = beforeState.board[move.to.r][move.to.c];
  const isCapture = Boolean(capturedPiece) || Boolean(move.enPassant);

  let notation = "";

  if (pieceType !== "P") {
    notation += pieceType;
  } else if (isCapture) {
    notation += FILES[move.from.c];
  }

  if (isCapture) {
    notation += "x";
  }

  notation += toSquare(move.to.r, move.to.c);

  if (pieceType === "P" && (move.to.r === 0 || move.to.r === 7)) {
    notation += `=${move.promotion || "Q"}`;
  }

  return withCheckSuffix(notation, afterState, opponentLegalMoves);
}

function withCheckSuffix(notation, afterState, opponentLegalMoves) {
  if (!isKingInCheck(afterState, afterState.turn)) {
    return notation;
  }

  return `${notation}${opponentLegalMoves.length === 0 ? "#" : "+"}`;
}

function findKing(game, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (game.board[row][col] === `${color}K`) {
        return { r: row, c: col };
      }
    }
  }

  return null;
}

function isKingInCheck(game, color) {
  const king = findKing(game, color);
  if (!king) {
    return false;
  }

  return isSquareAttacked(game, king.r, king.c, opponent(color));
}

function isSquareAttacked(game, targetRow, targetCol, byColor) {
  const board = game.board;

  const pawnRow = targetRow + (byColor === "w" ? 1 : -1);
  for (const deltaCol of [-1, 1]) {
    const col = targetCol + deltaCol;
    if (inBounds(pawnRow, col) && board[pawnRow][col] === `${byColor}P`) {
      return true;
    }
  }

  const knightSteps = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1],
  ];
  for (const [deltaRow, deltaCol] of knightSteps) {
    const row = targetRow + deltaRow;
    const col = targetCol + deltaCol;
    if (inBounds(row, col) && board[row][col] === `${byColor}N`) {
      return true;
    }
  }

  for (let deltaRow = -1; deltaRow <= 1; deltaRow += 1) {
    for (let deltaCol = -1; deltaCol <= 1; deltaCol += 1) {
      if (deltaRow === 0 && deltaCol === 0) {
        continue;
      }

      const row = targetRow + deltaRow;
      const col = targetCol + deltaCol;
      if (inBounds(row, col) && board[row][col] === `${byColor}K`) {
        return true;
      }
    }
  }

  const diagonalDirs = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [deltaRow, deltaCol] of diagonalDirs) {
    let row = targetRow + deltaRow;
    let col = targetCol + deltaCol;

    while (inBounds(row, col)) {
      const piece = board[row][col];
      if (piece) {
        if (piece[0] === byColor && (piece[1] === "B" || piece[1] === "Q")) {
          return true;
        }
        break;
      }

      row += deltaRow;
      col += deltaCol;
    }
  }

  const straightDirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [deltaRow, deltaCol] of straightDirs) {
    let row = targetRow + deltaRow;
    let col = targetCol + deltaCol;

    while (inBounds(row, col)) {
      const piece = board[row][col];
      if (piece) {
        if (piece[0] === byColor && (piece[1] === "R" || piece[1] === "Q")) {
          return true;
        }
        break;
      }

      row += deltaRow;
      col += deltaCol;
    }
  }

  return false;
}

function generateLegalMoves(game, color) {
  const legalMoves = [];

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = game.board[row][col];
      if (!piece || piece[0] !== color) {
        continue;
      }

      const pseudoMoves = generatePseudoMoves(game, row, col);
      for (const move of pseudoMoves) {
        const candidate = deepClone(game);
        applyMove(candidate, move);
        if (!isKingInCheck(candidate, color)) {
          legalMoves.push(move);
        }
      }
    }
  }

  return legalMoves;
}

function generatePseudoMoves(game, row, col) {
  const piece = game.board[row][col];
  if (!piece) {
    return [];
  }

  const color = piece[0];
  const type = piece[1];
  const enemy = opponent(color);
  const moves = [];

  if (type === "P") {
    const direction = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const nextRow = row + direction;

    if (inBounds(nextRow, col) && !game.board[nextRow][col]) {
      moves.push({
        from: { r: row, c: col },
        to: { r: nextRow, c: col },
      });

      const jumpRow = row + direction * 2;
      if (row === startRow && !game.board[jumpRow][col]) {
        moves.push({
          from: { r: row, c: col },
          to: { r: jumpRow, c: col },
        });
      }
    }

    for (const deltaCol of [-1, 1]) {
      const captureCol = col + deltaCol;
      const captureRow = row + direction;
      if (!inBounds(captureRow, captureCol)) {
        continue;
      }

      const target = game.board[captureRow][captureCol];
      if (target && target[0] === enemy) {
        moves.push({
          from: { r: row, c: col },
          to: { r: captureRow, c: captureCol },
        });
      }

      if (
        game.enPassant &&
        game.enPassant.r === captureRow &&
        game.enPassant.c === captureCol &&
        game.board[row][captureCol] === `${enemy}P`
      ) {
        moves.push({
          from: { r: row, c: col },
          to: { r: captureRow, c: captureCol },
          enPassant: true,
        });
      }
    }

    return moves;
  }

  if (type === "N") {
    const knightSteps = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];

    for (const [deltaRow, deltaCol] of knightSteps) {
      const targetRow = row + deltaRow;
      const targetCol = col + deltaCol;

      if (!inBounds(targetRow, targetCol)) {
        continue;
      }

      const targetPiece = game.board[targetRow][targetCol];
      if (!targetPiece || targetPiece[0] === enemy) {
        moves.push({
          from: { r: row, c: col },
          to: { r: targetRow, c: targetCol },
        });
      }
    }

    return moves;
  }

  if (type === "B" || type === "R" || type === "Q") {
    const directions = [];

    if (type === "B" || type === "Q") {
      directions.push(
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      );
    }

    if (type === "R" || type === "Q") {
      directions.push(
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
      );
    }

    for (const [deltaRow, deltaCol] of directions) {
      let targetRow = row + deltaRow;
      let targetCol = col + deltaCol;

      while (inBounds(targetRow, targetCol)) {
        const targetPiece = game.board[targetRow][targetCol];
        if (!targetPiece) {
          moves.push({
            from: { r: row, c: col },
            to: { r: targetRow, c: targetCol },
          });
        } else {
          if (targetPiece[0] === enemy) {
            moves.push({
              from: { r: row, c: col },
              to: { r: targetRow, c: targetCol },
            });
          }
          break;
        }

        targetRow += deltaRow;
        targetCol += deltaCol;
      }
    }

    return moves;
  }

  if (type === "K") {
    for (let deltaRow = -1; deltaRow <= 1; deltaRow += 1) {
      for (let deltaCol = -1; deltaCol <= 1; deltaCol += 1) {
        if (deltaRow === 0 && deltaCol === 0) {
          continue;
        }

        const targetRow = row + deltaRow;
        const targetCol = col + deltaCol;
        if (!inBounds(targetRow, targetCol)) {
          continue;
        }

        const targetPiece = game.board[targetRow][targetCol];
        if (!targetPiece || targetPiece[0] === enemy) {
          moves.push({
            from: { r: row, c: col },
            to: { r: targetRow, c: targetCol },
          });
        }
      }
    }

    const homeRow = color === "w" ? 7 : 0;
    const canCastleKingSide = color === "w" ? game.castling.wK : game.castling.bK;
    const canCastleQueenSide = color === "w" ? game.castling.wQ : game.castling.bQ;

    if (row === homeRow && col === 4 && !isKingInCheck(game, color)) {
      if (
        canCastleKingSide &&
        game.board[homeRow][5] === null &&
        game.board[homeRow][6] === null &&
        game.board[homeRow][7] === `${color}R` &&
        !isSquareAttacked(game, homeRow, 5, enemy) &&
        !isSquareAttacked(game, homeRow, 6, enemy)
      ) {
        moves.push({
          from: { r: row, c: col },
          to: { r: homeRow, c: 6 },
          castle: "K",
        });
      }

      if (
        canCastleQueenSide &&
        game.board[homeRow][3] === null &&
        game.board[homeRow][2] === null &&
        game.board[homeRow][1] === null &&
        game.board[homeRow][0] === `${color}R` &&
        !isSquareAttacked(game, homeRow, 3, enemy) &&
        !isSquareAttacked(game, homeRow, 2, enemy)
      ) {
        moves.push({
          from: { r: row, c: col },
          to: { r: homeRow, c: 2 },
          castle: "Q",
        });
      }
    }
  }

  return moves;
}

function applyMove(game, move) {
  const from = move.from;
  const to = move.to;
  const board = game.board;
  const piece = board[from.r][from.c];

  if (!piece) {
    return;
  }

  const color = piece[0];
  const enemy = opponent(color);
  const type = piece[1];

  let captured = board[to.r][to.c];
  if (move.enPassant) {
    const capturedRow = color === "w" ? to.r + 1 : to.r - 1;
    captured = board[capturedRow][to.c];
    board[capturedRow][to.c] = null;
  }

  if (captured === "wR") {
    if (to.r === 7 && to.c === 0) {
      game.castling.wQ = false;
    }
    if (to.r === 7 && to.c === 7) {
      game.castling.wK = false;
    }
  } else if (captured === "bR") {
    if (to.r === 0 && to.c === 0) {
      game.castling.bQ = false;
    }
    if (to.r === 0 && to.c === 7) {
      game.castling.bK = false;
    }
  }

  board[from.r][from.c] = null;
  board[to.r][to.c] = piece;

  if (type === "K") {
    if (color === "w") {
      game.castling.wK = false;
      game.castling.wQ = false;
    } else {
      game.castling.bK = false;
      game.castling.bQ = false;
    }
  }

  if (type === "R") {
    if (color === "w") {
      if (from.r === 7 && from.c === 0) {
        game.castling.wQ = false;
      }
      if (from.r === 7 && from.c === 7) {
        game.castling.wK = false;
      }
    } else {
      if (from.r === 0 && from.c === 0) {
        game.castling.bQ = false;
      }
      if (from.r === 0 && from.c === 7) {
        game.castling.bK = false;
      }
    }
  }

  if (move.castle === "K") {
    board[from.r][5] = board[from.r][7];
    board[from.r][7] = null;
  } else if (move.castle === "Q") {
    board[from.r][3] = board[from.r][0];
    board[from.r][0] = null;
  }

  if (type === "P" && (to.r === 0 || to.r === 7)) {
    board[to.r][to.c] = `${color}${move.promotion || "Q"}`;
  }

  game.enPassant = null;
  if (type === "P" && Math.abs(to.r - from.r) === 2) {
    game.enPassant = {
      r: (from.r + to.r) / 2,
      c: from.c,
    };
  }

  game.turn = enemy;
}
