mod board;
mod game;
mod rules;

<<<<<<< HEAD
use board::{Piece, PieceKind, Pos};
use board::Color as PieceColor;
use game::{GamePhase, GameResult, GameState};
use macroquad::prelude::*;

const SQUARE_SIZE: f32 = 90.0;
const BOARD_SIZE: f32 = SQUARE_SIZE * 8.0;
const STATUS_HEIGHT: f32 = 80.0;
const WINDOW_WIDTH: f32 = BOARD_SIZE;
const WINDOW_HEIGHT: f32 = BOARD_SIZE + STATUS_HEIGHT;

const LIGHT_SQUARE: Color = Color::new(0.94, 0.85, 0.71, 1.0);
const DARK_SQUARE: Color = Color::new(0.71, 0.53, 0.39, 1.0);
const HIGHLIGHT_GREEN: Color = Color::new(0.0, 0.8, 0.0, 0.4);
const HIGHLIGHT_BLUE: Color = Color::new(0.2, 0.4, 0.9, 0.5);
const HIGHLIGHT_RED: Color = Color::new(0.9, 0.1, 0.1, 0.4);
const STATUS_BG: Color = Color::new(0.2, 0.2, 0.2, 1.0);
const STATUS_TEXT: Color = Color::new(0.95, 0.95, 0.95, 1.0);
const PROMO_BG: Color = Color::new(0.1, 0.1, 0.1, 0.85);

fn window_conf() -> Conf {
    Conf {
        window_title: "Chess".to_string(),
        window_width: WINDOW_WIDTH as i32,
        window_height: WINDOW_HEIGHT as i32,
        window_resizable: false,
=======
use board::{Color as Side, PieceKind, Pos};
use game::{GamePhase, GameState};
use macroquad::prelude::*;

const BOARD_SIZE: f32 = 720.0;
const STATUS_BAR_HEIGHT: f32 = 80.0;
const TILE_SIZE: f32 = BOARD_SIZE / 8.0;

const LIGHT_SQUARE: Color = color_u8!(240, 217, 181, 255);
const DARK_SQUARE: Color = color_u8!(181, 136, 99, 255);
const SELECT_HIGHLIGHT: Color = color_u8!(70, 180, 70, 140);
const CHECK_HIGHLIGHT: Color = color_u8!(210, 50, 50, 140);
const LEGAL_DOT: Color = color_u8!(55, 110, 200, 190);
const STATUS_BG: Color = color_u8!(25, 30, 36, 255);
const STATUS_TEXT: Color = color_u8!(240, 240, 240, 255);
const PIECE_COLOR: Color = color_u8!(20, 20, 20, 255);

fn window_conf() -> Conf {
    Conf {
        window_title: "Local Chess".to_string(),
        window_width: BOARD_SIZE as i32,
        window_height: (BOARD_SIZE + STATUS_BAR_HEIGHT) as i32,
        high_dpi: false,
>>>>>>> origin/version2
        ..Default::default()
    }
}

<<<<<<< HEAD
/// Convert board position to screen coordinates (top-left of square).
/// White is at the bottom of the screen.
fn board_to_screen(pos: Pos) -> (f32, f32) {
    let x = pos.file as f32 * SQUARE_SIZE;
    let y = (7 - pos.rank) as f32 * SQUARE_SIZE;
    (x, y)
}

/// Convert screen coordinates to board position.
fn screen_to_board(x: f32, y: f32) -> Option<Pos> {
    if x < 0.0 || x >= BOARD_SIZE || y < 0.0 || y >= BOARD_SIZE {
        return None;
    }
    let file = (x / SQUARE_SIZE) as i8;
    let rank = 7 - (y / SQUARE_SIZE) as i8;
    Some(Pos::new(file, rank))
}

fn draw_board(game: &GameState, font: &Font) {
    // Draw squares
    for rank in 0..8i8 {
        for file in 0..8i8 {
            let pos = Pos::new(file, rank);
            let (x, y) = board_to_screen(pos);
            let is_light = (file + rank) % 2 != 0;
            let color = if is_light { LIGHT_SQUARE } else { DARK_SQUARE };
            draw_rectangle(x, y, SQUARE_SIZE, SQUARE_SIZE, color);
        }
    }

    // Highlight king in check
    if game.is_in_check() {
        if let Some(king_pos) = game.board.find_king(game.turn) {
            let (x, y) = board_to_screen(king_pos);
            draw_rectangle(x, y, SQUARE_SIZE, SQUARE_SIZE, HIGHLIGHT_RED);
        }
    }

    // Highlight selected piece and legal moves
    if let GamePhase::PieceSelected {
        selected,
        ref legal_targets,
    } = game.phase
    {
        let (sx, sy) = board_to_screen(selected);
        draw_rectangle(sx, sy, SQUARE_SIZE, SQUARE_SIZE, HIGHLIGHT_GREEN);

        for mv in legal_targets {
            let (tx, ty) = board_to_screen(mv.to);
            let cx = tx + SQUARE_SIZE / 2.0;
            let cy = ty + SQUARE_SIZE / 2.0;
            if game.board.get(mv.to).is_some() {
                // Capture: draw a ring
                draw_circle_lines(cx, cy, SQUARE_SIZE * 0.42, 4.0, HIGHLIGHT_BLUE);
            } else {
                // Empty: draw a dot
                draw_circle(cx, cy, SQUARE_SIZE * 0.15, HIGHLIGHT_BLUE);
=======
#[macroquad::main(window_conf)]
async fn main() {
    let font = load_ttf_font_from_bytes(include_bytes!("../assets/DejaVuSans.ttf"))
        .expect("failed to load embedded DejaVu Sans font");

    let mut game = GameState::new();

    loop {
        if is_mouse_button_pressed(MouseButton::Left) {
            let (mx, my) = mouse_position();
            match game.phase.clone() {
                GamePhase::GameOver { .. } => game.restart(),
                GamePhase::PromotionChoice { .. } => {
                    if let Some(kind) = promotion_choice_from_mouse(mx, my) {
                        game.choose_promotion(kind);
                    }
                }
                _ => {
                    if let Some(pos) = screen_to_board(mx, my) {
                        game.handle_board_click(pos);
                    } else {
                        game.handle_outside_board_click();
                    }
                }
            }
        }

        clear_background(color_u8!(235, 235, 235, 255));
        draw_board(&game, &font);
        draw_status_bar(&game, &font);
        if matches!(game.phase, GamePhase::PromotionChoice { .. }) {
            draw_promotion_overlay(&game, &font);
        }

        next_frame().await;
    }
}

fn draw_board(game: &GameState, font: &Font) {
    let selected = game.selected_square();
    let selected_targets = distinct_selected_targets(game);

    let white_king_in_check = if game.in_check(Side::White) {
        rules::king_pos(&game.board, Side::White)
    } else {
        None
    };
    let black_king_in_check = if game.in_check(Side::Black) {
        rules::king_pos(&game.board, Side::Black)
    } else {
        None
    };

    for rank in 0..8 {
        for file in 0..8 {
            let board_pos = Pos::new(file, rank);
            let (x, y) = board_to_screen(board_pos);
            let square_color = if (file + rank) % 2 == 0 {
                LIGHT_SQUARE
            } else {
                DARK_SQUARE
            };
            draw_rectangle(x, y, TILE_SIZE, TILE_SIZE, square_color);

            if selected == Some(board_pos) {
                draw_rectangle(x, y, TILE_SIZE, TILE_SIZE, SELECT_HIGHLIGHT);
            }

            if white_king_in_check == Some(board_pos) || black_king_in_check == Some(board_pos) {
                draw_rectangle(x, y, TILE_SIZE, TILE_SIZE, CHECK_HIGHLIGHT);
            }

            if selected_targets.contains(&board_pos) {
                draw_circle(
                    x + TILE_SIZE * 0.5,
                    y + TILE_SIZE * 0.5,
                    TILE_SIZE * 0.12,
                    LEGAL_DOT,
                );
            }

            if let Some(piece) = game.board.piece_at(board_pos) {
                let symbol = piece.unicode_symbol();
                let font_size = 68;
                let metrics = measure_text(symbol, Some(font), font_size, 1.0);
                let piece_x = x + (TILE_SIZE - metrics.width) * 0.5;
                let piece_y = y + (TILE_SIZE + metrics.height) * 0.5 - 8.0;
                draw_text_ex(
                    symbol,
                    piece_x,
                    piece_y,
                    TextParams {
                        font: Some(font),
                        font_size,
                        color: PIECE_COLOR,
                        ..Default::default()
                    },
                );
>>>>>>> origin/version2
            }
        }
    }

<<<<<<< HEAD
    // Draw pieces
    let piece_size = SQUARE_SIZE * 0.75;
    for rank in 0..8i8 {
        for file in 0..8i8 {
            let pos = Pos::new(file, rank);
            if let Some(piece) = game.board.get(pos) {
                let (x, y) = board_to_screen(pos);
                let ch = piece.unicode_char().to_string();
                let text_params = TextParams {
                    font: Some(font),
                    font_size: piece_size as u16,
                    color: BLACK,
                    ..Default::default()
                };
                let dims = measure_text(&ch, Some(font), piece_size as u16, 1.0);
                let tx = x + (SQUARE_SIZE - dims.width) / 2.0;
                let ty = y + SQUARE_SIZE / 2.0 + dims.height / 2.0;
                draw_text_ex(&ch, tx, ty, text_params);
            }
        }
    }

    // Draw rank/file labels
    let label_size = 14u16;
    for i in 0..8 {
        // File labels (a-h) at bottom
        let file_label = ((b'a' + i as u8) as char).to_string();
        let fx = i as f32 * SQUARE_SIZE + SQUARE_SIZE - 12.0;
        let fy = BOARD_SIZE - 4.0;
        let label_color = if i % 2 == 0 { DARK_SQUARE } else { LIGHT_SQUARE };
        draw_text_ex(
            &file_label,
            fx,
            fy,
            TextParams {
                font: Some(font),
                font_size: label_size,
                color: label_color,
                ..Default::default()
            },
        );

        // Rank labels (1-8) on left
        let rank_label = (8 - i).to_string();
        let rx = 3.0;
        let ry = i as f32 * SQUARE_SIZE + 16.0;
        let label_color = if (7 - i) % 2 != 0 { DARK_SQUARE } else { LIGHT_SQUARE };
        draw_text_ex(
            &rank_label,
            rx,
            ry,
            TextParams {
                font: Some(font),
                font_size: label_size,
                color: label_color,
                ..Default::default()
            },
        );
=======
    draw_board_labels(font);
}

fn draw_board_labels(font: &Font) {
    for file in 0..8 {
        let label = char::from_u32(u32::from(b'a') + file as u32)
            .unwrap_or('?')
            .to_string();
        let x = file as f32 * TILE_SIZE + TILE_SIZE - 16.0;
        let y = BOARD_SIZE - 8.0;
        draw_text_ex(
            &label,
            x,
            y,
            TextParams {
                font: Some(font),
                font_size: 18,
                color: label_color(file, 0),
                ..Default::default()
            },
        );
    }

    for rank in 0..8 {
        let label = (rank + 1).to_string();
        let x = 4.0;
        let y = (7 - rank) as f32 * TILE_SIZE + 18.0;
        draw_text_ex(
            &label,
            x,
            y,
            TextParams {
                font: Some(font),
                font_size: 18,
                color: label_color(0, rank),
                ..Default::default()
            },
        );
    }
}

fn label_color(file: i8, rank: i8) -> Color {
    if (file + rank) % 2 == 0 {
        color_u8!(80, 70, 60, 200)
    } else {
        color_u8!(235, 225, 210, 220)
>>>>>>> origin/version2
    }
}

fn draw_status_bar(game: &GameState, font: &Font) {
<<<<<<< HEAD
    let y = BOARD_SIZE;
    draw_rectangle(0.0, y, WINDOW_WIDTH, STATUS_HEIGHT, STATUS_BG);

    let text = match &game.phase {
        GamePhase::GameOver {
            result: GameResult::Checkmate(winner),
        } => {
            let w = match winner {
                PieceColor::White => "White",
                PieceColor::Black => "Black",
            };
            format!("Checkmate! {} wins. Click to restart.", w)
        }
        GamePhase::GameOver {
            result: GameResult::Stalemate,
        } => "Stalemate! Draw. Click to restart.".to_string(),
        GamePhase::PromotionChoice { .. } => {
            let t = match game.turn {
                PieceColor::White => "White",
                PieceColor::Black => "Black",
            };
            format!("{}: Choose promotion piece", t)
        }
        _ => {
            let t = match game.turn {
                PieceColor::White => "White",
                PieceColor::Black => "Black",
            };
            if game.is_in_check() {
                format!("{} to move (CHECK!)", t)
            } else {
                format!("{} to move", t)
            }
        }
    };

    let font_size = 28u16;
    let dims = measure_text(&text, Some(font), font_size, 1.0);
    let tx = (WINDOW_WIDTH - dims.width) / 2.0;
    let ty = y + STATUS_HEIGHT / 2.0 + dims.height / 2.0;
    draw_text_ex(
        &text,
        tx,
        ty,
        TextParams {
            font: Some(font),
            font_size,
=======
    draw_rectangle(0.0, BOARD_SIZE, BOARD_SIZE, STATUS_BAR_HEIGHT, STATUS_BG);
    let text = game.status_line();
    draw_text_ex(
        &text,
        14.0,
        BOARD_SIZE + 52.0,
        TextParams {
            font: Some(font),
            font_size: 28,
>>>>>>> origin/version2
            color: STATUS_TEXT,
            ..Default::default()
        },
    );
}

fn draw_promotion_overlay(game: &GameState, font: &Font) {
<<<<<<< HEAD
    if let GamePhase::PromotionChoice { to, .. } = game.phase {
        // Darken the board
        draw_rectangle(0.0, 0.0, WINDOW_WIDTH, WINDOW_HEIGHT, PROMO_BG);

        let color = game.turn; // The pawn that just moved belongs to current turn
        let pieces = [
            PieceKind::Queen,
            PieceKind::Rook,
            PieceKind::Bishop,
            PieceKind::Knight,
        ];

        // Draw 4 squares centered on the promotion column
        let base_x = to.file as f32 * SQUARE_SIZE;
        let start_rank = if color == PieceColor::White { 0 } else { 4 };

        for (i, kind) in pieces.iter().enumerate() {
            let y = (start_rank + i) as f32 * SQUARE_SIZE;
            draw_rectangle(base_x, y, SQUARE_SIZE, SQUARE_SIZE, LIGHT_SQUARE);
            draw_rectangle_lines(base_x, y, SQUARE_SIZE, SQUARE_SIZE, 3.0, BLACK);

            let piece = Piece::new(color, *kind);
            let ch = piece.unicode_char().to_string();
            let piece_size = SQUARE_SIZE * 0.75;
            let dims = measure_text(&ch, Some(font), piece_size as u16, 1.0);
            let tx = base_x + (SQUARE_SIZE - dims.width) / 2.0;
            let ty = y + SQUARE_SIZE / 2.0 + dims.height / 2.0;
            draw_text_ex(
                &ch,
                tx,
                ty,
                TextParams {
                    font: Some(font),
                    font_size: piece_size as u16,
                    color: BLACK,
                    ..Default::default()
                },
            );
        }
    }
}

fn handle_promotion_click(game: &mut GameState, mx: f32, my: f32) {
    if let GamePhase::PromotionChoice { to, .. } = game.phase {
        let color = game.turn;
        let base_x = to.file as f32 * SQUARE_SIZE;
        let start_rank = if color == PieceColor::White { 0 } else { 4 };

        let pieces = [
            PieceKind::Queen,
            PieceKind::Rook,
            PieceKind::Bishop,
            PieceKind::Knight,
        ];

        for (i, kind) in pieces.iter().enumerate() {
            let y = (start_rank + i) as f32 * SQUARE_SIZE;
            if mx >= base_x && mx < base_x + SQUARE_SIZE && my >= y && my < y + SQUARE_SIZE {
                game.choose_promotion(*kind);
                return;
            }
        }
    }
}

#[macroquad::main(window_conf)]
async fn main() {
    let font_data = include_bytes!("/usr/share/fonts/TTF/DejaVuSans.ttf");
    let font = load_ttf_font_from_bytes(font_data).expect("Failed to load font");

    let mut game = GameState::new();

    loop {
        clear_background(WHITE);

        // Handle mouse input
        if is_mouse_button_pressed(MouseButton::Left) {
            let (mx, my) = mouse_position();

            match &game.phase {
                GamePhase::PromotionChoice { .. } => {
                    handle_promotion_click(&mut game, mx, my);
                }
                GamePhase::GameOver { .. } => {
                    game = GameState::new();
                }
                _ => {
                    if let Some(pos) = screen_to_board(mx, my) {
                        game.select_square(pos);
                    }
                }
            }
        }

        draw_board(&game, &font);
        draw_status_bar(&game, &font);

        if matches!(game.phase, GamePhase::PromotionChoice { .. }) {
            draw_promotion_overlay(&game, &font);
        }

        next_frame().await
    }
=======
    draw_rectangle(0.0, 0.0, BOARD_SIZE, BOARD_SIZE, color_u8!(0, 0, 0, 165));

    let panel_height = 180.0;
    let panel_y = (BOARD_SIZE - panel_height) * 0.5;
    draw_rectangle(
        90.0,
        panel_y,
        BOARD_SIZE - 180.0,
        panel_height,
        color_u8!(245, 238, 225, 255),
    );
    draw_rectangle_lines(
        90.0,
        panel_y,
        BOARD_SIZE - 180.0,
        panel_height,
        3.0,
        color_u8!(85, 65, 45, 255),
    );

    draw_text_ex(
        "Choose promotion",
        250.0,
        panel_y + 34.0,
        TextParams {
            font: Some(font),
            font_size: 28,
            color: color_u8!(35, 35, 35, 255),
            ..Default::default()
        },
    );

    let promotion_color = game.turn;
    for (kind, rect) in promotion_option_rects() {
        draw_rectangle(
            rect.x,
            rect.y,
            rect.w,
            rect.h,
            color_u8!(225, 210, 185, 255),
        );
        draw_rectangle_lines(
            rect.x,
            rect.y,
            rect.w,
            rect.h,
            2.0,
            color_u8!(90, 70, 50, 255),
        );

        let symbol = board::Piece {
            color: promotion_color,
            kind,
        }
        .unicode_symbol();
        let size = 56;
        let metrics = measure_text(symbol, Some(font), size, 1.0);
        let x = rect.x + (rect.w - metrics.width) * 0.5;
        let y = rect.y + (rect.h + metrics.height) * 0.5 - 8.0;
        draw_text_ex(
            symbol,
            x,
            y,
            TextParams {
                font: Some(font),
                font_size: size,
                color: PIECE_COLOR,
                ..Default::default()
            },
        );
    }
}

fn promotion_option_rects() -> [(PieceKind, Rect); 4] {
    let kinds = [
        PieceKind::Queen,
        PieceKind::Rook,
        PieceKind::Bishop,
        PieceKind::Knight,
    ];
    let box_size = 92.0;
    let gap = 20.0;
    let total_width = box_size * 4.0 + gap * 3.0;
    let start_x = (BOARD_SIZE - total_width) * 0.5;
    let y = BOARD_SIZE * 0.5 - box_size * 0.5 + 20.0;

    [
        (kinds[0], Rect::new(start_x, y, box_size, box_size)),
        (
            kinds[1],
            Rect::new(start_x + (box_size + gap), y, box_size, box_size),
        ),
        (
            kinds[2],
            Rect::new(start_x + 2.0 * (box_size + gap), y, box_size, box_size),
        ),
        (
            kinds[3],
            Rect::new(start_x + 3.0 * (box_size + gap), y, box_size, box_size),
        ),
    ]
}

fn promotion_choice_from_mouse(x: f32, y: f32) -> Option<PieceKind> {
    for (kind, rect) in promotion_option_rects() {
        if rect.contains(Vec2::new(x, y)) {
            return Some(kind);
        }
    }
    None
}

fn distinct_selected_targets(game: &GameState) -> Vec<Pos> {
    let mut targets = Vec::new();
    if let Some(moves) = game.selected_moves() {
        for mv in moves {
            if !targets.contains(&mv.to) {
                targets.push(mv.to);
            }
        }
    }
    targets
}

fn board_to_screen(pos: Pos) -> (f32, f32) {
    let x = pos.file as f32 * TILE_SIZE;
    let y = (7 - pos.rank) as f32 * TILE_SIZE;
    (x, y)
}

fn screen_to_board(x: f32, y: f32) -> Option<Pos> {
    if !(0.0..BOARD_SIZE).contains(&x) || !(0.0..BOARD_SIZE).contains(&y) {
        return None;
    }

    let file = (x / TILE_SIZE).floor() as i8;
    let rank = 7 - (y / TILE_SIZE).floor() as i8;
    let pos = Pos::new(file, rank);
    pos.is_valid().then_some(pos)
>>>>>>> origin/version2
}
