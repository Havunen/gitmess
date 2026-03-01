#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Color {
    White,
    Black,
}

impl Color {
    pub fn opposite(self) -> Self {
        match self {
            Self::White => Self::Black,
            Self::Black => Self::White,
        }
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::White => "White",
            Self::Black => "Black",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PieceKind {
    King,
    Queen,
    Rook,
    Bishop,
    Knight,
    Pawn,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Piece {
    pub color: Color,
    pub kind: PieceKind,
}

impl Piece {
    pub fn unicode_symbol(self) -> &'static str {
        match (self.color, self.kind) {
            (Color::White, PieceKind::King) => "\u{2654}",
            (Color::White, PieceKind::Queen) => "\u{2655}",
            (Color::White, PieceKind::Rook) => "\u{2656}",
            (Color::White, PieceKind::Bishop) => "\u{2657}",
            (Color::White, PieceKind::Knight) => "\u{2658}",
            (Color::White, PieceKind::Pawn) => "\u{2659}",
            (Color::Black, PieceKind::King) => "\u{265A}",
            (Color::Black, PieceKind::Queen) => "\u{265B}",
            (Color::Black, PieceKind::Rook) => "\u{265C}",
            (Color::Black, PieceKind::Bishop) => "\u{265D}",
            (Color::Black, PieceKind::Knight) => "\u{265E}",
            (Color::Black, PieceKind::Pawn) => "\u{265F}",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pos {
    pub file: i8,
    pub rank: i8,
}

impl Pos {
    pub const fn new(file: i8, rank: i8) -> Self {
        Self { file, rank }
    }

    pub fn is_valid(self) -> bool {
        (0..8).contains(&self.file) && (0..8).contains(&self.rank)
    }

    pub fn to_index(self) -> Option<(usize, usize)> {
        if !self.is_valid() {
            return None;
        }
        Some((self.rank as usize, self.file as usize))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MoveKind {
    Normal,
    DoublePawnPush,
    EnPassant,
    Castle { kingside: bool },
    Promotion(PieceKind),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Move {
    pub from: Pos,
    pub to: Pos,
    pub kind: MoveKind,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

impl Default for CastlingRights {
    fn default() -> Self {
        Self {
            white_kingside: true,
            white_queenside: true,
            black_kingside: true,
            black_queenside: true,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Board {
    pub squares: [[Option<Piece>; 8]; 8],
    pub castling: CastlingRights,
    pub en_passant_target: Option<Pos>,
}

impl Board {
    pub fn new() -> Self {
        let mut board = Self {
            squares: [[None; 8]; 8],
            castling: CastlingRights::default(),
            en_passant_target: None,
        };
        board.setup_initial_position();
        board
    }

    fn setup_initial_position(&mut self) {
        let back_rank = [
            PieceKind::Rook,
            PieceKind::Knight,
            PieceKind::Bishop,
            PieceKind::Queen,
            PieceKind::King,
            PieceKind::Bishop,
            PieceKind::Knight,
            PieceKind::Rook,
        ];

        for (file, kind) in back_rank.iter().enumerate() {
            self.squares[0][file] = Some(Piece {
                color: Color::White,
                kind: *kind,
            });
            self.squares[1][file] = Some(Piece {
                color: Color::White,
                kind: PieceKind::Pawn,
            });
            self.squares[6][file] = Some(Piece {
                color: Color::Black,
                kind: PieceKind::Pawn,
            });
            self.squares[7][file] = Some(Piece {
                color: Color::Black,
                kind: *kind,
            });
        }
    }

    pub fn piece_at(&self, pos: Pos) -> Option<Piece> {
        let (rank, file) = pos.to_index()?;
        self.squares[rank][file]
    }

    pub fn set_piece(&mut self, pos: Pos, piece: Option<Piece>) {
        if let Some((rank, file)) = pos.to_index() {
            self.squares[rank][file] = piece;
        }
    }

    pub fn apply_move(&mut self, mv: &Move) {
        let moving_piece = self
            .piece_at(mv.from)
            .expect("apply_move called with empty source square");

        let (captured_piece, captured_square) = match mv.kind {
            MoveKind::EnPassant => {
                let capture_pos = Pos::new(mv.to.file, mv.from.rank);
                let captured = self.piece_at(capture_pos);
                self.set_piece(capture_pos, None);
                (captured, capture_pos)
            }
            _ => (self.piece_at(mv.to), mv.to),
        };

        self.set_piece(mv.from, None);
        self.en_passant_target = None;

        match mv.kind {
            MoveKind::Castle { kingside } => {
                let rank = if moving_piece.color == Color::White {
                    0
                } else {
                    7
                };
                let (rook_from_file, rook_to_file, king_to_file) =
                    if kingside { (7, 5, 6) } else { (0, 3, 2) };

                self.set_piece(
                    Pos::new(king_to_file, rank),
                    Some(Piece {
                        color: moving_piece.color,
                        kind: PieceKind::King,
                    }),
                );
                let rook = self.piece_at(Pos::new(rook_from_file, rank));
                self.set_piece(Pos::new(rook_from_file, rank), None);
                self.set_piece(Pos::new(rook_to_file, rank), rook);
            }
            MoveKind::Promotion(kind) => {
                self.set_piece(
                    mv.to,
                    Some(Piece {
                        color: moving_piece.color,
                        kind,
                    }),
                );
            }
            _ => {
                self.set_piece(mv.to, Some(moving_piece));
            }
        }

        self.update_castling_rights(moving_piece, mv.from, captured_piece, captured_square);

        if matches!(mv.kind, MoveKind::DoublePawnPush) {
            let target_rank = (mv.from.rank + mv.to.rank) / 2;
            self.en_passant_target = Some(Pos::new(mv.from.file, target_rank));
        }
    }

    fn update_castling_rights(
        &mut self,
        moving_piece: Piece,
        from: Pos,
        captured_piece: Option<Piece>,
        captured_square: Pos,
    ) {
        match moving_piece.kind {
            PieceKind::King => {
                if moving_piece.color == Color::White {
                    self.castling.white_kingside = false;
                    self.castling.white_queenside = false;
                } else {
                    self.castling.black_kingside = false;
                    self.castling.black_queenside = false;
                }
            }
            PieceKind::Rook => {
                self.revoke_rook_right_for_square(moving_piece.color, from);
            }
            _ => {}
        }

        if let Some(piece) = captured_piece {
            if piece.kind == PieceKind::Rook {
                self.revoke_rook_right_for_square(piece.color, captured_square);
            }
        }
    }

    fn revoke_rook_right_for_square(&mut self, color: Color, square: Pos) {
        match (color, square.file, square.rank) {
            (Color::White, 0, 0) => self.castling.white_queenside = false,
            (Color::White, 7, 0) => self.castling.white_kingside = false,
            (Color::Black, 0, 7) => self.castling.black_queenside = false,
            (Color::Black, 7, 7) => self.castling.black_kingside = false,
            _ => {}
        }
    }
}
