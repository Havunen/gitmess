use crate::board::*;

/// Check if a square is attacked by any piece of the given color.
pub fn is_square_attacked(board: &Board, square: Pos, by_color: Color) -> bool {
    // Knight attacks
    let knight_offsets = [
        (-2, -1), (-2, 1), (-1, -2), (-1, 2),
        (1, -2), (1, 2), (2, -1), (2, 1),
    ];
    for &(df, dr) in &knight_offsets {
        let p = square.offset(df, dr);
        if let Some(piece) = board.get(p) {
            if piece.color == by_color && piece.kind == PieceKind::Knight {
                return true;
            }
        }
    }

    // King attacks (adjacent squares)
    for df in -1..=1 {
        for dr in -1..=1 {
            if df == 0 && dr == 0 {
                continue;
            }
            let p = square.offset(df, dr);
            if let Some(piece) = board.get(p) {
                if piece.color == by_color && piece.kind == PieceKind::King {
                    return true;
                }
            }
        }
    }

    // Pawn attacks
    let pawn_dir: i8 = if by_color == Color::White { 1 } else { -1 };
    // Pawns attack from the opposite direction
    for df in [-1, 1] {
        let p = square.offset(df, -pawn_dir);
        if let Some(piece) = board.get(p) {
            if piece.color == by_color && piece.kind == PieceKind::Pawn {
                return true;
            }
        }
    }

    // Sliding pieces: rook/queen along ranks and files
    let rook_dirs = [(0, 1), (0, -1), (1, 0), (-1, 0)];
    for &(df, dr) in &rook_dirs {
        let mut p = square.offset(df, dr);
        while p.in_bounds() {
            if let Some(piece) = board.get(p) {
                if piece.color == by_color
                    && (piece.kind == PieceKind::Rook || piece.kind == PieceKind::Queen)
                {
                    return true;
                }
                break; // blocked by a piece
            }
            p = p.offset(df, dr);
        }
    }

    // Sliding pieces: bishop/queen along diagonals
    let bishop_dirs = [(1, 1), (1, -1), (-1, 1), (-1, -1)];
    for &(df, dr) in &bishop_dirs {
        let mut p = square.offset(df, dr);
        while p.in_bounds() {
            if let Some(piece) = board.get(p) {
                if piece.color == by_color
                    && (piece.kind == PieceKind::Bishop || piece.kind == PieceKind::Queen)
                {
                    return true;
                }
                break;
            }
            p = p.offset(df, dr);
        }
    }

    false
}

pub fn is_in_check(board: &Board, color: Color) -> bool {
    if let Some(king_pos) = board.find_king(color) {
        is_square_attacked(board, king_pos, color.opposite())
    } else {
        false
    }
}

/// Generate all pseudo-legal moves for a piece at the given position.
fn pseudo_legal_moves(board: &Board, pos: Pos, turn: Color) -> Vec<Move> {
    let mut moves = Vec::new();
    let piece = match board.get(pos) {
        Some(p) if p.color == turn => p,
        _ => return moves,
    };

    match piece.kind {
        PieceKind::Pawn => {
            let dir: i8 = if turn == Color::White { 1 } else { -1 };
            let start_rank = if turn == Color::White { 1 } else { 6 };
            let promo_rank = if turn == Color::White { 7 } else { 0 };

            // Single push
            let one = pos.offset(0, dir);
            if one.in_bounds() && board.get(one).is_none() {
                if one.rank == promo_rank {
                    for kind in [PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight] {
                        moves.push(Move::new(pos, one, MoveKind::Promotion(kind)));
                    }
                } else {
                    moves.push(Move::normal(pos, one));
                }

                // Double push
                if pos.rank == start_rank {
                    let two = pos.offset(0, dir * 2);
                    if two.in_bounds() && board.get(two).is_none() {
                        moves.push(Move::new(pos, two, MoveKind::DoublePawnPush));
                    }
                }
            }

            // Captures (including en passant)
            for df in [-1i8, 1] {
                let cap = pos.offset(df, dir);
                if !cap.in_bounds() {
                    continue;
                }
                if let Some(target) = board.get(cap) {
                    if target.color != turn {
                        if cap.rank == promo_rank {
                            for kind in [PieceKind::Queen, PieceKind::Rook, PieceKind::Bishop, PieceKind::Knight] {
                                moves.push(Move::new(pos, cap, MoveKind::Promotion(kind)));
                            }
                        } else {
                            moves.push(Move::normal(pos, cap));
                        }
                    }
                } else if Some(cap) == board.en_passant {
                    moves.push(Move::new(pos, cap, MoveKind::EnPassant));
                }
            }
        }

        PieceKind::Knight => {
            let offsets = [
                (-2, -1), (-2, 1), (-1, -2), (-1, 2),
                (1, -2), (1, 2), (2, -1), (2, 1),
            ];
            for &(df, dr) in &offsets {
                let to = pos.offset(df, dr);
                if to.in_bounds() {
                    match board.get(to) {
                        None => moves.push(Move::normal(pos, to)),
                        Some(p) if p.color != turn => moves.push(Move::normal(pos, to)),
                        _ => {}
                    }
                }
            }
        }

        PieceKind::Bishop => {
            sliding_moves(board, pos, turn, &[(1, 1), (1, -1), (-1, 1), (-1, -1)], &mut moves);
        }

        PieceKind::Rook => {
            sliding_moves(board, pos, turn, &[(0, 1), (0, -1), (1, 0), (-1, 0)], &mut moves);
        }

        PieceKind::Queen => {
            sliding_moves(
                board,
                pos,
                turn,
                &[(0, 1), (0, -1), (1, 0), (-1, 0), (1, 1), (1, -1), (-1, 1), (-1, -1)],
                &mut moves,
            );
        }

        PieceKind::King => {
            // Normal king moves
            for df in -1..=1i8 {
                for dr in -1..=1i8 {
                    if df == 0 && dr == 0 {
                        continue;
                    }
                    let to = pos.offset(df, dr);
                    if to.in_bounds() {
                        match board.get(to) {
                            None => moves.push(Move::normal(pos, to)),
                            Some(p) if p.color != turn => moves.push(Move::normal(pos, to)),
                            _ => {}
                        }
                    }
                }
            }

            // Castling
            let rank = if turn == Color::White { 0 } else { 7 };
            if pos == Pos::new(4, rank) && !is_in_check(board, turn) {
                // Kingside
                let can_kingside = match turn {
                    Color::White => board.castling.white_kingside,
                    Color::Black => board.castling.black_kingside,
                };
                if can_kingside
                    && board.get(Pos::new(5, rank)).is_none()
                    && board.get(Pos::new(6, rank)).is_none()
                    && !is_square_attacked(board, Pos::new(5, rank), turn.opposite())
                    && !is_square_attacked(board, Pos::new(6, rank), turn.opposite())
                {
                    moves.push(Move::new(pos, Pos::new(6, rank), MoveKind::CastleKingside));
                }

                // Queenside
                let can_queenside = match turn {
                    Color::White => board.castling.white_queenside,
                    Color::Black => board.castling.black_queenside,
                };
                if can_queenside
                    && board.get(Pos::new(3, rank)).is_none()
                    && board.get(Pos::new(2, rank)).is_none()
                    && board.get(Pos::new(1, rank)).is_none()
                    && !is_square_attacked(board, Pos::new(3, rank), turn.opposite())
                    && !is_square_attacked(board, Pos::new(2, rank), turn.opposite())
                {
                    moves.push(Move::new(pos, Pos::new(2, rank), MoveKind::CastleQueenside));
                }
            }
        }
    }

    moves
}

fn sliding_moves(board: &Board, pos: Pos, turn: Color, dirs: &[(i8, i8)], moves: &mut Vec<Move>) {
    for &(df, dr) in dirs {
        let mut to = pos.offset(df, dr);
        while to.in_bounds() {
            match board.get(to) {
                None => {
                    moves.push(Move::normal(pos, to));
                }
                Some(p) if p.color != turn => {
                    moves.push(Move::normal(pos, to));
                    break;
                }
                _ => break,
            }
            to = to.offset(df, dr);
        }
    }
}

/// Generate all legal moves for the given color.
pub fn legal_moves_for(board: &Board, turn: Color) -> Vec<Move> {
    let mut result = Vec::new();
    for rank in 0..8i8 {
        for file in 0..8i8 {
            let pos = Pos::new(file, rank);
            if let Some(p) = board.get(pos) {
                if p.color == turn {
                    for mv in pseudo_legal_moves(board, pos, turn) {
                        let new_board = board.apply_move(mv);
                        if !is_in_check(&new_board, turn) {
                            result.push(mv);
                        }
                    }
                }
            }
        }
    }
    result
}

/// Generate legal moves from a specific position.
pub fn legal_moves_from(board: &Board, pos: Pos, turn: Color) -> Vec<Move> {
    let mut result = Vec::new();
    if let Some(p) = board.get(pos) {
        if p.color == turn {
            for mv in pseudo_legal_moves(board, pos, turn) {
                let new_board = board.apply_move(mv);
                if !is_in_check(&new_board, turn) {
                    result.push(mv);
                }
            }
        }
    }
    result
}

pub fn is_checkmate(board: &Board, color: Color) -> bool {
    is_in_check(board, color) && legal_moves_for(board, color).is_empty()
}

pub fn is_stalemate(board: &Board, color: Color) -> bool {
    !is_in_check(board, color) && legal_moves_for(board, color).is_empty()
}
