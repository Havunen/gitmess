#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Color {
    White,
    Black,
}

impl Color {
    pub fn opposite(self) -> Color {
        match self {
            Color::White => Color::Black,
            Color::Black => Color::White,
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
    pub fn new(color: Color, kind: PieceKind) -> Self {
        Self { color, kind }
    }

    pub fn unicode_char(self) -> char {
        match (self.color, self.kind) {
            (Color::White, PieceKind::King) => '\u{2654}',
            (Color::White, PieceKind::Queen) => '\u{2655}',
            (Color::White, PieceKind::Rook) => '\u{2656}',
            (Color::White, PieceKind::Bishop) => '\u{2657}',
            (Color::White, PieceKind::Knight) => '\u{2658}',
            (Color::White, PieceKind::Pawn) => '\u{2659}',
            (Color::Black, PieceKind::King) => '\u{265A}',
            (Color::Black, PieceKind::Queen) => '\u{265B}',
            (Color::Black, PieceKind::Rook) => '\u{265C}',
            (Color::Black, PieceKind::Bishop) => '\u{265D}',
            (Color::Black, PieceKind::Knight) => '\u{265E}',
            (Color::Black, PieceKind::Pawn) => '\u{265F}',
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Pos {
    pub file: i8, // 0=a, 7=h
    pub rank: i8, // 0=rank 1 (White's back rank), 7=rank 8
}

impl Pos {
    pub fn new(file: i8, rank: i8) -> Self {
        Self { file, rank }
    }

    pub fn in_bounds(self) -> bool {
        self.file >= 0 && self.file < 8 && self.rank >= 0 && self.rank < 8
    }

    pub fn offset(self, df: i8, dr: i8) -> Self {
        Self::new(self.file + df, self.rank + dr)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MoveKind {
    Normal,
    DoublePawnPush,
    EnPassant,
    CastleKingside,
    CastleQueenside,
    Promotion(PieceKind),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Move {
    pub from: Pos,
    pub to: Pos,
    pub kind: MoveKind,
}

impl Move {
    pub fn new(from: Pos, to: Pos, kind: MoveKind) -> Self {
        Self { from, to, kind }
    }

    pub fn normal(from: Pos, to: Pos) -> Self {
        Self::new(from, to, MoveKind::Normal)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct CastlingRights {
    pub white_kingside: bool,
    pub white_queenside: bool,
    pub black_kingside: bool,
    pub black_queenside: bool,
}

impl CastlingRights {
    pub fn all() -> Self {
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
    pub squares: [[Option<Piece>; 8]; 8], // [rank][file]
    pub castling: CastlingRights,
    pub en_passant: Option<Pos>, // target square for en passant capture
    pub halfmove_clock: u32,
}

impl Board {
    pub fn starting_position() -> Self {
        let mut squares = [[None; 8]; 8];

        // White pieces (rank 0)
        squares[0][0] = Some(Piece::new(Color::White, PieceKind::Rook));
        squares[0][1] = Some(Piece::new(Color::White, PieceKind::Knight));
        squares[0][2] = Some(Piece::new(Color::White, PieceKind::Bishop));
        squares[0][3] = Some(Piece::new(Color::White, PieceKind::Queen));
        squares[0][4] = Some(Piece::new(Color::White, PieceKind::King));
        squares[0][5] = Some(Piece::new(Color::White, PieceKind::Bishop));
        squares[0][6] = Some(Piece::new(Color::White, PieceKind::Knight));
        squares[0][7] = Some(Piece::new(Color::White, PieceKind::Rook));

        // White pawns (rank 1)
        for f in 0..8 {
            squares[1][f] = Some(Piece::new(Color::White, PieceKind::Pawn));
        }

        // Black pawns (rank 6)
        for f in 0..8 {
            squares[6][f] = Some(Piece::new(Color::Black, PieceKind::Pawn));
        }

        // Black pieces (rank 7)
        squares[7][0] = Some(Piece::new(Color::Black, PieceKind::Rook));
        squares[7][1] = Some(Piece::new(Color::Black, PieceKind::Knight));
        squares[7][2] = Some(Piece::new(Color::Black, PieceKind::Bishop));
        squares[7][3] = Some(Piece::new(Color::Black, PieceKind::Queen));
        squares[7][4] = Some(Piece::new(Color::Black, PieceKind::King));
        squares[7][5] = Some(Piece::new(Color::Black, PieceKind::Bishop));
        squares[7][6] = Some(Piece::new(Color::Black, PieceKind::Knight));
        squares[7][7] = Some(Piece::new(Color::Black, PieceKind::Rook));

        Self {
            squares,
            castling: CastlingRights::all(),
            en_passant: None,
            halfmove_clock: 0,
        }
    }

    pub fn get(&self, pos: Pos) -> Option<Piece> {
        if pos.in_bounds() {
            self.squares[pos.rank as usize][pos.file as usize]
        } else {
            None
        }
    }

    pub fn set(&mut self, pos: Pos, piece: Option<Piece>) {
        if pos.in_bounds() {
            self.squares[pos.rank as usize][pos.file as usize] = piece;
        }
    }

    pub fn find_king(&self, color: Color) -> Option<Pos> {
        for rank in 0..8i8 {
            for file in 0..8i8 {
                let pos = Pos::new(file, rank);
                if let Some(p) = self.get(pos) {
                    if p.color == color && p.kind == PieceKind::King {
                        return Some(pos);
                    }
                }
            }
        }
        None
    }

    pub fn apply_move(&self, mv: Move) -> Board {
        let mut new_board = self.clone();
        let piece = new_board.get(mv.from);

        // Move the piece
        new_board.set(mv.to, piece);
        new_board.set(mv.from, None);

        // Clear en passant from previous turn
        new_board.en_passant = None;

        // Handle special moves
        match mv.kind {
            MoveKind::DoublePawnPush => {
                // Set en passant target square (the square the pawn skipped over)
                let ep_rank = (mv.from.rank + mv.to.rank) / 2;
                new_board.en_passant = Some(Pos::new(mv.from.file, ep_rank));
            }
            MoveKind::EnPassant => {
                // Remove the captured pawn
                new_board.set(Pos::new(mv.to.file, mv.from.rank), None);
            }
            MoveKind::CastleKingside => {
                // Move the rook
                let rank = mv.from.rank;
                let rook = new_board.get(Pos::new(7, rank));
                new_board.set(Pos::new(5, rank), rook);
                new_board.set(Pos::new(7, rank), None);
            }
            MoveKind::CastleQueenside => {
                // Move the rook
                let rank = mv.from.rank;
                let rook = new_board.get(Pos::new(0, rank));
                new_board.set(Pos::new(3, rank), rook);
                new_board.set(Pos::new(0, rank), None);
            }
            MoveKind::Promotion(kind) => {
                if let Some(p) = piece {
                    new_board.set(mv.to, Some(Piece::new(p.color, kind)));
                }
            }
            MoveKind::Normal => {}
        }

        // Update castling rights
        if let Some(p) = piece {
            match p.kind {
                PieceKind::King => match p.color {
                    Color::White => {
                        new_board.castling.white_kingside = false;
                        new_board.castling.white_queenside = false;
                    }
                    Color::Black => {
                        new_board.castling.black_kingside = false;
                        new_board.castling.black_queenside = false;
                    }
                },
                PieceKind::Rook => {
                    // Rook moved from its starting position
                    if mv.from == Pos::new(0, 0) {
                        new_board.castling.white_queenside = false;
                    }
                    if mv.from == Pos::new(7, 0) {
                        new_board.castling.white_kingside = false;
                    }
                    if mv.from == Pos::new(0, 7) {
                        new_board.castling.black_queenside = false;
                    }
                    if mv.from == Pos::new(7, 7) {
                        new_board.castling.black_kingside = false;
                    }
                }
                _ => {}
            }
        }

        // Also revoke castling if a rook is captured
        if mv.to == Pos::new(0, 0) {
            new_board.castling.white_queenside = false;
        }
        if mv.to == Pos::new(7, 0) {
            new_board.castling.white_kingside = false;
        }
        if mv.to == Pos::new(0, 7) {
            new_board.castling.black_queenside = false;
        }
        if mv.to == Pos::new(7, 7) {
            new_board.castling.black_kingside = false;
        }

        // Update halfmove clock
        if let Some(p) = piece {
            if p.kind == PieceKind::Pawn || self.get(mv.to).is_some() {
                new_board.halfmove_clock = 0;
            } else {
                new_board.halfmove_clock += 1;
            }
        }

        new_board
    }
}
