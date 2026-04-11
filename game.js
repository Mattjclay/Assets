// Minesweeper Phaser 3 Game
// NOTE: MinesweeperScene class is defined below; game is instantiated at the bottom of the file.

class MinesweeperScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MinesweeperScene' });
    }

    create() {
        // Game constants
        this.GRID_WIDTH = 9;
        this.GRID_HEIGHT = 9;
        this.MINE_COUNT = 10;
        this.CELL_SIZE = 50;
        this.PADDING = 10;

        // Game state
        this.grid = [];
        this.revealed = [];
        this.flagged = [];
        this.minesPlaced = false;
        this.gameOver = false;
        this.gameWon = false;
        this.firstClickPos = null;

        // Pointer tracking for long-press
        this.pointerDown = {};

        // Number colors (1-8)
        this.numberColors = {
            1: 0x0000FF,  // blue
            2: 0x008000,  // green
            3: 0xFF0000,  // red
            4: 0x00008B,  // dark blue
            5: 0x800000,  // maroon
            6: 0x008080,  // teal
            7: 0x000000,  // black
            8: 0x808080   // gray
        };

        // Initialize game
        this.initializeGrid();
        this.setupInput();
        this.draw();
        this.createUI();
    }

    initializeGrid() {
        // Create empty grid
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            this.grid[y] = [];
            this.revealed[y] = [];
            this.flagged[y] = [];
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                this.grid[y][x] = 0;
                this.revealed[y][x] = false;
                this.flagged[y][x] = false;
            }
        }
    }

    setupInput() {
        // Listen for pointer events
        this.input.on('pointerdown', this.handlePointerDown, this);
        this.input.on('pointerup', this.handlePointerUp, this);
    }

    handlePointerDown(pointer) {
        if (this.gameOver || this.gameWon) return;

        const { x, y } = this.getGridCoords(pointer.x, pointer.y);
        if (x === null || y === null) return;

        // Track pointer down time
        this.pointerDown[pointer.id] = {
            x: x,
            y: y,
            time: pointer.downTime,
            isValid: true
        };
    }

    handlePointerUp(pointer) {
        if (this.gameOver || this.gameWon) return;

        const trackData = this.pointerDown[pointer.id];
        if (!trackData) return;

        const { x, y, time, isValid } = trackData;

        if (!isValid) {
            delete this.pointerDown[pointer.id];
            return;
        }

        // Check if this was a long press (500ms)
        const pressDuration = pointer.upTime - time;
        const isLongPress = pressDuration >= 500;
        const isRightClick = pointer.button === 2;

        if (isLongPress || isRightClick) {
            // Toggle flag
            this.toggleFlag(x, y);
        } else {
            // Reveal cell
            this.reveal(x, y);
        }

        delete this.pointerDown[pointer.id];
        this.draw();
    }

    getGridCoords(screenX, screenY) {
        // Calculate grid position from screen coords
        const gridStartX = (this.cameras.main.width - (this.GRID_WIDTH * this.CELL_SIZE)) / 2;
        const gridStartY = (this.cameras.main.height - (this.GRID_HEIGHT * this.CELL_SIZE)) / 2 + 80; // Offset for UI

        const relX = screenX - gridStartX;
        const relY = screenY - gridStartY;

        if (relX < 0 || relY < 0) return { x: null, y: null };

        const x = Math.floor(relX / this.CELL_SIZE);
        const y = Math.floor(relY / this.CELL_SIZE);

        if (x < 0 || x >= this.GRID_WIDTH || y < 0 || y >= this.GRID_HEIGHT) {
            return { x: null, y: null };
        }

        return { x, y };
    }

    placeMines(excludeX, excludeY) {
        let placed = 0;
        while (placed < this.MINE_COUNT) {
            const x = Phaser.Math.Between(0, this.GRID_WIDTH - 1);
            const y = Phaser.Math.Between(0, this.GRID_HEIGHT - 1);

            // Don't place on excluded cell or if already a mine
            if ((x === excludeX && y === excludeY) || this.grid[y][x] === -1) {
                continue;
            }

            this.grid[y][x] = -1;
            placed++;
        }

        // Calculate numbers
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                if (this.grid[y][x] !== -1) {
                    this.grid[y][x] = this.countAdjacentMines(x, y);
                }
            }
        }

        this.minesPlaced = true;
    }

    countAdjacentMines(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < this.GRID_WIDTH && ny >= 0 && ny < this.GRID_HEIGHT) {
                    if (this.grid[ny][nx] === -1) count++;
                }
            }
        }
        return count;
    }

    reveal(x, y) {
        if (this.revealed[y][x] || this.flagged[y][x]) return;

        // Place mines on first click
        if (!this.minesPlaced) {
            this.placeMines(x, y);
            this.firstClickPos = { x, y };
        }

        // Reveal cell
        this.revealed[y][x] = true;

        // Check for loss
        if (this.grid[y][x] === -1) {
            this.gameOver = true;
            this.revealAllMines();
            this.showGameOverOverlay();
            return;
        }

        // Flood fill if empty
        if (this.grid[y][x] === 0) {
            this.floodFill(x, y);
        }

        // Check for win
        this.checkWinCondition();
    }

    floodFill(x, y) {
        const queue = [{ x, y }];

        while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();

            if (this.revealed[cy][cx]) continue;

            this.revealed[cy][cx] = true;

            // If not empty, don't continue filling
            if (this.grid[cy][cx] !== 0) continue;

            // Add adjacent cells
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < this.GRID_WIDTH && ny >= 0 && ny < this.GRID_HEIGHT) {
                        if (!this.revealed[ny][nx] && !this.flagged[ny][nx]) {
                            queue.push({ x: nx, y: ny });
                        }
                    }
                }
            }
        }
    }

    toggleFlag(x, y) {
        if (this.revealed[y][x]) return;
        this.flagged[y][x] = !this.flagged[y][x];
        this.updateMineCounter();
    }

    revealAllMines() {
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                if (this.grid[y][x] === -1) {
                    this.revealed[y][x] = true;
                }
            }
        }
    }

    checkWinCondition() {
        let allNonMinesRevealed = true;
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                if (this.grid[y][x] !== -1 && !this.revealed[y][x]) {
                    allNonMinesRevealed = false;
                    break;
                }
            }
            if (!allNonMinesRevealed) break;
        }

        if (allNonMinesRevealed) {
            this.gameWon = true;
            this.showWinOverlay();
        }
    }

    resetGame() {
        this.initializeGrid();
        this.minesPlaced = false;
        this.gameOver = false;
        this.gameWon = false;
        this.firstClickPos = null;
        this.pointerDown = {};
        this.draw();
        this.updateMineCounter();
    }

    draw() {
        // Destroy old text objects before redraw
        if (this.textObjects) {
            this.textObjects.forEach(t => t.destroy());
        }
        this.textObjects = [];

        // Clear previous graphics
        if (this.gridGraphics) this.gridGraphics.destroy();
        if (this.uiGraphics) this.uiGraphics.destroy();

        this.gridGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        this.uiGraphics = this.make.graphics({ x: 0, y: 0, add: false });

        const gridStartX = (this.cameras.main.width - (this.GRID_WIDTH * this.CELL_SIZE)) / 2;
        const gridStartY = (this.cameras.main.height - (this.GRID_HEIGHT * this.CELL_SIZE)) / 2 + 80;

        // Draw grid
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                const posX = gridStartX + x * this.CELL_SIZE;
                const posY = gridStartY + y * this.CELL_SIZE;

                this.drawCell(this.gridGraphics, posX, posY, x, y);
            }
        }

        // Draw UI (mine counter and reset button)
        this.drawUI();

        this.gridGraphics.depth = 1;
        this.uiGraphics.depth = 1;
    }

    drawCell(graphics, x, y, gridX, gridY) {
        const revealed = this.revealed[gridY][gridX];
        const flagged = this.flagged[gridY][gridX];
        const value = this.grid[gridY][gridX];

        // Draw cell background
        if (!revealed) {
            // Unrevealed - gray with beveled look
            graphics.fillStyle(0xC0C0C0);
            graphics.fillRect(x, y, this.CELL_SIZE, this.CELL_SIZE);
            graphics.lineStyle(2, 0xFFFFFF);
            graphics.lineBetween(x, y, x + this.CELL_SIZE, y);
            graphics.lineBetween(x, y, x, y + this.CELL_SIZE);
            graphics.lineStyle(2, 0x808080);
            graphics.lineBetween(x + this.CELL_SIZE, y, x + this.CELL_SIZE, y + this.CELL_SIZE);
            graphics.lineBetween(x, y + this.CELL_SIZE, x + this.CELL_SIZE, y + this.CELL_SIZE);

            if (flagged) {
                // Draw flag
                this.drawFlag(graphics, x, y);
            }
        } else {
            // Revealed - light background
            graphics.fillStyle(0xDDDDDD);
            graphics.fillRect(x, y, this.CELL_SIZE, this.CELL_SIZE);
            graphics.lineStyle(1, 0xAAAAAA);
            graphics.strokeRect(x, y, this.CELL_SIZE, this.CELL_SIZE);

            if (value === -1) {
                // Mine
                this.drawMine(graphics, x, y);
            } else if (value > 0) {
                // Number
                this.drawNumber(graphics, x, y, value);
            }
        }
    }

    drawMine(graphics, x, y) {
        const centerX = x + this.CELL_SIZE / 2;
        const centerY = y + this.CELL_SIZE / 2;
        const radius = 8;

        // Red circle for mine
        graphics.fillStyle(0xFF0000);
        graphics.fillCircle(centerX, centerY, radius);

        // Draw spikes
        graphics.lineStyle(2, 0xFF0000);
        const spikeLength = 14;
        const directions = [
            { x: 0, y: -1 },  // top
            { x: 1, y: 0 },   // right
            { x: 0, y: 1 },   // bottom
            { x: -1, y: 0 }   // left
        ];

        directions.forEach(dir => {
            const startX = centerX + dir.x * radius;
            const startY = centerY + dir.y * radius;
            const endX = centerX + dir.x * spikeLength;
            const endY = centerY + dir.y * spikeLength;
            graphics.lineBetween(startX, startY, endX, endY);
        });
    }

    drawFlag(graphics, x, y) {
        const centerX = x + this.CELL_SIZE / 2;
        const centerY = y + this.CELL_SIZE / 2;

        // Flag pole
        graphics.lineStyle(2, 0x000000);
        graphics.lineBetween(centerX, centerY - 10, centerX, centerY + 10);

        // Flag
        graphics.fillStyle(0xFFFF00);
        graphics.fillTriangle(
            centerX, centerY - 8,
            centerX + 10, centerY - 4,
            centerX, centerY
        );
    }

    drawNumber(graphics, x, y, number) {
        const centerX = x + this.CELL_SIZE / 2;
        const centerY = y + this.CELL_SIZE / 2;

        const color = this.numberColors[number] || 0x000000;
        const text = number.toString();

        const textObj = this.make.text({
            x: centerX,
            y: centerY,
            text: text,
            style: {
                font: 'bold 24px Arial',
                fill: '#' + color.toString(16).padStart(6, '0')
            },
            add: false
        });

        textObj.setOrigin(0.5, 0.5);
        textObj.depth = 2;
        this.gridGraphics.bitmapMask = null;
        this.add.existing(textObj);

        // Store for cleanup
        if (!this.textObjects) this.textObjects = [];
        this.textObjects.push(textObj);
    }

    drawUI() {
        const uiGraphics = this.uiGraphics;
        const centerX = this.cameras.main.width / 2;

        // UI background bar
        uiGraphics.fillStyle(0xEEEEEE);
        uiGraphics.fillRect(0, 0, this.cameras.main.width, 80);
        uiGraphics.lineStyle(2, 0xAAAAAA);
        uiGraphics.lineBetween(0, 80, this.cameras.main.width, 80);

        // Mine counter
        const flaggedCount = this.countFlagged();
        const minesRemaining = this.MINE_COUNT - flaggedCount;

        const counterText = this.make.text({
            x: 20,
            y: 40,
            text: 'Mines: ' + minesRemaining,
            style: {
                font: 'bold 20px Arial',
                fill: '#000000'
            },
            add: false
        });
        counterText.setOrigin(0, 0.5);
        counterText.depth = 3;
        this.add.existing(counterText);
        if (!this.textObjects) this.textObjects = [];
        this.textObjects.push(counterText);

        // Reset button
        this.drawResetButton(uiGraphics, centerX);
    }

    drawResetButton(graphics, centerX) {
        const buttonX = centerX - 25;
        const buttonY = 20;
        const buttonSize = 50;

        // Button background
        graphics.fillStyle(0xFFA500);
        graphics.fillRect(buttonX, buttonY, buttonSize, buttonSize);
        graphics.lineStyle(2, 0xFF8C00);
        graphics.strokeRect(buttonX, buttonY, buttonSize, buttonSize);

        // Smiley face
        const centerX_btn = centerX;
        const centerY_btn = 45;

        graphics.lineStyle(2, 0x000000);
        graphics.strokeCircle(centerX_btn, centerY_btn, 18);

        // Eyes
        graphics.fillStyle(0x000000);
        graphics.fillCircle(centerX_btn - 7, centerY_btn - 5, 2);
        graphics.fillCircle(centerX_btn + 7, centerY_btn - 5, 2);

        // Smile
        graphics.lineStyle(2, 0x000000);
        const smile = new Phaser.Curves.Spline([
            { x: centerX_btn - 8, y: centerY_btn + 2 },
            { x: centerX_btn, y: centerY_btn + 6 },
            { x: centerX_btn + 8, y: centerY_btn + 2 }
        ]);
        smile.getPoints().forEach((point, i) => {
            if (i > 0) {
                const prevPoint = smile.getPoints()[i - 1];
                graphics.lineBetween(prevPoint.x, prevPoint.y, point.x, point.y);
            }
        });

        // Make button clickable
        if (!this.resetButton) {
            this.resetButton = this.add.zone(centerX, 45, buttonSize, buttonSize);
            this.resetButton.setInteractive();
            this.resetButton.on('pointerdown', () => {
                this.resetGame();
            });
        }
    }

    countFlagged() {
        let count = 0;
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                if (this.flagged[y][x]) count++;
            }
        }
        return count;
    }

    updateMineCounter() {
        // Redraw UI on flag toggle
        if (this.uiGraphics) {
            this.uiGraphics.destroy();
        }
        this.drawUI();
    }

    showGameOverOverlay() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Dark overlay
        const overlay = this.make.graphics({ x: 0, y: 0, add: false });
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        overlay.depth = 10;
        this.add.existing(overlay);

        // Game Over text
        const gameOverText = this.make.text({
            x: centerX,
            y: centerY - 60,
            text: 'GAME OVER',
            style: {
                font: 'bold 48px Arial',
                fill: '#FF0000'
            },
            add: false
        });
        gameOverText.setOrigin(0.5, 0.5);
        gameOverText.depth = 11;
        this.add.existing(gameOverText);

        // New Game button
        this.drawOverlayButton(centerX, centerY + 40, 'New Game', () => {
            overlay.destroy();
            gameOverText.destroy();
            this.resetGame();
        });
    }

    showWinOverlay() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Dark overlay
        const overlay = this.make.graphics({ x: 0, y: 0, add: false });
        overlay.fillStyle(0x000000, 0.6);
        overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
        overlay.depth = 10;
        this.add.existing(overlay);

        // You Win text
        const winText = this.make.text({
            x: centerX,
            y: centerY - 60,
            text: 'YOU WIN!',
            style: {
                font: 'bold 48px Arial',
                fill: '#00FF00'
            },
            add: false
        });
        winText.setOrigin(0.5, 0.5);
        winText.depth = 11;
        this.add.existing(winText);

        // New Game button
        this.drawOverlayButton(centerX, centerY + 40, 'New Game', () => {
            overlay.destroy();
            winText.destroy();
            this.resetGame();
        });
    }

    drawOverlayButton(x, y, label, callback) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });
        const buttonWidth = 150;
        const buttonHeight = 50;

        graphics.fillStyle(0x4CAF50);
        graphics.fillRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight);
        graphics.lineStyle(2, 0x388E3C);
        graphics.strokeRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight);
        graphics.depth = 11;
        this.add.existing(graphics);

        const text = this.make.text({
            x: x,
            y: y,
            text: label,
            style: {
                font: 'bold 20px Arial',
                fill: '#FFFFFF'
            },
            add: false
        });
        text.setOrigin(0.5, 0.5);
        text.depth = 12;
        this.add.existing(text);

        const button = this.add.zone(x, y, buttonWidth, buttonHeight);
        button.setInteractive();
        button.depth = 12;
        button.on('pointerdown', () => {
            graphics.destroy();
            text.destroy();
            button.destroy();
            callback();
        });
    }
}

// Instantiate after class definition to avoid ReferenceError (classes are not hoisted)
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 960,
        expandParent: true
    },
    scene: MinesweeperScene
};

const game = new Phaser.Game(config);
