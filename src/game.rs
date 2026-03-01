use crate::board::*;
use crate::rules;

#[derive(Clone, Debug)]
pub enum GamePhase {
    SelectPiece,
    PieceSelected {
        selected: Pos,
        legal_targets: Vec<Move>,
    },
    PromotionChoice {
        from: Pos,
        to: Pos,
    },
    GameOver {
        result: GameResult,
    },
}

#[derive(Clone, Debug)]
pub enum GameResult {
    Checkmate(Color), // the color that won
    Stalemate,
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
            board: Board::starting_position(),
            turn: Color::White,
            phase: GamePhase::SelectPiece,
        }
    }

    pub fn select_square(&mut self, pos: Pos) {
        match &self.phase {
            GamePhase::SelectPiece => {
                self.try_select_piece(pos);
            }
            GamePhase::PieceSelected { selected, .. } => {
                let selected = *selected;
                self.handle_target_click(selected, pos);
            }
            GamePhase::PromotionChoice { .. } => {
                // Handled separately via choose_promotion
            }
            GamePhase::GameOver { .. } => {
                // Restart
                *self = GameState::new();
            }
        }
    }

    fn try_select_piece(&mut self, pos: Pos) {
        if let Some(piece) = self.board.get(pos) {
            if piece.color == self.turn {
                let legal_targets = rules::legal_moves_from(&self.board, pos, self.turn);
                if !legal_targets.is_empty() {
                    self.phase = GamePhase::PieceSelected {
                        selected: pos,
                        legal_targets,
                    };
                }
            }
        }
    }

    fn handle_target_click(&mut self, selected: Pos, target: Pos) {
        // If clicking the same piece, deselect
        if selected == target {
            self.phase = GamePhase::SelectPiece;
            return;
        }

        // If clicking another own piece, reselect
        if let Some(piece) = self.board.get(target) {
            if piece.color == self.turn {
                let legal_targets = rules::legal_moves_from(&self.board, target, self.turn);
                if !legal_targets.is_empty() {
                    self.phase = GamePhase::PieceSelected {
                        selected: target,
                        legal_targets,
                    };
                } else {
                    self.phase = GamePhase::SelectPiece;
                }
                return;
            }
        }

        // Try to find a matching legal move
        let legal_targets = rules::legal_moves_from(&self.board, selected, self.turn);
        let matching: Vec<&Move> = legal_targets.iter().filter(|m| m.to == target).collect();

        if matching.is_empty() {
            // Invalid target, deselect
            self.phase = GamePhase::SelectPiece;
            return;
        }

        // Check if this is a promotion (multiple moves to the same square)
        if matching.len() > 1 {
            // Must be promotion - ask user to choose
            self.phase = GamePhase::PromotionChoice {
                from: selected,
                to: target,
            };
            return;
        }

        // Execute the single matching move
        self.execute_move(*matching[0]);
    }

    pub fn choose_promotion(&mut self, kind: PieceKind) {
        if let GamePhase::PromotionChoice { from, to } = self.phase {
            let mv = Move::new(from, to, MoveKind::Promotion(kind));
            self.execute_move(mv);
        }
    }

    fn execute_move(&mut self, mv: Move) {
        self.board = self.board.apply_move(mv);
        self.turn = self.turn.opposite();

        // Check for game-over conditions
        if rules::is_checkmate(&self.board, self.turn) {
            self.phase = GamePhase::GameOver {
                result: GameResult::Checkmate(self.turn.opposite()),
            };
        } else if rules::is_stalemate(&self.board, self.turn) {
            self.phase = GamePhase::GameOver {
                result: GameResult::Stalemate,
            };
        } else {
            self.phase = GamePhase::SelectPiece;
        }
    }

    pub fn is_in_check(&self) -> bool {
        rules::is_in_check(&self.board, self.turn)
    }
}
