<<<<<<< HEAD
use crate::board::*;
use crate::rules;
=======
use crate::board::{Board, Color, Move, MoveKind, PieceKind, Pos};
use crate::rules::{self, GameOutcome};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GameOverReason {
    Checkmate,
    Stalemate,
}
>>>>>>> origin/version2

#[derive(Clone, Debug)]
pub enum GamePhase {
    SelectPiece,
    PieceSelected {
        selected: Pos,
<<<<<<< HEAD
        legal_targets: Vec<Move>,
    },
    PromotionChoice {
        from: Pos,
        to: Pos,
    },
    GameOver {
        result: GameResult,
=======
        legal_moves: Vec<Move>,
    },
    PromotionChoice {
        choices: Vec<Move>,
    },
    GameOver {
        winner: Option<Color>,
        reason: GameOverReason,
>>>>>>> origin/version2
    },
}

#[derive(Clone, Debug)]
<<<<<<< HEAD
pub enum GameResult {
    Checkmate(Color), // the color that won
    Stalemate,
}

#[derive(Clone, Debug)]
=======
>>>>>>> origin/version2
pub struct GameState {
    pub board: Board,
    pub turn: Color,
    pub phase: GamePhase,
}

impl GameState {
    pub fn new() -> Self {
        Self {
<<<<<<< HEAD
            board: Board::starting_position(),
=======
            board: Board::new(),
>>>>>>> origin/version2
            turn: Color::White,
            phase: GamePhase::SelectPiece,
        }
    }

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/version2
            }
        }
    }

<<<<<<< HEAD
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
=======
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
>>>>>>> origin/version2
    }
}
