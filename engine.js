"use strict";

// ============================================================
// 1. PIECE DEFINITIONS
// ============================================================
const GLYPHS = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

// Piece-square tables (white perspective, index 0 = a8 top-left, row-major)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

// ============================================================
// 2. COMPLETE GAME STATE
// ============================================================
let board = [];                    // flat array[64]: '' or piece char
let turn = 'w';                    // 'w' or 'b'
let selectedSq = null;             // selected square index or null
let legalMovesCache = [];          // legal moves for current turn
let lastMove = null;               // { from, to, ... }
let history = [];                  // full state snapshots for undo
let moveNotations = [];            // SAN strings array
let castling = { K: true, Q: true, k: true, q: true };
let enPassant = -1;                // en passant target square or -1
let capturedWhite = [];            // pieces captured FROM white side (black captured)
let capturedBlack = [];            // pieces captured FROM black side (white captured)
let halfmove = 0;                  // fifty-move rule counter
let fullmove = 1;                  // full move number
let posHistory = [];               // position key strings for repetition
let gameResult = null;             // null | 'w' | 'b' | 'draw'
let boardFlipped = false;
let gameOver = false;
let aiThinking = false;
let promoResolve = null;

// Clock
let clockWhiteMs = 600000;
let clockBlackMs = 600000;
let clockIncrement = 0;
let clockInterval = null;
let clockLastTick = null;
let clockRunning = false;
let configTimeMs = 600000;

// AI
let aiEnabled = true;
let aiSide = 'b';
let aiDifficulty = 'medium';

// Sound
let soundEnabled = true;
let audioCtx = null;

// Arrows (right-click drawing)
let arrowList = [];
let arrowStart = -1;
let arrowCanvas = null;
let arrowCtx2d = null;

// Puzzle
let puzzleMode = false;
let currentPuzzle = null;
let puzzleMoveIndex = 0;

// Stats
let statsWins = 0;
let statsLosses = 0;
let statsDraws = 0;

// Opening tracking
let openingMoveKeys = [];
let openingName = '';

// Theme
let currentTheme = 'classic';

// Drag state
let dragFrom = -1;
let dragPiece = null;
let dragGhost = null;

// ============================================================
// 3. FEN PARSER
// ============================================================
function parseFEN(fen) {
  const parts = fen.trim().split(/\s+/);
  const ranks = parts[0].split('/');
  board = [];
  for (let r = 0; r < 8; r++) {
    for (const ch of ranks[r]) {
      if (/\d/.test(ch)) {
        for (let k = 0; k < parseInt(ch); k++) board.push('');
      } else {
        board.push(ch);
      }
    }
  }
  while (board.length < 64) board.push('');
  turn = parts[1] || 'w';
  const castleStr = parts[2] || '-';
  castling = {
    K: castleStr.includes('K'),
    Q: castleStr.includes('Q'),
    k: castleStr.includes('k'),
    q: castleStr.includes('q'),
  };
  const epStr = parts[3] || '-';
  if (epStr === '-') {
    enPassant = -1;
  } else {
    const fc = epStr.charCodeAt(0) - 97;
    const fr = 8 - parseInt(epStr[1]);
    enPassant = fr * 8 + fc;
  }
  halfmove = parseInt(parts[4]) || 0;
  fullmove = parseInt(parts[5]) || 1;
}

// ============================================================
// 4. FEN GENERATOR
// ============================================================
function toFEN() {
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r * 8 + c];
      if (!p) {
        empty++;
      } else {
        if (empty) { fen += empty; empty = 0; }
        fen += p;
      }
    }
    if (empty) fen += empty;
    if (r < 7) fen += '/';
  }
  fen += ' ' + turn;
  let cs = '';
  if (castling.K) cs += 'K';
  if (castling.Q) cs += 'Q';
  if (castling.k) cs += 'k';
  if (castling.q) cs += 'q';
  fen += ' ' + (cs || '-');
  fen += ' ' + (enPassant >= 0 ? sqName(enPassant) : '-');
  fen += ' ' + halfmove + ' ' + fullmove;
  return fen;
}

// ============================================================
// 5. MOVE GENERATION
// ============================================================
function sqRow(i)     { return i >> 3; }
function sqCol(i)     { return i & 7; }
function sqIdx(r, c)  { return r * 8 + c; }
function onBoard(r, c){ return r >= 0 && r < 8 && c >= 0 && c < 8; }
function isWhitePiece(p) { return p !== '' && p === p.toUpperCase(); }
function isBlackPiece(p) { return p !== '' && p === p.toLowerCase(); }
function colorOf(p)  { return !p ? null : isWhitePiece(p) ? 'w' : 'b'; }
function enemySide(s){ return s === 'w' ? 'b' : 'w'; }
function sqName(i)   { return String.fromCharCode(97 + sqCol(i)) + (8 - sqRow(i)); }

function pseudoMoves(b, side, ep, castle) {
  const moves = [];
  const opp = enemySide(side);

  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || colorOf(p) !== side) continue;
    const r = sqRow(i), c = sqCol(i);
    const type = p.toLowerCase();

    if (type === 'p') {
      const dir = side === 'w' ? -1 : 1;
      const startR = side === 'w' ? 6 : 1;
      const promoR = side === 'w' ? 0 : 7;
      const fr = r + dir;

      // Single push
      if (onBoard(fr, c) && !b[sqIdx(fr, c)]) {
        if (fr === promoR) {
          for (const pr of ['q', 'r', 'b', 'n'])
            moves.push({ from: i, to: sqIdx(fr, c), promo: pr });
        } else {
          moves.push({ from: i, to: sqIdx(fr, c) });
          // Double push
          if (r === startR) {
            const fr2 = r + dir * 2;
            if (!b[sqIdx(fr2, c)])
              moves.push({ from: i, to: sqIdx(fr2, c), doublePush: true });
          }
        }
      }

      // Captures (including en passant)
      for (const dc of [-1, 1]) {
        const nc = c + dc;
        if (!onBoard(fr, nc)) continue;
        const ti = sqIdx(fr, nc);
        const isEP = ti === ep;
        if ((b[ti] && colorOf(b[ti]) === opp) || isEP) {
          const captured = isEP ? (side === 'w' ? 'p' : 'P') : b[ti];
          if (fr === promoR) {
            for (const pr of ['q', 'r', 'b', 'n'])
              moves.push({ from: i, to: ti, promo: pr, capture: captured });
          } else {
            moves.push({ from: i, to: ti, capture: captured, ep: isEP });
          }
        }
      }

    } else if (type === 'n') {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const nr = r + dr, nc = c + dc;
        if (onBoard(nr, nc) && colorOf(b[sqIdx(nr, nc)]) !== side)
          moves.push({ from: i, to: sqIdx(nr, nc), capture: b[sqIdx(nr, nc)] || '' });
      }

    } else if (type === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (onBoard(nr, nc) && colorOf(b[sqIdx(nr, nc)]) !== side)
            moves.push({ from: i, to: sqIdx(nr, nc), capture: b[sqIdx(nr, nc)] || '' });
        }
      }
      // Castling
      if (side === 'w' && i === 60) {
        if (castle.K && !b[61] && !b[62] && b[63] === 'R')
          moves.push({ from: 60, to: 62, castle: 'K' });
        if (castle.Q && !b[59] && !b[58] && !b[57] && b[56] === 'R')
          moves.push({ from: 60, to: 58, castle: 'Q' });
      }
      if (side === 'b' && i === 4) {
        if (castle.k && !b[5] && !b[6] && b[7] === 'r')
          moves.push({ from: 4, to: 6, castle: 'k' });
        if (castle.q && !b[3] && !b[2] && !b[1] && b[0] === 'r')
          moves.push({ from: 4, to: 2, castle: 'q' });
      }

    } else {
      // Sliders: bishop, rook, queen
      const dirs = type === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
                 : type === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]]
                 : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (onBoard(nr, nc)) {
          const ti = sqIdx(nr, nc);
          if (b[ti]) {
            if (colorOf(b[ti]) === opp)
              moves.push({ from: i, to: ti, capture: b[ti] });
            break;
          }
          moves.push({ from: i, to: ti });
          nr += dr; nc += dc;
        }
      }
    }
  }
  return moves;
}

function isAttacked(b, sq, bySide) {
  const r = sqRow(sq), c = sqCol(sq);

  // Pawns
  const pDir = bySide === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const nr = r + pDir, nc = c + dc;
    if (onBoard(nr, nc)) {
      const p = b[sqIdx(nr, nc)];
      if (p && colorOf(p) === bySide && p.toLowerCase() === 'p') return true;
    }
  }

  // Knights
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const nr = r + dr, nc = c + dc;
    if (onBoard(nr, nc)) {
      const p = b[sqIdx(nr, nc)];
      if (p && colorOf(p) === bySide && p.toLowerCase() === 'n') return true;
    }
  }

  // King
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (onBoard(nr, nc)) {
        const p = b[sqIdx(nr, nc)];
        if (p && colorOf(p) === bySide && p.toLowerCase() === 'k') return true;
      }
    }
  }

  // Rooks / Queens (orthogonal)
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let nr = r + dr, nc = c + dc;
    while (onBoard(nr, nc)) {
      const p = b[sqIdx(nr, nc)];
      if (p) {
        if (colorOf(p) === bySide && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  // Bishops / Queens (diagonal)
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let nr = r + dr, nc = c + dc;
    while (onBoard(nr, nc)) {
      const p = b[sqIdx(nr, nc)];
      if (p) {
        if (colorOf(p) === bySide && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }

  return false;
}

function findKing(b, side) {
  const king = side === 'w' ? 'K' : 'k';
  for (let i = 0; i < 64; i++) if (b[i] === king) return i;
  return -1;
}

function inCheck(b, side) {
  const kSq = findKing(b, side);
  if (kSq < 0) return false;
  return isAttacked(b, kSq, enemySide(side));
}

function applyMove(b, move) {
  const nb = b.slice();
  const p = nb[move.from];

  // Determine piece at destination (handle promotion)
  let destPiece = p;
  if (move.promo) {
    destPiece = isWhitePiece(p) ? move.promo.toUpperCase() : move.promo.toLowerCase();
  }

  nb[move.to] = destPiece;
  nb[move.from] = '';

  // En passant capture: remove the captured pawn
  if (move.ep) {
    const dir = colorOf(p) === 'w' ? 1 : -1;
    nb[move.to + dir * 8] = '';
  }

  // Castling: move the rook
  if (move.castle) {
    if (move.castle === 'K') { nb[61] = 'R'; nb[63] = ''; }
    else if (move.castle === 'Q') { nb[59] = 'R'; nb[56] = ''; }
    else if (move.castle === 'k') { nb[5] = 'r'; nb[7] = ''; }
    else if (move.castle === 'q') { nb[3] = 'r'; nb[0] = ''; }
  }

  return nb;
}

function getLegalMoves(b, side, ep, castle) {
  const pseudo = pseudoMoves(b, side, ep, castle);
  const legal = [];

  for (const m of pseudo) {
    // Castling: cannot castle while in check, cannot pass through attacked square
    if (m.castle) {
      if (inCheck(b, side)) continue;
      const kingStart = side === 'w' ? 60 : 4;
      const passThru = (m.castle === 'K' || m.castle === 'k')
        ? kingStart + 1
        : kingStart - 1;
      if (isAttacked(b, passThru, enemySide(side))) continue;
    }
    const nb = applyMove(b, m);
    if (!inCheck(nb, side)) legal.push(m);
  }

  return legal;
}

// ============================================================
// 6. ALGEBRAIC NOTATION (SAN)
// ============================================================
function moveToSAN(b, move, side, ep, castle) {
  if (move.castle === 'K' || move.castle === 'k') return 'O-O';
  if (move.castle === 'Q' || move.castle === 'q') return 'O-O-O';

  const p = b[move.from];
  const type = p.toLowerCase();
  const toSq = sqName(move.to);
  let san = '';

  if (type === 'p') {
    if (move.capture || move.ep) {
      san = String.fromCharCode(97 + sqCol(move.from)) + 'x' + toSq;
    } else {
      san = toSq;
    }
    if (move.promo) san += '=' + move.promo.toUpperCase();
  } else {
    san = type.toUpperCase();

    // Disambiguation
    const allLegal = getLegalMoves(b, side, ep, castle);
    const ambig = allLegal.filter(m =>
      m.to === move.to &&
      m.from !== move.from &&
      b[m.from].toLowerCase() === type
    );

    if (ambig.length > 0) {
      const sameFile = ambig.some(m => sqCol(m.from) === sqCol(move.from));
      const sameRank = ambig.some(m => sqRow(m.from) === sqRow(move.from));
      if (!sameFile) {
        san += String.fromCharCode(97 + sqCol(move.from));
      } else if (!sameRank) {
        san += String(8 - sqRow(move.from));
      } else {
        san += sqName(move.from);
      }
    }

    if (move.capture) san += 'x';
    san += toSq;
  }

  return san;
}

// ============================================================
// 7. GAME EXECUTION
// ============================================================
async function executeMove(m) {
  if (gameOver) return;

  // Save full state snapshot for undo
  history.push({
    board: board.slice(),
    turn,
    castling: { ...castling },
    enPassant,
    halfmove,
    fullmove,
    lastMove: lastMove ? { ...lastMove } : null,
    capturedWhite: capturedWhite.slice(),
    capturedBlack: capturedBlack.slice(),
    posHistory: posHistory.slice(),
    moveNotations: moveNotations.slice(),
    openingMoveKeys: openingMoveKeys.slice(),
    openingName,
  });

  const moveSide = turn;
  const san = moveToSAN(board, m, turn, enPassant, castling);

  // Promotion: ask human for piece choice
  if (m.promo && moveSide !== aiSide) {
    if (aiEnabled) {
      // only prompt if it's not the AI's turn
      const chosen = await promptPromotion(moveSide);
      m = { ...m, promo: chosen };
    } else {
      // Two-player: always prompt
      const chosen = await promptPromotion(moveSide);
      m = { ...m, promo: chosen };
    }
  }

  // Track captured piece before applying
  const capturedPiece = m.ep
    ? (moveSide === 'w' ? 'p' : 'P')
    : (m.capture || '');

  // Apply move
  const nb = applyMove(board, m);

  // Update captured pieces arrays
  if (capturedPiece) {
    if (moveSide === 'w') capturedBlack.push(capturedPiece.toLowerCase());
    else capturedWhite.push(capturedPiece.toLowerCase());
  }

  // Update castling rights based on moved/captured squares
  if (m.from === 60 || m.to === 60) { castling.K = false; castling.Q = false; }
  if (m.from === 4  || m.to === 4)  { castling.k = false; castling.q = false; }
  if (m.from === 63 || m.to === 63) castling.K = false;
  if (m.from === 56 || m.to === 56) castling.Q = false;
  if (m.from === 7  || m.to === 7)  castling.k = false;
  if (m.from === 0  || m.to === 0)  castling.q = false;

  // Update en passant square
  if (m.doublePush) {
    enPassant = (m.from + m.to) >> 1; // midpoint
  } else {
    enPassant = -1;
  }

  // Update halfmove clock
  const movedType = board[m.from] ? board[m.from].toLowerCase() : '';
  if (capturedPiece || movedType === 'p') halfmove = 0;
  else halfmove++;

  board = nb;
  lastMove = m;

  // Clock increment for the side that just moved
  if (moveSide === 'w') clockWhiteMs += clockIncrement;
  else clockBlackMs += clockIncrement;

  if (moveSide === 'b') fullmove++;
  turn = enemySide(moveSide);

  // Record position for repetition detection
  const key = positionKey(board, turn, castling, enPassant);
  posHistory.push(key);

  // Compute legal moves for next side to detect check/mate/stalemate
  const nextLegal = getLegalMoves(board, turn, enPassant, castling);
  const isInChk = inCheck(board, turn);

  // Complete SAN with check/checkmate suffix
  let finalSan = san;
  if (nextLegal.length === 0 && isInChk) finalSan += '#';
  else if (isInChk) finalSan += '+';
  moveNotations.push(finalSan);

  // Sound
  if (m.castle) playSound('castle');
  else if (m.promo) playSound('promote');
  else if (capturedPiece) playSound('capture');
  else if (isInChk) playSound('check');
  else playSound('move');

  // Switch clock
  switchClock();

  // Check for game-ending conditions
  if (nextLegal.length === 0) {
    stopClock();
    if (isInChk) {
      gameResult = moveSide;
      gameOver = true;
      playSound('gameEnd');
      const winner = moveSide === 'w' ? 'White' : 'Black';
      updateStats(moveSide);
      render();
      showGameOver(winner + ' wins by checkmate!');
      return;
    } else {
      gameResult = 'draw';
      gameOver = true;
      playSound('gameEnd');
      updateStats('draw');
      render();
      showGameOver('Stalemate \u2013 Draw!');
      return;
    }
  }

  if (isThreefoldRepetition()) {
    stopClock();
    gameResult = 'draw'; gameOver = true;
    updateStats('draw');
    render();
    showGameOver('Draw by threefold repetition!');
    return;
  }

  if (isFiftyMoveRule()) {
    stopClock();
    gameResult = 'draw'; gameOver = true;
    updateStats('draw');
    render();
    showGameOver('Draw by fifty-move rule!');
    return;
  }

  if (isInsufficientMaterial(board)) {
    stopClock();
    gameResult = 'draw'; gameOver = true;
    updateStats('draw');
    render();
    showGameOver('Draw by insufficient material!');
    return;
  }

  legalMovesCache = nextLegal;
  render();

  if (aiEnabled && !gameOver && turn === aiSide) {
    triggerAI();
  }
}

// ============================================================
// 8. UNDO
// ============================================================
function undoMove() {
  if (aiThinking) return;
  if (history.length === 0) return;

  // Undo AI move too when playing against AI
  const count = (aiEnabled && history.length >= 2) ? 2 : 1;
  for (let i = 0; i < count && history.length > 0; i++) {
    const snap = history.pop();
    board = snap.board;
    turn = snap.turn;
    castling = snap.castling;
    enPassant = snap.enPassant;
    halfmove = snap.halfmove;
    fullmove = snap.fullmove;
    lastMove = snap.lastMove;
    capturedWhite = snap.capturedWhite;
    capturedBlack = snap.capturedBlack;
    posHistory = snap.posHistory;
    moveNotations = snap.moveNotations;
    openingMoveKeys = snap.openingMoveKeys || [];
    openingName = snap.openingName || '';
  }

  gameOver = false;
  gameResult = null;
  selectedSq = null;
  legalMovesCache = getLegalMoves(board, turn, enPassant, castling);
  hideGameOver();
  render();
}

// ============================================================
// 9. PROMOTION UI
// ============================================================
function promptPromotion(side) {
  return new Promise((resolve) => {
    promoResolve = resolve;
    const overlay = document.getElementById('promoOverlay');
    const choices = document.getElementById('promoChoices');
    if (!overlay || !choices) { resolve('q'); return; }

    choices.innerHTML = '';
    const pieces = ['q', 'r', 'b', 'n'];
    for (const pr of pieces) {
      const glyphKey = (side === 'w' ? 'w' : 'b') + pr.toUpperCase();
      const btn = document.createElement('button');
      btn.className = 'promo-btn';
      btn.textContent = GLYPHS[glyphKey] || pr;
      btn.onclick = () => {
        overlay.style.display = 'none';
        promoResolve = null;
        resolve(pr);
      };
      choices.appendChild(btn);
    }
    overlay.style.display = 'flex';
  });
}

// ============================================================
// 10. CLICK HANDLER
// ============================================================
function clickSquare(displayIdx) {
  if (gameOver || aiThinking || promoResolve) return;

  const i = boardFlipped ? 63 - displayIdx : displayIdx;

  // Ignore click if it's the AI's turn in AI mode
  if (aiEnabled && turn === aiSide) return;

  if (selectedSq === null) {
    if (board[i] && colorOf(board[i]) === turn) {
      selectedSq = i;
      legalMovesCache = getLegalMoves(board, turn, enPassant, castling);
      render();
    }
    return;
  }

  if (i === selectedSq) {
    selectedSq = null;
    render();
    return;
  }

  // Try to find matching legal move
  const moves = legalMovesCache.filter(m => m.from === selectedSq && m.to === i);
  if (moves.length > 0) {
    const move = moves[0]; // Picks first (usually queen promo)
    if (puzzleMode && !checkPuzzleMove(selectedSq, i)) {
      selectedSq = null;
      render();
      return;
    }
    selectedSq = null;
    openingTrack(move.from, move.to);
    executeMove(move);
  } else if (board[i] && colorOf(board[i]) === turn) {
    // Re-select a different piece
    selectedSq = i;
    render();
  } else {
    selectedSq = null;
    render();
    playSound('illegal');
  }
}

// ============================================================
// 11. DRAG AND DROP
// ============================================================
function initDragDrop() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  boardEl.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // Touch support
  boardEl.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

function onDragStart(e) {
  if (e.button !== 0) return;
  if (gameOver || aiThinking || promoResolve) return;
  const squareEl = e.target.closest('[data-idx]');
  if (!squareEl) return;
  const dispIdx = parseInt(squareEl.dataset.idx);
  const i = boardFlipped ? 63 - dispIdx : dispIdx;
  if (!board[i] || colorOf(board[i]) !== turn) return;
  if (aiEnabled && turn === aiSide) return;

  dragFrom = i;
  dragPiece = board[i];
  selectedSq = i;
  legalMovesCache = getLegalMoves(board, turn, enPassant, castling);

  createGhost(e.clientX, e.clientY, board[i]);
  render();
  e.preventDefault();
}

function onDragMove(e) {
  if (!dragGhost) return;
  dragGhost.style.left = e.clientX + 'px';
  dragGhost.style.top = e.clientY + 'px';
}

function onDragEnd(e) {
  if (!dragGhost) return;
  if (dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
  dragGhost = null;

  const boardEl = document.getElementById('board');
  if (!boardEl || dragFrom < 0) { dragFrom = -1; dragPiece = null; return; }

  const rect = boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dc = Math.floor(x / (rect.width / 8));
  const dr = Math.floor(y / (rect.height / 8));

  if (dc >= 0 && dc < 8 && dr >= 0 && dr < 8) {
    const dispIdx = dr * 8 + dc;
    const toIdx = boardFlipped ? 63 - dispIdx : dispIdx;

    if (toIdx !== dragFrom) {
      const moves = legalMovesCache.filter(m => m.from === dragFrom && m.to === toIdx);
      if (moves.length > 0) {
        if (!puzzleMode || checkPuzzleMove(dragFrom, toIdx)) {
          const move = moves[0];
          selectedSq = null;
          const fromSaved = dragFrom;
          dragFrom = -1; dragPiece = null;
          openingTrack(move.from, move.to);
          executeMove(move);
          return;
        }
      }
    }
  }

  selectedSq = null;
  dragFrom = -1; dragPiece = null;
  render();
}

function onTouchStart(e) {
  const touch = e.touches[0];
  onDragStart({ button: 0, clientX: touch.clientX, clientY: touch.clientY,
    target: touch.target, preventDefault: () => e.preventDefault() });
}
function onTouchMove(e) {
  const touch = e.touches[0];
  onDragMove({ clientX: touch.clientX, clientY: touch.clientY });
  e.preventDefault();
}
function onTouchEnd(e) {
  const touch = e.changedTouches[0];
  onDragEnd({ clientX: touch.clientX, clientY: touch.clientY });
}

function createGhost(cx, cy, piece) {
  if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
  dragGhost = document.createElement('div');
  dragGhost.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'font-size:54px',
    'line-height:1',
    'filter:drop-shadow(2px 4px 6px rgba(0,0,0,0.5))',
    'transform:translate(-50%,-50%)',
    'user-select:none',
    'left:' + cx + 'px',
    'top:' + cy + 'px',
  ].join(';');
  const side = colorOf(piece) === 'w' ? 'w' : 'b';
  dragGhost.textContent = GLYPHS[side + piece.toUpperCase()] || piece;
  document.body.appendChild(dragGhost);
}

// ============================================================
// 12. RENDER FUNCTION
// ============================================================
function render() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  boardEl.innerHTML = '';

  const lmTargets = new Set(
    selectedSq !== null
      ? legalMovesCache.filter(m => m.from === selectedSq).map(m => m.to)
      : []
  );
  const kSq = inCheck(board, turn) ? findKing(board, turn) : -1;

  for (let di = 0; di < 64; di++) {
    const i = boardFlipped ? 63 - di : di;
    const r = sqRow(di), c = sqCol(di);

    const sq = document.createElement('div');
    sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
    sq.dataset.idx = di;

    // Highlight classes
    if (i === selectedSq) sq.classList.add('selected');
    if (lastMove && (i === lastMove.from || i === lastMove.to)) sq.classList.add('last-move');
    if (i === kSq) sq.classList.add('in-check');

    // Piece rendering
    const p = board[i];
    if (p) {
      const span = document.createElement('span');
      span.className = 'piece';
      span.textContent = GLYPHS[(colorOf(p) === 'w' ? 'w' : 'b') + p.toUpperCase()] || p;
      // Dim piece being dragged
      if (dragFrom === i && dragGhost) span.style.opacity = '0.25';
      sq.appendChild(span);
    }

    // Legal move indicators
    if (lmTargets.has(i)) {
      if (p && colorOf(p) !== turn) {
        sq.classList.add('capture-target');
      } else {
        sq.classList.add('move-target');
      }
    }

    sq.addEventListener('click', () => clickSquare(di));
    boardEl.appendChild(sq);
  }

  updateStatus();
  updateCapturedPieces();
  updateMoveList();
  updateOpeningName();
  updateMaterialAdv();
  updateEvalBar();
  renderClocks();
  renderArrows();
}

function updateStatus() {
  const el = document.getElementById('status');
  if (!el) return;
  if (gameOver) {
    if (gameResult === 'draw') el.textContent = 'Game drawn';
    else el.textContent = (gameResult === 'w' ? 'White' : 'Black') + ' wins!';
    return;
  }
  if (aiThinking) { el.textContent = 'Computer is thinking\u2026'; return; }
  const side = turn === 'w' ? 'White' : 'Black';
  if (inCheck(board, turn)) el.textContent = side + ' is in check!';
  else el.textContent = side + ' to move';
}

function updateCapturedPieces() {
  const wEl = document.getElementById('capWhite');
  const bEl = document.getElementById('capBlack');

  const fmt = (arr, capturedBySide) => {
    const sorted = arr.slice().sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    return sorted.map(p => GLYPHS[capturedBySide + p.toUpperCase()] || p).join('');
  };

  // capWhite shows pieces captured by White (from black side)
  if (wEl) wEl.textContent = fmt(capturedBlack, 'w');
  // capBlack shows pieces captured by Black (from white side)
  if (bEl) bEl.textContent = fmt(capturedWhite, 'b');
}

function updateMoveList() {
  const el = document.getElementById('movesList');
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < moveNotations.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'move-row';

    const numSpan = document.createElement('span');
    numSpan.className = 'move-number';
    numSpan.textContent = (Math.floor(i / 2) + 1) + '.';
    row.appendChild(numSpan);

    const wSpan = document.createElement('span');
    wSpan.className = 'move-white';
    wSpan.textContent = ' ' + (moveNotations[i] || '');
    row.appendChild(wSpan);

    if (moveNotations[i + 1] !== undefined) {
      const bSpan = document.createElement('span');
      bSpan.className = 'move-black';
      bSpan.textContent = ' ' + moveNotations[i + 1];
      row.appendChild(bSpan);
    }

    el.appendChild(row);
  }
  el.scrollTop = el.scrollHeight;
}

function updateOpeningName() {
  const el = document.getElementById('openingName');
  if (!el) return;
  el.textContent = openingName || '';
}

function getMaterialCount(b) {
  let white = 0, black = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p.toLowerCase() === 'k') continue;
    const val = PIECE_VALUES[p.toLowerCase()] || 0;
    if (isWhitePiece(p)) white += val;
    else black += val;
  }
  return { white, black };
}

function updateMaterialAdv() {
  const el = document.getElementById('materialAdv');
  if (!el) return;
  const { white, black } = getMaterialCount(board);
  const diff = white - black;
  // Convert centipawn diff to approximate piece-value difference
  const pDiff = Math.round(diff / 100);
  if (diff > 0) el.textContent = 'White +'+ pDiff;
  else if (diff < 0) el.textContent = 'Black +' + (-pDiff);
  else el.textContent = '=';
}

function updateEvalBar() {
  const el = document.getElementById('evalBar');
  if (!el) return;
  const score = evaluateBoard(board);
  const clamped = Math.max(-2000, Math.min(2000, score));
  const pct = 50 + (clamped / 2000) * 50;
  el.style.width = pct.toFixed(1) + '%';
}

// ============================================================
// 13. SOUND SYSTEM (Web Audio API, procedural tones)
// ============================================================
function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return null; }
  }
  return audioCtx;
}

function playSound(type) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const configs = {
      move:    [{ freq: 440, dur: 0.12, type: 'sine',     vol: 0.25 }],
      capture: [{ freq: 180, dur: 0.18, type: 'sawtooth', vol: 0.35 },
                { freq: 240, dur: 0.10, type: 'sine',     vol: 0.15 }],
      check:   [{ freq: 880, dur: 0.15, type: 'square',   vol: 0.3  },
                { freq: 1100,dur: 0.10, type: 'square',   vol: 0.2  }],
      castle:  [{ freq: 523, dur: 0.15, type: 'sine',     vol: 0.3  },
                { freq: 659, dur: 0.15, type: 'sine',     vol: 0.25 }],
      promote: [{ freq: 523, dur: 0.12, type: 'triangle', vol: 0.3  },
                { freq: 659, dur: 0.12, type: 'triangle', vol: 0.3  },
                { freq: 784, dur: 0.20, type: 'triangle', vol: 0.35 }],
      gameEnd: [{ freq: 330, dur: 0.25, type: 'sine',     vol: 0.4  },
                { freq: 262, dur: 0.30, type: 'sine',     vol: 0.35 },
                { freq: 196, dur: 0.50, type: 'sine',     vol: 0.30 }],
      illegal: [{ freq: 110, dur: 0.15, type: 'sawtooth', vol: 0.2  }],
    };
    const notes = configs[type] || configs.move;
    let offset = 0;
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.type;
      osc.frequency.setValueAtTime(note.freq, now + offset);
      gain.gain.setValueAtTime(note.vol, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + note.dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + note.dur + 0.05);
      offset += note.dur * 0.6;
    }
  } catch(e) {}
}

// ============================================================
// 14. GAME CLOCKS
// ============================================================
function startClock() {
  if (clockRunning) return;
  clockRunning = true;
  clockLastTick = Date.now();
  clockInterval = setInterval(tickClock, 100);
}

function stopClock() {
  clockRunning = false;
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
}

function switchClock() {
  clockLastTick = Date.now();
  if (!clockRunning) startClock();
}

function tickClock() {
  if (!clockRunning || gameOver) return;
  const now = Date.now();
  const elapsed = now - (clockLastTick || now);
  clockLastTick = now;

  if (turn === 'w') {
    clockWhiteMs = Math.max(0, clockWhiteMs - elapsed);
    if (clockWhiteMs === 0) { onTimeForfeit('w'); return; }
  } else {
    clockBlackMs = Math.max(0, clockBlackMs - elapsed);
    if (clockBlackMs === 0) { onTimeForfeit('b'); return; }
  }
  renderClocks();
}

function onTimeForfeit(side) {
  stopClock();
  gameOver = true;
  gameResult = enemySide(side);
  updateStats(enemySide(side));
  render();
  const loser = side === 'w' ? 'White' : 'Black';
  const winner = side === 'w' ? 'Black' : 'White';
  showGameOver(loser + ' ran out of time! ' + winner + ' wins!');
}

function renderClocks() {
  const fmtMs = (ms) => {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ':' + String(s).padStart(2, '0');
  };

  const wEl = document.getElementById('clockWhite');
  const bEl = document.getElementById('clockBlack');
  if (wEl) {
    wEl.textContent = fmtMs(clockWhiteMs);
    wEl.classList.toggle('low-time', clockWhiteMs < 30000 && clockWhiteMs > 0);
  }
  if (bEl) {
    bEl.textContent = fmtMs(clockBlackMs);
    bEl.classList.toggle('low-time', clockBlackMs < 30000 && clockBlackMs > 0);
  }
}

// ============================================================
// 15. AI OPPONENT
// ============================================================
function evaluateBoard(b) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const type = p.toLowerCase();
    const val = PIECE_VALUES[type] || 0;
    const isW = isWhitePiece(p);
    // Mirror PST index for black pieces (flip vertically)
    const pstIdx = isW ? i : (7 - sqRow(i)) * 8 + sqCol(i);
    const pst = (PST[type] && PST[type][pstIdx]) || 0;
    score += isW ? (val + pst) : -(val + pst);
  }
  return score;
}

function orderMoves(moves, b) {
  return moves.slice().sort((a, bm) => {
    const aCapVal = a.capture ? (PIECE_VALUES[a.capture.toLowerCase()] || 0) : 0;
    const bCapVal = bm.capture ? (PIECE_VALUES[bm.capture.toLowerCase()] || 0) : 0;
    const aFromVal = b[a.from] ? (PIECE_VALUES[b[a.from].toLowerCase()] || 0) : 0;
    const bFromVal = b[bm.from] ? (PIECE_VALUES[b[bm.from].toLowerCase()] || 0) : 0;
    // MVV-LVA: Most Valuable Victim - Least Valuable Aggressor
    const aScore = aCapVal * 10 - aFromVal;
    const bScore = bCapVal * 10 - bFromVal;
    return bScore - aScore;
  });
}

function updateCastleRights(castle, from, to) {
  const c = { ...castle };
  if (from === 60 || to === 60) { c.K = false; c.Q = false; }
  if (from === 4  || to === 4)  { c.k = false; c.q = false; }
  if (from === 63 || to === 63) c.K = false;
  if (from === 56 || to === 56) c.Q = false;
  if (from === 7  || to === 7)  c.k = false;
  if (from === 0  || to === 0)  c.q = false;
  return c;
}

function minimax(b, depth, alpha, beta, isMax, side, ep, castle) {
  if (depth === 0) return evaluateBoard(b);

  const moves = getLegalMoves(b, side, ep, castle);
  if (moves.length === 0) {
    if (inCheck(b, side)) return isMax ? -99999 - depth : 99999 + depth;
    return 0; // stalemate
  }

  const ordered = orderMoves(moves, b);
  const nextSide = enemySide(side);

  if (isMax) {
    let best = -Infinity;
    for (const m of ordered) {
      const nb = applyMove(b, m);
      const newEp = m.doublePush ? (m.from + m.to) >> 1 : -1;
      const newCastle = updateCastleRights(castle, m.from, m.to);
      const val = minimax(nb, depth - 1, alpha, beta, false, nextSide, newEp, newCastle);
      if (val > best) best = val;
      if (val > alpha) alpha = val;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of ordered) {
      const nb = applyMove(b, m);
      const newEp = m.doublePush ? (m.from + m.to) >> 1 : -1;
      const newCastle = updateCastleRights(castle, m.from, m.to);
      const val = minimax(nb, depth - 1, alpha, beta, true, nextSide, newEp, newCastle);
      if (val < best) best = val;
      if (val < beta) beta = val;
      if (beta <= alpha) break;
    }
    return best;
  }
}

function getBestMove(b, side, depth) {
  const moves = getLegalMoves(b, side, enPassant, castling);
  if (moves.length === 0) return null;

  const ordered = orderMoves(moves, b);
  const isMax = side === 'w';
  let bestMove = null;
  let bestVal = isMax ? -Infinity : Infinity;

  for (const m of ordered) {
    const nb = applyMove(b, m);
    const newEp = m.doublePush ? (m.from + m.to) >> 1 : -1;
    const newCastle = updateCastleRights(castling, m.from, m.to);
    const val = minimax(nb, depth - 1, -Infinity, Infinity, !isMax, enemySide(side), newEp, newCastle);

    if (isMax ? val > bestVal : val < bestVal) {
      bestVal = val;
      bestMove = m;
    }
  }

  return bestMove;
}

function triggerAI() {
  if (!aiEnabled || gameOver || turn !== aiSide || aiThinking) return;
  aiThinking = true;
  updateStatus();

  const depthMap = { easy: 1, medium: 2, hard: 3 };
  const depth = depthMap[aiDifficulty] || parseInt(aiDifficulty) || 2;

  setTimeout(() => {
    const move = getBestMove(board, aiSide, depth);
    aiThinking = false;
    if (move) {
      if (move.promo) move.promo = 'q'; // AI always promotes to queen
      openingTrack(move.from, move.to);
      executeMove(move);
    } else {
      render();
    }
  }, 30);
}

// ============================================================
// 16. OPENING BOOK
// ============================================================
const OPENING_BOOK = {
  'e2e4':                                         "King's Pawn",
  'e2e4,e7e5':                                    "Open Game",
  'e2e4,e7e5,g1f3':                               "King's Knight",
  'e2e4,e7e5,g1f3,b8c6':                          "Two Knights / Three Knights",
  'e2e4,e7e5,g1f3,b8c6,f1b5':                     "Ruy Lopez",
  'e2e4,e7e5,g1f3,b8c6,f1b5,a7a6':               "Ruy Lopez: Morphy Defense",
  'e2e4,e7e5,g1f3,b8c6,f1c4':                     "Italian Game",
  'e2e4,e7e5,g1f3,b8c6,f1c4,f8c5':               "Giuoco Piano",
  'e2e4,e7e5,g1f3,b8c6,f1c4,g8f6':               "Two Knights Defense",
  'e2e4,e7e5,g1f3,b8c6,d2d4':                     "Scotch Game",
  'e2e4,e7e5,g1f3,b8c6,d2d4,e5d4':               "Scotch Game: Main Line",
  'e2e4,e7e5,f2f4':                               "King's Gambit",
  'e2e4,e7e5,f2f4,e5f4':                          "King's Gambit Accepted",
  'e2e4,e7e5,f1c4':                               "Bishop's Opening",
  'e2e4,e7e5,d2d4':                               "Center Game",
  'e2e4,e7e5,b1c3':                               "Vienna Game",
  'e2e4,c7c5':                                    "Sicilian Defense",
  'e2e4,c7c5,g1f3':                               "Sicilian: Open Variation",
  'e2e4,c7c5,g1f3,d7d6':                          "Sicilian: Najdorf",
  'e2e4,c7c5,g1f3,b8c6':                          "Sicilian: Classical",
  'e2e4,c7c5,g1f3,e7e6':                          "Sicilian: Scheveningen",
  'e2e4,c7c5,b1c3':                               "Sicilian: Closed",
  'e2e4,e7e6':                                    "French Defense",
  'e2e4,e7e6,d2d4,d7d5':                          "French: Classical",
  'e2e4,e7e6,d2d4,d7d5,e4e5':                     "French: Advance",
  'e2e4,e7e6,d2d4,d7d5,b1c3':                     "French: Classical Variation",
  'e2e4,c7c6':                                    "Caro-Kann Defense",
  'e2e4,c7c6,d2d4,d7d5':                          "Caro-Kann: Classical",
  'e2e4,d7d5':                                    "Scandinavian Defense",
  'e2e4,d7d5,e4d5':                               "Scandinavian: Main Line",
  'e2e4,g8f6':                                    "Alekhine's Defense",
  'e2e4,g7g6':                                    "Modern Defense",
  'd2d4':                                         "Queen's Pawn",
  'd2d4,d7d5':                                    "Closed Game",
  'd2d4,d7d5,c2c4':                               "Queen's Gambit",
  'd2d4,d7d5,c2c4,e7e6':                          "Queen's Gambit Declined",
  'd2d4,d7d5,c2c4,c7c6':                          "Slav Defense",
  'd2d4,d7d5,c2c4,d5c4':                          "Queen's Gambit Accepted",
  'd2d4,d7d5,c2c4,c7c6,g1f3,g8f6':               "Slav: Three Knights",
  'd2d4,g8f6':                                    "Indian Defense",
  'd2d4,g8f6,c2c4':                               "Indian: Main Systems",
  'd2d4,g8f6,c2c4,g7g6':                          "King's Indian Defense",
  'd2d4,g8f6,c2c4,g7g6,b1c3,f8g7':              "King's Indian: Classical",
  'd2d4,g8f6,c2c4,e7e6':                          "Nimzo-Indian / Queen's Indian",
  'd2d4,g8f6,c2c4,e7e6,b1c3,f8b4':              "Nimzo-Indian Defense",
  'd2d4,g8f6,c2c4,e7e6,g1f3,b7b6':              "Queen's Indian Defense",
  'd2d4,g8f6,c2c4,c7c5':                          "Benoni Defense",
  'd2d4,g8f6,g1f3,d7d5,c1f4':                    "London System",
  'd2d4,g8f6,g1f3,e7e6,c1f4':                    "London System",
  'c2c4':                                         "English Opening",
  'c2c4,e7e5':                                    "English: Reversed Sicilian",
  'c2c4,g8f6':                                    "English: Symmetrical",
  'c2c4,c7c5':                                    "English: Symmetrical",
  'g1f3':                                         "Reti Opening",
  'g1f3,d7d5':                                    "Reti: Main Line",
  'g1f3,d7d5,c2c4':                               "Reti: Queen's Gambit Hybrid",
  'g1f3,g8f6':                                    "Reti / Symmetrical",
  'b2b3':                                         "Nimzowitsch-Larsen Attack",
  'd2d4,d7d5,c1f4':                               "London System",
};

function openingTrack(from, to) {
  const key = sqName(from) + sqName(to);
  openingMoveKeys.push(key);
  const seq = openingMoveKeys.join(',');
  if (OPENING_BOOK[seq]) openingName = OPENING_BOOK[seq];
  // Check if any opening still starts with this prefix
  const anyPrefix = Object.keys(OPENING_BOOK).some(k => k.startsWith(seq + ',') || k === seq);
  if (!anyPrefix) openingMoveKeys = []; // no more openings to track
}

// ============================================================
// 17. BOARD FLIP
// ============================================================
function flipBoard() {
  boardFlipped = !boardFlipped;
  render();
}

// ============================================================
// 18. THEME SYSTEM
// ============================================================
const THEMES = ['classic', 'green', 'blue', 'brown', 'purple', 'high-contrast'];

function setTheme(name) {
  if (!THEMES.includes(name)) return;
  for (const t of THEMES) document.body.classList.remove('theme-' + t);
  document.body.classList.add('theme-' + name);
  currentTheme = name;
}

// ============================================================
// 19. DRAW DETECTION + 30. POSITION HASHING
// ============================================================
function positionKey(b, t, castle, ep) {
  return b.join('') + t
    + (castle.K ? 'K' : '') + (castle.Q ? 'Q' : '')
    + (castle.k ? 'k' : '') + (castle.q ? 'q' : '')
    + (ep >= 0 ? ep : '-');
}

function isThreefoldRepetition() {
  const key = positionKey(board, turn, castling, enPassant);
  let count = 0;
  for (const k of posHistory) if (k === key) count++;
  return count >= 3;
}

function isInsufficientMaterial(b) {
  const wBishops = [], bBishops = [];
  let wKnights = 0, bKnights = 0;
  let wMajors = 0, bMajors = 0;

  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p.toLowerCase() === 'k') continue;
    const t = p.toLowerCase();
    if (isWhitePiece(p)) {
      if (t === 'q' || t === 'r' || t === 'p') wMajors++;
      else if (t === 'b') wBishops.push(i);
      else if (t === 'n') wKnights++;
    } else {
      if (t === 'q' || t === 'r' || t === 'p') bMajors++;
      else if (t === 'b') bBishops.push(i);
      else if (t === 'n') bKnights++;
    }
  }

  if (wMajors || bMajors) return false;
  const wMinor = wBishops.length + wKnights;
  const bMinor = bBishops.length + bKnights;
  if (wMinor === 0 && bMinor === 0) return true; // K vs K
  if (wMinor === 1 && bMinor === 0) return true; // K+B/N vs K
  if (wMinor === 0 && bMinor === 1) return true; // K vs K+B/N

  // K+B vs K+B: same color bishops
  if (wBishops.length === 1 && bBishops.length === 1 && wKnights === 0 && bKnights === 0) {
    const wSquareColor = (sqRow(wBishops[0]) + sqCol(wBishops[0])) % 2;
    const bSquareColor = (sqRow(bBishops[0]) + sqCol(bBishops[0])) % 2;
    if (wSquareColor === bSquareColor) return true;
  }

  return false;
}

function isFiftyMoveRule() {
  return halfmove >= 100;
}

function isStalemate() {
  return !inCheck(board, turn) && getLegalMoves(board, turn, enPassant, castling).length === 0;
}

// ============================================================
// 20. FEN / PGN
// ============================================================
function loadFEN() {
  const input = document.getElementById('fenInput');
  if (!input) return;
  const fen = input.value.trim();
  if (!fen) { showToast('Please enter a FEN string', 'warning'); return; }
  try {
    parseFEN(fen);
    resetGameState();
    showToast('FEN loaded!', 'success');
  } catch(e) {
    showToast('Invalid FEN string', 'error');
  }
}

function exportFEN() {
  const fen = toFEN();
  const input = document.getElementById('fenInput');
  if (input) input.value = fen;
  showToast('FEN copied to field', 'info');
  return fen;
}

function exportPGN() {
  const el = document.getElementById('pgnOutput');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  let pgn = '[Event "Chess Game"]\n';
  pgn += '[Site "Chess Engine"]\n';
  pgn += '[Date "' + date + '"]\n';
  pgn += '[White "' + (aiSide === 'w' ? 'Computer' : 'Player') + '"]\n';
  pgn += '[Black "' + (aiSide === 'b' ? 'Computer' : 'Player') + '"]\n';
  const resultStr = gameResult === 'w' ? '1-0'
                  : gameResult === 'b' ? '0-1'
                  : gameResult === 'draw' ? '1/2-1/2'
                  : '*';
  pgn += '[Result "' + resultStr + '"]\n\n';

  for (let i = 0; i < moveNotations.length; i += 2) {
    pgn += (Math.floor(i / 2) + 1) + '. ' + moveNotations[i];
    if (moveNotations[i + 1] !== undefined) pgn += ' ' + moveNotations[i + 1];
    pgn += ' ';
  }
  pgn += resultStr;

  if (el) el.value = pgn.trim();
  showToast('PGN exported', 'success');
  return pgn;
}

// ============================================================
// 21. TOAST NOTIFICATIONS
// ============================================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const colors = {
    info:    '#3498db',
    success: '#2ecc71',
    error:   '#e74c3c',
    warning: '#f39c12',
  };

  const toast = document.createElement('div');
  toast.style.cssText = [
    'padding:10px 18px',
    'margin-bottom:8px',
    'border-radius:6px',
    'font-size:14px',
    'color:#fff',
    'opacity:1',
    'transition:opacity 0.4s',
    'background:' + (colors[type] || colors.info),
    'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
    'cursor:pointer',
    'max-width:280px',
    'word-wrap:break-word',
  ].join(';');
  toast.textContent = message;
  toast.onclick = () => dismiss();

  const dismiss = () => {
    toast.style.opacity = '0';
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
  };

  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

// ============================================================
// 22. KEYBOARD SHORTCUTS
// ============================================================
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        undoMove();
        break;
      case 'f':
      case 'F':
        flipBoard();
        break;
      case 'n':
      case 'N':
        newGame();
        break;
      case 'Escape':
        e.preventDefault();
        selectedSq = null;
        closeAllModals();
        render();
        break;
      case 's':
      case 'S':
        soundEnabled = !soundEnabled;
        showToast('Sound ' + (soundEnabled ? 'on' : 'off'), 'info', 1500);
        break;
      case '/':
        e.preventDefault();
        toggleShortcutsModal();
        break;
    }
  });
}

function closeAllModals() {
  for (const id of ['settingsModal', 'shortcutsModal']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
}

function toggleSettings() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

function toggleShortcutsModal() {
  const modal = document.getElementById('shortcutsModal');
  if (!modal) return;
  modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// ============================================================
// 23. STATISTICS (localStorage)
// ============================================================
function loadStats() {
  try {
    statsWins   = parseInt(localStorage.getItem('chess_wins')   || '0');
    statsLosses = parseInt(localStorage.getItem('chess_losses') || '0');
    statsDraws  = parseInt(localStorage.getItem('chess_draws')  || '0');
  } catch(e) {}
  updateStatsDisplay();
}

function saveStats() {
  try {
    localStorage.setItem('chess_wins',   statsWins);
    localStorage.setItem('chess_losses', statsLosses);
    localStorage.setItem('chess_draws',  statsDraws);
  } catch(e) {}
}

function updateStats(result) {
  if (!aiEnabled) return; // Only track stats in AI games
  const humanSide = enemySide(aiSide);
  if (result === 'draw') statsDraws++;
  else if (result === humanSide) statsWins++;
  else statsLosses++;
  saveStats();
  updateStatsDisplay();
}

function updateStatsDisplay() {
  const w = document.getElementById('statsWins');
  const l = document.getElementById('statsLosses');
  const d = document.getElementById('statsDraws');
  if (w) w.textContent = statsWins;
  if (l) l.textContent = statsLosses;
  if (d) d.textContent = statsDraws;
}

// ============================================================
// 24. PUZZLE MODE
// ============================================================
const PUZZLES = [
  {
    fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
    solution: ['h1h8'],
    description: 'Mate in 1: Rook to h8 #',
  },
  {
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
    solution: ['f3g5', 'f6e4', 'g5f7'],
    description: 'Fried Liver Attack - sacrifice on f7',
  },
  {
    fen: '6k1/5ppp/8/8/8/8/8/R3K3 w Q - 0 1',
    solution: ['a1a8'],
    description: 'Mate in 1 with Rook',
  },
  {
    fen: '8/8/8/8/8/1k6/8/1K1R4 w - - 0 1',
    solution: ['d1d3'],
    description: 'Rook mate: Rd3#',
  },
  {
    fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
    solution: ['e1g1'],
    description: 'Practice castling kingside',
  },
  {
    fen: '2r3k1/5ppp/p7/1p2p3/4P3/1P1Q4/P4PPP/6K1 w - - 0 1',
    solution: ['d3d8'],
    description: 'Back rank mate: Qd8#',
  },
  {
    fen: '3k4/8/3K4/8/8/8/8/7R w - - 0 1',
    solution: ['h1h8'],
    description: 'K+R vs K: Rook mate',
  },
  {
    fen: '6k1/R7/6K1/8/8/8/8/8 w - - 0 1',
    solution: ['a7a8'],
    description: 'Simple rook mate: Ra8#',
  },
  {
    fen: 'r2qkb1r/ppp2ppp/2np1n2/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 6',
    solution: ['f3e5'],
    description: 'Fork: Knight captures e5',
  },
  {
    fen: '4k3/8/4K3/4Q3/8/8/8/8 w - - 0 1',
    solution: ['e5e7'],
    description: 'King and Queen mate: Qe7#',
  },
];

function startPuzzle(index) {
  if (index < 0 || index >= PUZZLES.length) {
    showToast('Puzzle not found', 'error');
    return;
  }
  currentPuzzle = PUZZLES[index];
  puzzleMoveIndex = 0;
  puzzleMode = true;
  aiEnabled = false;
  stopClock();

  parseFEN(currentPuzzle.fen);
  resetGameState();

  const el = document.getElementById('puzzleInfo');
  if (el) el.textContent = 'Puzzle ' + (index + 1) + ': ' + currentPuzzle.description;

  showToast('Puzzle started! ' + currentPuzzle.description, 'info', 5000);
  render();
}

function checkPuzzleMove(from, to) {
  if (!puzzleMode || !currentPuzzle) return true;
  const expected = currentPuzzle.solution[puzzleMoveIndex];
  if (!expected) return true;
  const moveStr = sqName(from) + sqName(to);
  if (moveStr === expected) {
    puzzleMoveIndex++;
    if (puzzleMoveIndex >= currentPuzzle.solution.length) {
      setTimeout(() => showToast('Puzzle solved! Well done!', 'success', 4000), 300);
      puzzleMode = false;
      currentPuzzle = null;
    } else {
      setTimeout(() => showToast('Correct! Keep going\u2026', 'success', 2000), 200);
    }
    return true;
  } else {
    showToast('Incorrect move. Try again!', 'error', 2500);
    return false;
  }
}

// ============================================================
// 25. SETTINGS
// ============================================================
function loadSettings() {
  try {
    soundEnabled  = localStorage.getItem('chess_sound') !== 'false';
    aiEnabled     = localStorage.getItem('chess_ai') !== 'false';
    aiDifficulty  = localStorage.getItem('chess_difficulty') || 'medium';
    aiSide        = localStorage.getItem('chess_ai_side') || 'b';
    const theme   = localStorage.getItem('chess_theme') || 'classic';
    setTheme(theme);
    const timeSec = parseInt(localStorage.getItem('chess_time') || '600');
    configTimeMs  = timeSec * 1000;
    clockWhiteMs  = configTimeMs;
    clockBlackMs  = configTimeMs;
    const incSec  = parseInt(localStorage.getItem('chess_increment') || '0');
    clockIncrement = incSec * 1000;
  } catch(e) {}
}

function saveSettings() {
  try {
    localStorage.setItem('chess_sound',     soundEnabled);
    localStorage.setItem('chess_ai',        aiEnabled);
    localStorage.setItem('chess_difficulty',aiDifficulty);
    localStorage.setItem('chess_ai_side',   aiSide);
    localStorage.setItem('chess_theme',     currentTheme);
    localStorage.setItem('chess_time',      Math.floor(configTimeMs / 1000));
    localStorage.setItem('chess_increment', Math.floor(clockIncrement / 1000));
  } catch(e) {}
}

// ============================================================
// 26. CONTEXT MENU - ARROW DRAWING
// ============================================================
function initArrows() {
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  // Canvas overlay
  arrowCanvas = document.createElement('canvas');
  arrowCanvas.style.cssText = [
    'position:absolute',
    'top:0',
    'left:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:10',
  ].join(';');

  const parent = boardEl.parentElement;
  if (parent) {
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    parent.appendChild(arrowCanvas);
  }
  arrowCtx2d = arrowCanvas.getContext('2d');

  boardEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const squareEl = e.target.closest('[data-idx]');
    if (!squareEl) return;
    const dispIdx = parseInt(squareEl.dataset.idx);
    const i = boardFlipped ? 63 - dispIdx : dispIdx;

    if (arrowStart < 0) {
      arrowStart = i;
    } else {
      if (arrowStart !== i) {
        const existing = arrowList.findIndex(a => a.from === arrowStart && a.to === i);
        if (existing >= 0) arrowList.splice(existing, 1);
        else arrowList.push({ from: arrowStart, to: i });
        renderArrows();
      }
      arrowStart = -1;
    }
  });

  boardEl.addEventListener('mousedown', (e) => {
    if (e.button === 0 && arrowList.length > 0) {
      arrowList = [];
      arrowStart = -1;
      renderArrows();
    }
  });
}

function renderArrows() {
  if (!arrowCanvas || !arrowCtx2d) return;
  const boardEl = document.getElementById('board');
  if (!boardEl) return;

  const rect = boardEl.getBoundingClientRect();
  arrowCanvas.width  = rect.width  || boardEl.offsetWidth;
  arrowCanvas.height = rect.height || boardEl.offsetHeight;

  const ctx = arrowCtx2d;
  ctx.clearRect(0, 0, arrowCanvas.width, arrowCanvas.height);

  const cellW = arrowCanvas.width / 8;
  const cellH = arrowCanvas.height / 8;

  for (const arrow of arrowList) {
    const fd = boardFlipped ? 63 - arrow.from : arrow.from;
    const td = boardFlipped ? 63 - arrow.to   : arrow.to;
    const x1 = (sqCol(fd) + 0.5) * cellW;
    const y1 = (sqRow(fd) + 0.5) * cellH;
    const x2 = (sqCol(td) + 0.5) * cellW;
    const y2 = (sqRow(td) + 0.5) * cellH;
    drawArrow(ctx, x1, y1, x2, y2, 'rgba(255,165,0,0.78)', cellW * 0.13);
  }
}

function drawArrow(ctx, x1, y1, x2, y2, color, lw) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const headLen = lw * 3;
  const ux = dx / len, uy = dy / len;
  const ex = x2 - ux * headLen * 0.5;
  const ey = y2 - uy * headLen * 0.5;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = lw;
  ctx.lineCap     = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6),
             y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6),
             y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================================================
// 27. GAME OVER OVERLAY
// ============================================================
function showGameOver(message) {
  const overlay = document.getElementById('gameOverOverlay');
  const msgEl   = document.getElementById('gameOverMessage');
  if (msgEl) msgEl.textContent = message;
  if (overlay) overlay.style.display = 'flex';
}

function hideGameOver() {
  const overlay = document.getElementById('gameOverOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ============================================================
// 28. INITIALIZATION
// ============================================================
function resetGameState() {
  history         = [];
  moveNotations   = [];
  capturedWhite   = [];
  capturedBlack   = [];
  posHistory      = [];
  selectedSq      = null;
  gameOver        = false;
  gameResult      = null;
  lastMove        = null;
  aiThinking      = false;
  openingMoveKeys = [];
  openingName     = '';
  puzzleMode      = false;
  arrowList       = [];

  legalMovesCache = getLegalMoves(board, turn, enPassant, castling);

  stopClock();
  clockWhiteMs = configTimeMs;
  clockBlackMs = configTimeMs;
  renderClocks();

  hideGameOver();
  const puzzleInfo = document.getElementById('puzzleInfo');
  if (puzzleInfo) puzzleInfo.textContent = '';
}

function newGame() {
  parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  resetGameState();
  render();
  if (aiEnabled && turn === aiSide) triggerAI();
}

function init() {
  loadSettings();
  loadStats();

  parseFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  legalMovesCache = getLegalMoves(board, turn, enPassant, castling);

  renderClocks();
  render();
  initDragDrop();
  initArrows();
  initKeyboard();
  wireButtons();

  if (aiEnabled && turn === aiSide) triggerAI();
}

function wireButtons() {
  // New game
  for (const id of ['btn-new', 'newGameBtn']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', newGame);
  }
  // Undo
  for (const id of ['btn-undo', 'undoBtn']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', undoMove);
  }
  // Flip
  for (const id of ['btn-flip', 'flipBtn']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', flipBoard);
  }

  // FEN / PGN
  const loadFenBtn = document.getElementById('loadFenBtn');
  if (loadFenBtn) loadFenBtn.addEventListener('click', loadFEN);

  const exportFenBtn = document.getElementById('exportFenBtn');
  if (exportFenBtn) exportFenBtn.addEventListener('click', exportFEN);

  const exportPgnBtn = document.getElementById('exportPgnBtn');
  if (exportPgnBtn) exportPgnBtn.addEventListener('click', exportPGN);

  // Settings toggle
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', toggleSettings);

  const shortcutsBtn = document.getElementById('shortcutsBtn');
  if (shortcutsBtn) shortcutsBtn.addEventListener('click', toggleShortcutsModal);

  // Close modals
  for (const id of ['settingsModal', 'shortcutsModal']) {
    const modal = document.getElementById(id);
    if (modal) {
      const closeBtn = modal.querySelector('.modal-close');
      if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }
  }

  // Game over new game button
  const govBtn = document.getElementById('gameOverNewGame');
  if (govBtn) govBtn.addEventListener('click', () => { hideGameOver(); newGame(); });

  // Mode select
  const modeEl = document.getElementById('mode');
  if (modeEl) {
    modeEl.addEventListener('change', () => {
      const val = modeEl.value;
      if (val === 'pvp')       { aiEnabled = false; boardFlipped = false; }
      else if (val === 'ai-black') { aiEnabled = true; aiSide = 'b'; boardFlipped = false; }
      else if (val === 'ai-white') { aiEnabled = true; aiSide = 'w'; boardFlipped = true; }
      saveSettings();
      newGame();
    });
  }

  // Difficulty select
  const diffEl = document.getElementById('difficulty');
  if (diffEl) {
    diffEl.addEventListener('change', () => {
      aiDifficulty = diffEl.value;
      saveSettings();
    });
  }

  // Settings modal controls
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) {
    soundToggle.checked = soundEnabled;
    soundToggle.addEventListener('change', () => { soundEnabled = soundToggle.checked; saveSettings(); });
  }

  const aiToggle = document.getElementById('aiToggle');
  if (aiToggle) {
    aiToggle.checked = aiEnabled;
    aiToggle.addEventListener('change', () => { aiEnabled = aiToggle.checked; saveSettings(); });
  }

  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = currentTheme;
    themeSelect.addEventListener('change', () => { setTheme(themeSelect.value); saveSettings(); });
  }

  const aiDiffSelect = document.getElementById('aiDiffSelect');
  if (aiDiffSelect) {
    aiDiffSelect.value = aiDifficulty;
    aiDiffSelect.addEventListener('change', () => { aiDifficulty = aiDiffSelect.value; saveSettings(); });
  }

  const clockTimeInput = document.getElementById('clockTimeInput');
  if (clockTimeInput) {
    clockTimeInput.value = Math.floor(configTimeMs / 60000);
    clockTimeInput.addEventListener('change', () => {
      configTimeMs = (parseInt(clockTimeInput.value) || 10) * 60000;
      clockWhiteMs = configTimeMs;
      clockBlackMs = configTimeMs;
      renderClocks();
      saveSettings();
    });
  }

  const incrementInput = document.getElementById('incrementInput');
  if (incrementInput) {
    incrementInput.value = Math.floor(clockIncrement / 1000);
    incrementInput.addEventListener('change', () => {
      clockIncrement = (parseInt(incrementInput.value) || 0) * 1000;
      saveSettings();
    });
  }

  // Puzzle buttons
  for (let i = 0; i < PUZZLES.length; i++) {
    const btn = document.getElementById('puzzle-' + i);
    if (btn) btn.addEventListener('click', () => startPuzzle(i));
  }

  // Theme buttons (data-theme attribute)
  document.querySelectorAll('[data-theme]').forEach(el => {
    el.addEventListener('click', () => { setTheme(el.dataset.theme); saveSettings(); });
  });
}

// ============================================================
// BOOTSTRAP
// ============================================================
init();
