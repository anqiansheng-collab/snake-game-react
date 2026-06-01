import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const BOARD_SIZE = 20
const CELL_SIZE = 24
const INITIAL_SPEED = 180

interface Position {
  x: number
  y: number
}

interface GameState {
  snake: Position[]
  food: Position
  direction: Position
  nextDirection: Position
  score: number
  gameOver: boolean
  started: boolean
  paused: boolean
  level: number
  foodEaten: number
  cleared: boolean
  infiniteMode: boolean
}

interface Firework {
  id: number
  x: number
  y: number
  colors: string[]
}

interface Particle {
  id: number
  x: number
  y: number
  color: string
  angle: number
  distance: number
}

interface RankRecord {
  name: string
  score: number
  level: number
  mode: string
  date: string
}

const LEVEL_TARGETS = [5, 10, 20]
const LEVEL_SPEED_BONUS = [0, 10, 20]
const STORAGE_KEY = 'snake-game-rank'
const UNLOCKED_KEY = 'snake-game-unlocked'

function loadUnlockedLevel(): number {
  try {
    const raw = localStorage.getItem(UNLOCKED_KEY)
    if (raw) return parseInt(raw, 10)
  } catch {}
  return 1
}

function saveUnlockedLevel(level: number) {
  try {
    localStorage.setItem(UNLOCKED_KEY, String(level))
  } catch {}
}

function loadRank(): RankRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveRank(rank: RankRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rank))
  } catch {}
}

function randomFood(snake: Position[]): Position {
  let food: Position
  do {
    food = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    }
  } while (snake.some((s) => s.x === food.x && s.y === food.y))
  return food
}

function createInitialState(startLevel: number): GameState {
  const startX = Math.floor(BOARD_SIZE / 2)
  const startY = Math.floor(BOARD_SIZE / 2)
  const snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY },
  ]
  return {
    snake,
    food: randomFood(snake),
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    gameOver: false,
    started: false,
    paused: false,
    level: startLevel,
    foodEaten: 0,
    cleared: false,
    infiniteMode: false,
  }
}

const FIREWORK_COLORS = [
  '#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff',
  '#5f27cd', '#00d2d3', '#ff9f43', '#ee5a24', '#0abde3',
  '#10ac84', '#c8d6e5', '#ff4757', '#2ed573', '#ffa502',
]

function getRandomColors(count: number): string[] {
  const shuffled = [...FIREWORK_COLORS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export default function App() {
  const [unlockedLevel, setUnlockedLevel] = useState(loadUnlockedLevel)
  const [startLevel, setStartLevel] = useState(loadUnlockedLevel)
  const [state, setState] = useState<GameState>(() => createInitialState(startLevel))
  const [highScore, setHighScore] = useState(0)
  const [fireworks, setFireworks] = useState<Firework[]>([])
  const [particles, setParticles] = useState<Particle[]>([])
  const [rank, setRank] = useState<RankRecord[]>(loadRank)
  const [showRank, setShowRank] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [askName, setAskName] = useState(false)
  const gameLoopRef = useRef<number | null>(null)
  const fireworkIdRef = useRef(0)
  const particleIdRef = useRef(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const resetGame = useCallback(() => {
    setState(createInitialState(startLevel))
    setFireworks([])
    setParticles([])
    setAskName(false)
  }, [startLevel])

  const addFirework = useCallback((x: number, y: number) => {
    const id = fireworkIdRef.current++
    const colors = getRandomColors(5)
    const firework: Firework = { id, x, y, colors }
    setFireworks((prev) => [...prev, firework])

    const newParticles: Particle[] = []
    for (let i = 0; i < 16; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        color: colors[i % colors.length],
        angle: (Math.PI * 2 * i) / 16,
        distance: 20 + Math.random() * 30,
      })
    }
    setParticles((prev) => [...prev, ...newParticles])

    setTimeout(() => {
      setFireworks((prev) => prev.filter((f) => f.id !== id))
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)))
    }, 1000)
  }, [])

  const tick = useCallback(() => {
    setState((prev) => {
      if (prev.gameOver || !prev.started || prev.paused || prev.cleared) return prev

      const newDir = prev.nextDirection
      const head = prev.snake[0]
      const newHead = {
        x: head.x + newDir.x,
        y: head.y + newDir.y,
      }

      if (
        newHead.x < 0 ||
        newHead.x >= BOARD_SIZE ||
        newHead.y < 0 ||
        newHead.y >= BOARD_SIZE ||
        prev.snake.some((s) => s.x === newHead.x && s.y === newHead.y)
      ) {
        return { ...prev, gameOver: true, direction: newDir }
      }

      const newSnake = [newHead, ...prev.snake]
      let newFood = prev.food
      let newScore = prev.score
      let newFoodEaten = prev.foodEaten
      let newLevel = prev.level
      let newCleared: boolean = prev.cleared
      let newInfiniteMode: boolean = prev.infiniteMode
      let ateFood = false

      if (newHead.x === prev.food.x && newHead.y === prev.food.y) {
        newScore = prev.score + 10
        newFoodEaten = prev.foodEaten + 1
        newFood = randomFood(newSnake)
        ateFood = true

        const target = prev.infiniteMode ? Infinity : LEVEL_TARGETS[prev.level - 1]
        if (newFoodEaten >= target && !prev.infiniteMode) {
          if (prev.level >= 3) {
            newCleared = true
            newInfiniteMode = true
          } else {
            newCleared = true
            newLevel = prev.level + 1
            newFoodEaten = 0
          }
        }
      } else {
        newSnake.pop()
      }

      if (ateFood) {
        addFirework(newHead.x * CELL_SIZE + CELL_SIZE / 2, newHead.y * CELL_SIZE + CELL_SIZE / 2)
      }

      return {
        ...prev,
        snake: newSnake,
        food: newFood,
        direction: newDir,
        score: newScore,
        foodEaten: newFoodEaten,
        level: newLevel,
        cleared: newCleared,
        infiniteMode: newInfiniteMode,
      }
    })
  }, [addFirework])

  useEffect(() => {
    if (state.gameOver) {
      setHighScore((h) => Math.max(h, state.score))
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
      if (state.score > 0) {
        setAskName(true)
      }
    }
  }, [state.gameOver, state.score])

  useEffect(() => {
    if (state.cleared) {
      const newUnlocked = state.infiniteMode ? 4 : state.level
      setUnlockedLevel((prev) => {
        const max = Math.max(prev, newUnlocked)
        saveUnlockedLevel(max)
        return max
      })
    }
  }, [state.cleared, state.level, state.infiniteMode])

  useEffect(() => {
    if (state.started && !state.gameOver && !state.paused && !state.cleared) {
      let speed: number
      if (state.infiniteMode) {
        speed = Math.max(45, INITIAL_SPEED - 30 - state.foodEaten * 4)
      } else {
        const levelBonus = LEVEL_SPEED_BONUS[state.level - 1] || 30
        speed = Math.max(80, INITIAL_SPEED - levelBonus - state.foodEaten * 3)
      }
      gameLoopRef.current = window.setInterval(tick, speed)
      return () => {
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current)
          gameLoopRef.current = null
        }
      }
    } else if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
      gameLoopRef.current = null
    }
  }, [state.started, state.gameOver, state.paused, state.cleared, state.level, state.foodEaten, state.infiniteMode, tick])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (askName || showRank) return
      setState((prev) => {
        if (prev.gameOver) return prev
        let next = prev.nextDirection
        switch (e.key) {
          case 'ArrowUp':
          case 'w':
          case 'W':
            if (prev.direction.y === 0) next = { x: 0, y: -1 }
            break
          case 'ArrowDown':
          case 's':
          case 'S':
            if (prev.direction.y === 0) next = { x: 0, y: 1 }
            break
          case 'ArrowLeft':
          case 'a':
          case 'A':
            if (prev.direction.x === 0) next = { x: -1, y: 0 }
            break
          case 'ArrowRight':
          case 'd':
          case 'D':
            if (prev.direction.x === 0) next = { x: 1, y: 0 }
            break
          case ' ':
            if (!prev.started) {
              return { ...prev, started: true }
            }
            if (prev.cleared) {
              return {
                ...prev,
                cleared: false,
                snake: [
                  { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
                  { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
                  { x: Math.floor(BOARD_SIZE / 2) - 2, y: Math.floor(BOARD_SIZE / 2) },
                ],
                food: randomFood([
                  { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
                  { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
                  { x: Math.floor(BOARD_SIZE / 2) - 2, y: Math.floor(BOARD_SIZE / 2) },
                ]),
                direction: { x: 1, y: 0 },
                nextDirection: { x: 1, y: 0 },
                gameOver: false,
                paused: false,
              }
            }
            return { ...prev, paused: !prev.paused }
          default:
            return prev
        }
        return { ...prev, nextDirection: next, started: prev.started || true }
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [askName, showRank])

  const handleTouchDir = useCallback((dx: number, dy: number) => {
    setState((prev) => {
      if (prev.gameOver || !prev.started || prev.paused || prev.cleared) return prev
      if (dx !== 0 && prev.direction.x !== 0) return prev
      if (dy !== 0 && prev.direction.y !== 0) return prev
      return { ...prev, nextDirection: { x: dx, y: dy } }
    })
  }, [])

  const handleTouchPause = useCallback(() => {
    setState((prev) => {
      if (!prev.started) return { ...prev, started: true }
      if (prev.cleared) return prev
      return { ...prev, paused: !prev.paused }
    })
  }, [])

  // 手势滑动控制
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const minSwipeDistance = 30

    if (Math.abs(dx) < minSwipeDistance && Math.abs(dy) < minSwipeDistance) {
      touchStartRef.current = null
      return
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      handleTouchDir(dx > 0 ? 1 : -1, 0)
    } else {
      handleTouchDir(0, dy > 0 ? 1 : -1)
    }
    touchStartRef.current = null
  }, [handleTouchDir])

  const handleNextLevel = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cleared: false,
      snake: [
        { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
        { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
        { x: Math.floor(BOARD_SIZE / 2) - 2, y: Math.floor(BOARD_SIZE / 2) },
      ],
      food: randomFood([
        { x: Math.floor(BOARD_SIZE / 2), y: Math.floor(BOARD_SIZE / 2) },
        { x: Math.floor(BOARD_SIZE / 2) - 1, y: Math.floor(BOARD_SIZE / 2) },
        { x: Math.floor(BOARD_SIZE / 2) - 2, y: Math.floor(BOARD_SIZE / 2) },
      ]),
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      gameOver: false,
      paused: false,
    }))
  }, [])

  const submitRank = useCallback(() => {
    const name = playerName.trim() || '匿名玩家'
    const record: RankRecord = {
      name,
      score: state.score,
      level: state.infiniteMode ? 4 : state.level,
      mode: state.infiniteMode ? '无限模式' : `第${state.level}关`,
      date: new Date().toLocaleString('zh-CN'),
    }
    const newRank = [...rank, record].sort((a, b) => b.score - a.score).slice(0, 20)
    setRank(newRank)
    saveRank(newRank)
    setAskName(false)
    setPlayerName('')
  }, [playerName, rank, state.score, state.level, state.infiniteMode])

  const boardCells = []
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const isSnake = state.snake.some((s) => s.x === x && s.y === y)
      const isHead = state.snake[0].x === x && state.snake[0].y === y
      const isFood = state.food.x === x && state.food.y === y
      boardCells.push(
        <div
          key={`${x}-${y}`}
          className={`cell ${isSnake ? 'snake' : ''} ${isHead ? 'head' : ''} ${isFood ? 'food' : ''}`}
          style={{
            left: x * CELL_SIZE,
            top: y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          }}
        />
      )
    }
  }

  const levelTarget = state.infiniteMode ? '无限' : LEVEL_TARGETS[state.level - 1]
  const progressText = state.infiniteMode
    ? `无限模式 | 已吃: ${state.foodEaten}`
    : `第 ${state.level} 关 | ${state.foodEaten}/${levelTarget}`

  return (
    <div className="game-container">
      <h1>贪吃蛇</h1>
      <div className="score-board">
        <span>得分: {state.score}</span>
        <span className="level-info">{progressText}</span>
        <span>最高分: {highScore}</span>
        {state.paused && <span className="pause-indicator">暂停中</span>}
      </div>
      <div
        ref={boardRef}
        className="board"
        style={{
          width: BOARD_SIZE * CELL_SIZE,
          height: BOARD_SIZE * CELL_SIZE,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="grid-background" />
        {boardCells}
        {fireworks.map((fw) => (
          <div
            key={fw.id}
            className="firework"
            style={{
              left: fw.x,
              top: fw.y,
            }}
          />
        ))}
        {particles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.x,
              top: p.y,
              '--p-color': p.color,
              '--p-angle': `${p.angle}rad`,
              '--p-distance': `${p.distance}px`,
            } as React.CSSProperties}
          />
        ))}
        {state.gameOver && (
          <div className="overlay">
            <div className="modal">
              <h2>游戏结束</h2>
              <p>最终得分: {state.score}</p>
              {state.infiniteMode && <p>无限模式挑战结束!</p>}
              <button onClick={resetGame}>重新开始</button>
            </div>
          </div>
        )}
        {!state.started && !state.gameOver && (
          <div className="overlay">
            <div className="modal start-modal">
              <h2>选择关卡</h2>
              <p>点击上方关卡开始游戏</p>
              <p>使用方向键或 WASD 控制移动</p>
              <p>游戏中按空格键暂停/继续</p>
              <div className="level-select">
                <p className="level-desc">选择起始关卡:</p>
                <div className="level-buttons">
                  {[1, 2, 3].map((lv) => (
                    <button
                      key={lv}
                      className={`level-btn ${startLevel === lv ? 'active' : ''} ${lv > unlockedLevel ? 'locked' : ''}`}
                      onClick={() => {
                        if (lv <= unlockedLevel) {
                          setStartLevel(lv)
                          setState({ ...createInitialState(lv), started: true })
                        }
                      }}
                      disabled={lv > unlockedLevel}
                    >
                      第{lv}关
                      {lv > unlockedLevel && ' 🔒'}
                    </button>
                  ))}
                </div>
                {unlockedLevel >= 4 && (
                  <button
                    className={`level-btn infinite ${startLevel === 4 ? 'active' : ''}`}
                    onClick={() => {
                      setStartLevel(4)
                      setState(() => ({ ...createInitialState(3), infiniteMode: true, level: 3, started: true }))
                    }}
                  >
                    无限模式
                  </button>
                )}
              </div>
              <p className="level-desc">第1关: 吃5个豆子过关</p>
              <p className="level-desc">第2关: 吃10个豆子过关</p>
              <p className="level-desc">第3关: 吃20个豆子过关</p>
            </div>
          </div>
        )}
        {state.paused && !state.gameOver && state.started && !state.cleared && (
          <div className="overlay">
            <div className="modal">
              <h2>游戏暂停</h2>
              <p>按空格键继续游戏</p>
            </div>
          </div>
        )}
        {state.cleared && !state.infiniteMode && (
          <div className="overlay">
            <div className="modal level-clear">
              <h2>恭喜过关!</h2>
              <p>第 {state.level - 1} 关完成!</p>
              <p>得分: {state.score}</p>
              <p>即将进入第 {state.level} 关...</p>
              <button onClick={handleNextLevel}>下一关</button>
            </div>
          </div>
        )}
        {state.cleared && state.infiniteMode && (
          <div className="overlay">
            <div className="modal level-clear">
              <h2>全部通关!</h2>
              <p>恭喜你通过了所有关卡!</p>
              <p>得分: {state.score}</p>
              <p>无限模式已开启!</p>
              <button onClick={handleNextLevel}>进入无限模式</button>
            </div>
          </div>
        )}
        {askName && (
          <div className="overlay">
            <div className="modal">
              <h2>记录成绩</h2>
              <p>得分: {state.score}</p>
              <input
                className="name-input"
                type="text"
                placeholder="输入你的名字"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                autoFocus
              />
              <div className="btn-row">
                <button onClick={submitRank}>提交</button>
                <button onClick={() => setAskName(false)}>跳过</button>
              </div>
            </div>
          </div>
        )}
        {showRank && (
          <div className="overlay">
            <div className="modal rank-modal">
              <h2>排行榜</h2>
              <div className="rank-list">
                {rank.length === 0 ? (
                  <p className="empty-rank">暂无记录</p>
                ) : (
                  rank.map((r, i) => (
                    <div key={i} className={`rank-item ${i < 3 ? 'top' : ''}`}>
                      <span className="rank-num">{i + 1}</span>
                      <span className="rank-name">{r.name}</span>
                      <span className="rank-score">{r.score}</span>
                      <span className="rank-mode">{r.mode}</span>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => setShowRank(false)}>关闭</button>
            </div>
          </div>
        )}
      </div>
      <div className="controls">
        <button onClick={resetGame}>重新开始</button>
        {state.started && !state.gameOver && !state.cleared && (
          <button onClick={() => setState((s) => ({ ...s, paused: !s.paused }))}>
            {state.paused ? '继续' : '暂停'}
          </button>
        )}
        <button onClick={() => setShowRank(true)}>排行榜</button>
      </div>
      <div className="touch-controls">
        <div className="gesture-hint">
          <span className="gesture-icon">👆</span>
          <span className="gesture-text">在屏幕上滑动控制方向</span>
        </div>
        <div className="action-btns">
          <button
            className="action-btn"
            onTouchStart={(e) => { e.preventDefault(); handleTouchPause() }}
            onClick={handleTouchPause}
          >
            {state.paused ? '继续' : '暂停'}
          </button>
        </div>
      </div>
      <div className="instructions">
        <p>方向键 / WASD 控制移动 | 空格键 暂停/继续</p>
      </div>
    </div>
  )
}
