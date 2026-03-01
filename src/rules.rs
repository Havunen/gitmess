use crate::board::{Board, Color, Move, MoveKind, Piece, PieceKind, Pos};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameOutcome {
    Ongoing,
    Checkmate { winner: Color },
    Stalemate,
}

pub fn legal_moves(board: &Board, color: Color) -> Vec<Move> {
    let mut moves = Vec::new();
    for rank in 0..8 {
        for file in 0..8 {
            let from = Pos::new(file, rank);
            let Some(piece) = board.piece_at(from) else {
                continue;
            };
            if piece.color != color {
                continue;
            }

            for mv in pseudo_legal_moves_for_piece(board, from, piece) {
                if is_legal_move(board, color, &mv) {
                    moves.push(mv);
                }
            }
        }
    }
    moves
}

pub fn legal_moves_for_square(board: &Board, color: Color, from: Pos) -> Vec<Move> {
    let Some(piece) = board.piece_at(from) else {
        return Vec::new();
    };
    if piece.color != color {
        return Vec::new();
    }

    pseudo_legal_moves_for_piece(board, from, piece)
        .into_iter()
        .filter(|mv| is_legal_move(board, color, mv))
        .collect()
}

pub fn is_legal_move(board: &Board, color: Color, mv: &Move) -> bool {
    if let MoveKind::Castle { kingside } = mv.kind {
        if !can_castle(board, color, kingside) {
            return false;
        }
    }

    let mut clone = board.clone();
    clone.apply_move(mv);
    !is_in_check(&clone, color)
}

pub fn outcome_for_turn(board: &Board, turn: Color) -> GameOutcome {
    let moves = legal_moves(board, turn);
    if !moves.is_empty() {
        return GameOutcome::Ongoing;
    }

    if is_in_check(board, turn) {
        GameOutcome::Checkmate {
            winner: turn.opposite(),
        }
    } else {
        GameOutcome::Stalemate
    }
}

pub fn king_pos(board: &Board, color: Color) -> Option<Pos> {
    for rank in 0..8 {
        for file in 0..8 {
            let pos = Pos::new(file, rank);
            let Some(piece) = board.piece_at(pos) else {
                continue;
            };
            if piece.color == color && piece.kind == PieceKind::King {
                return Some(pos);
            }
        }
    }
    None
}

pub fn is_in_check(board: &Board, color: Color) -> bool {
    let Some(king_square) = king_pos(board, color) else {
        return false;
    };
    is_square_attacked(board, king_square, color.opposite())
}

pub fn is_square_attacked(board: &Board, square: Pos, by_color: Color) -> bool {
    let pawn_origin_rank = square.rank + if by_color == Color::White { -1 } else { 1 };
    for file_delta in [-1, 1] {
        let origin = Pos::new(square.file + file_delta, pawn_origin_rank);
        if let Some(piece) = board.piece_at(origin) {
            if piece.color == by_color && piece.kind == PieceKind::Pawn {
                return true;
            }
        }
    }

    const KNIGHT_DELTAS: [(i8, i8); 8] = [
        (1, 2),
        (2, 1),
        (2, -1),
        (1, -2),
        (-1, -2),
        (-2, -1),
        (-2, 1),
        (-1, 2),
    ];
    for (df, dr) in KNIGHT_DELTAS {
        let origin = Pos::new(square.file + df, square.rank + dr);
        if let Some(piece) = board.piece_at(origin) {
            if piece.color == by_color && piece.kind == PieceKind::Knight {
                return true;
            }
        }
    }

    const KING_DELTAS: [(i8, i8); 8] = [
        (-1, -1),
        (0, -1),
        (1, -1),
        (-1, 0),
        (1, 0),
        (-1, 1),
        (0, 1),
        (1, 1),
    ];
    for (df, dr) in KING_DELTAS {
        let origin = Pos::new(square.file + df, square.rank + dr);
        if let Some(piece) = board.piece_at(origin) {
            if piece.color == by_color && piece.kind == PieceKind::King {
                return true;
            }
        }
    }

    if attacked_by_slider(
        board,
        square,
        by_color,
        &[(1, 0), (-1, 0), (0, 1), (0, -1)],
        &[PieceKind::Rook, PieceKind::Queen],
    ) {
        return true;
    }

    attacked_by_slider(
        board,
        square,
        by_color,
        &[(1, 1), (1, -1), (-1, 1), (-1, -1)],
        &[PieceKind::Bishop, PieceKind::Queen],
    )
}

fn attacked_by_slider(
    board: &Board,
    square: Pos,
    by_color: Color,
    directions: &[(i8, i8)],
    attackers: &[PieceKind],
) -> bool {
    for &(df, dr) in directions {
        let mut file = square.file + df;
        let mut rank = square.rank + dr;
        while Pos::new(file, rank).is_valid() {
            let pos = Pos::new(file, rank);
            if let Some(piece) = board.piece_at(pos) {
                if piece.color == by_color && attackers.contains(&piece.kind) {
                    return true;
                }
                break;
            }
            file += df;
            rank += dr;
        }
    }
    false
}

fn pseudo_legal_moves_for_piece(board: &Board, from: Pos, piece: Piece) -> Vec<Move> {
    match piece.kind {
        PieceKind::Pawn => pawn_moves(board, from, piece.color),
        PieceKind::Knight => knight_moves(board, from, piece.color),
        PieceKind::Bishop => slider_moves(
            board,
            from,
            piece.color,
            &[(1, 1), (1, -1), (-1, 1), (-1, -1)],
        ),
        PieceKind::Rook => slider_moves(
            board,
            from,
            piece.color,
            &[(1, 0), (-1, 0), (0, 1), (0, -1)],
        ),
        PieceKind::Queen => slider_moves(
            board,
            from,
            piece.color,
            &[
                (1, 0),
                (-1, 0),
                (0, 1),
                (0, -1),
                (1, 1),
                (1, -1),
                (-1, 1),
                (-1, -1),
            ],
        ),
        PieceKind::King => king_moves(board, from, piece.color),
    }
}

fn pawn_moves(board: &Board, from: Pos, color: Color) -> Vec<Move> {
    let mut moves = Vec::new();
    let direction = if color == Color::White { 1 } else { -1 };
    let start_rank = if color == Color::White { 1 } else { 6 };
    let promotion_rank = if color == Color::White { 7 } else { 0 };

    let one_step = Pos::new(from.file, from.rank + direction);
    if one_step.is_valid() && board.piece_at(one_step).is_none() {
        add_pawn_advance_or_promotion(&mut moves, from, one_step, promotion_rank, MoveKind::Normal);

        let two_step = Pos::new(from.file, from.rank + 2 * direction);
        if from.rank == start_rank && board.piece_at(two_step).is_none() {
            moves.push(Move {
                from,
                to: two_step,
                kind: MoveKind::DoublePawnPush,
            });
        }
    }

    for file_delta in [-1, 1] {
        let target = Pos::new(from.file + file_delta, from.rank + direction);
        if !target.is_valid() {
            continue;
        }

        if let Some(piece) = board.piece_at(target) {
            if piece.color != color {
                add_pawn_advance_or_promotion(
                    &mut moves,
                    from,
                    target,
                    promotion_rank,
                    MoveKind::Normal,
                );
            }
        }
    }

    if let Some(ep_target) = board.en_passant_target {
        if ep_target.rank == from.rank + direction && (ep_target.file - from.file).abs() == 1 {
            let captured_pos = Pos::new(ep_target.file, from.rank);
            if let Some(captured) = board.piece_at(captured_pos) {
                if captured.color != color && captured.kind == PieceKind::Pawn {
                    moves.push(Move {
                        from,
                        to: ep_target,
                        kind: MoveKind::EnPassant,
                    });
                }
            }
        }
    }

    moves
}

fn add_pawn_advance_or_promotion(
    moves: &mut Vec<Move>,
    from: Pos,
    to: Pos,
    promotion_rank: i8,
    non_promotion_kind: MoveKind,
) {
    if to.rank == promotion_rank {
        for kind in [
            PieceKind::Queen,
            PieceKind::Rook,
            PieceKind::Bishop,
            PieceKind::Knight,
        ] {
            moves.push(Move {
                from,
                to,
                kind: MoveKind::Promotion(kind),
            });
        }
    } else {
        moves.push(Move {
            from,
            to,
            kind: non_promotion_kind,
        });
    }
}

fn knight_moves(board: &Board, from: Pos, color: Color) -> Vec<Move> {
    const DELTAS: [(i8, i8); 8] = [
        (1, 2),
        (2, 1),
        (2, -1),
        (1, -2),
        (-1, -2),
        (-2, -1),
        (-2, 1),
        (-1, 2),
    ];
    let mut moves = Vec::new();
    for (df, dr) in DELTAS {
        let to = Pos::new(from.file + df, from.rank + dr);
        if !to.is_valid() {
            continue;
        }
        if board
            .piece_at(to)
            .map(|piece| piece.color != color)
            .unwrap_or(true)
        {
            moves.push(Move {
                from,
                to,
                kind: MoveKind::Normal,
            });
        }
    }
    moves
}

fn slider_moves(board: &Board, from: Pos, color: Color, directions: &[(i8, i8)]) -> Vec<Move> {
    let mut moves = Vec::new();
    for &(df, dr) in directions {
        let mut file = from.file + df;
        let mut rank = from.rank + dr;

        while Pos::new(file, rank).is_valid() {
            let to = Pos::new(file, rank);
            if let Some(piece) = board.piece_at(to) {
                if piece.color != color {
                    moves.push(Move {
                        from,
                        to,
                        kind: MoveKind::Normal,
                    });
                }
                break;
            }

            moves.push(Move {
                from,
                to,
                kind: MoveKind::Normal,
            });
            file += df;
            rank += dr;
        }
    }
    moves
}

fn king_moves(board: &Board, from: Pos, color: Color) -> Vec<Move> {
    let mut moves = Vec::new();
    for df in -1..=1 {
        for dr in -1..=1 {
            if df == 0 && dr == 0 {
                continue;
            }
            let to = Pos::new(from.file + df, from.rank + dr);
            if !to.is_valid() {
                continue;
            }
            if board
                .piece_at(to)
                .map(|piece| piece.color != color)
                .unwrap_or(true)
            {
                moves.push(Move {
                    from,
                    to,
                    kind: MoveKind::Normal,
                });
            }
        }
    }

    if can_castle(board, color, true) {
        let rank = if color == Color::White { 0 } else { 7 };
        moves.push(Move {
            from,
            to: Pos::new(6, rank),
            kind: MoveKind::Castle { kingside: true },
        });
    }
    if can_castle(board, color, false) {
        let rank = if color == Color::White { 0 } else { 7 };
        moves.push(Move {
            from,
            to: Pos::new(2, rank),
            kind: MoveKind::Castle { kingside: false },
        });
    }

    moves
}

fn can_castle(board: &Board, color: Color, kingside: bool) -> bool {
    let rank = if color == Color::White { 0 } else { 7 };
    let king_start = Pos::new(4, rank);
    let rook_file = if kingside { 7 } else { 0 };
    let rook_start = Pos::new(rook_file, rank);
    let king_path_files: &[i8] = if kingside { &[5, 6] } else { &[3, 2] };
    let empty_files: &[i8] = if kingside { &[5, 6] } else { &[1, 2, 3] };

    let rights_ok = match (color, kingside) {
        (Color::White, true) => board.castling.white_kingside,
        (Color::White, false) => board.castling.white_queenside,
        (Color::Black, true) => board.castling.black_kingside,
        (Color::Black, false) => board.castling.black_queenside,
    };
    if !rights_ok {
        return false;
    }

    if board.piece_at(king_start)
        != Some(Piece {
            color,
            kind: PieceKind::King,
        })
    {
        return false;
    }
    if board.piece_at(rook_start)
        != Some(Piece {
            color,
            kind: PieceKind::Rook,
        })
    {
        return false;
    }

    if empty_files
        .iter()
        .any(|&file| board.piece_at(Pos::new(file, rank)).is_some())
    {
        return false;
    }

    if is_in_check(board, color) {
        return false;
    }
    if king_path_files
        .iter()
        .any(|&file| is_square_attacked(board, Pos::new(file, rank), color.opposite()))
    {
        return false;
    }

    true
}
