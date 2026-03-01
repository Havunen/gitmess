use crate::board::{Board, Color, Move, MoveKind, PieceKind, Pos};
use crate::rules::{self, GameOutcome};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameOverReason {
    Checkmate,
    Stalemate,
}

#[derive(Clone, Debug)]
pub enum GamePhase {
    SelectPiece,
    PieceSelected {
        selected: Pos,
        legal_moves: Vec<Move>,
    },
    PromotionChoice {
        choices: Vec<Move>,
    },
    GameOver {
        winner: Option<Color>,
        reason: GameOverReason,
    },
}

#[derive(Clone, Debug)]
pub struct GameState {
    pub board: Board,
    pub turn: Color,
    pub phase: GamePhase,
}

impl GameState {
    pub fn new() -> Self {
        Self {
            board: Board::new(),
            turn: Color::White,
            phase: GamePhase::SelectPiece,
        }
    }

    pub fn restart(&mut self) {
        *self = Self::new();
    }

    pub fn selected_square(&self) -> Option<Pos> {
        match &self.phase {
            GamePhase::PieceSelected { selected, .. } => Some(*selected),
            _ => None,
        }
    }

    pub fn selected_moves(&self) -> Option<&[Move]> {
        match &self.phase {
            GamePhase::PieceSelected { legal_moves, .. } => Some(legal_moves.as_slice()),
            _ => None,
        }
    }

    pub fn promotion_choices(&self) -> Option<&[Move]> {
        match &self.phase {
            GamePhase::PromotionChoice { choices } => Some(choices.as_slice()),
            _ => None,
        }
    }

    pub fn status_line(&self) -> String {
        match &self.phase {
            GamePhase::GameOver {
                winner: Some(color),
                reason: GameOverReason::Checkmate,
            } => format!("Checkmate! {} wins. Click to restart.", color.name()),
            GamePhase::GameOver {
                winner: None,
                reason: GameOverReason::Stalemate,
            } => "Stalemate. Click to restart.".to_string(),
            GamePhase::PromotionChoice { .. } => {
                format!("{} to move - choose promotion piece.", self.turn.name())
            }
            _ => {
                let mut text = format!("Turn: {}", self.turn.name());
                if rules::is_in_check(&self.board, self.turn) {
                    text.push_str(" - Check!");
                }
                text
            }
        }
    }

    pub fn handle_board_click(&mut self, pos: Pos) {
        match self.phase.clone() {
            GamePhase::SelectPiece => {
                self.select_piece(pos);
            }
            GamePhase::PieceSelected {
                selected,
                legal_moves,
            } => {
                if pos == selected {
                    self.phase = GamePhase::SelectPiece;
                    return;
                }

                if let Some(piece) = self.board.piece_at(pos) {
                    if piece.color == self.turn {
                        self.select_piece(pos);
                        return;
                    }
                }

                let destination_moves: Vec<Move> =
                    legal_moves.into_iter().filter(|mv| mv.to == pos).collect();

                if destination_moves.is_empty() {
                    self.phase = GamePhase::SelectPiece;
                    return;
                }

                if destination_moves
                    .iter()
                    .any(|mv| matches!(mv.kind, MoveKind::Promotion(_)))
                {
                    self.phase = GamePhase::PromotionChoice {
                        choices: destination_moves,
                    };
                    return;
                }

                self.execute_move(destination_moves[0]);
            }
            GamePhase::PromotionChoice { .. } => {}
            GamePhase::GameOver { .. } => {}
        }
    }

    pub fn handle_outside_board_click(&mut self) {
        if matches!(self.phase, GamePhase::PieceSelected { .. }) {
            self.phase = GamePhase::SelectPiece;
        }
    }

    pub fn choose_promotion(&mut self, kind: PieceKind) {
        let GamePhase::PromotionChoice { choices } = self.phase.clone() else {
            return;
        };

        if let Some(chosen_move) = choices
            .into_iter()
            .find(|mv| matches!(mv.kind, MoveKind::Promotion(piece_kind) if piece_kind == kind))
        {
            self.execute_move(chosen_move);
        }
    }

    pub fn in_check(&self, color: Color) -> bool {
        rules::is_in_check(&self.board, color)
    }

    fn select_piece(&mut self, pos: Pos) {
        let Some(piece) = self.board.piece_at(pos) else {
            self.phase = GamePhase::SelectPiece;
            return;
        };
        if piece.color != self.turn {
            self.phase = GamePhase::SelectPiece;
            return;
        }

        let legal_moves = rules::legal_moves_for_square(&self.board, self.turn, pos);
        self.phase = GamePhase::PieceSelected {
            selected: pos,
            legal_moves,
        };
    }

    fn execute_move(&mut self, mv: Move) {
        self.board.apply_move(&mv);
        self.turn = self.turn.opposite();
        self.phase = GamePhase::SelectPiece;
        self.update_outcome();
    }

    fn update_outcome(&mut self) {
        self.phase = match rules::outcome_for_turn(&self.board, self.turn) {
            GameOutcome::Ongoing => GamePhase::SelectPiece,
            GameOutcome::Checkmate { winner } => GamePhase::GameOver {
                winner: Some(winner),
                reason: GameOverReason::Checkmate,
            },
            GameOutcome::Stalemate => GamePhase::GameOver {
                winner: None,
                reason: GameOverReason::Stalemate,
            },
        };
    }
}
