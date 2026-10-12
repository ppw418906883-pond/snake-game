/**
 * game.js —— 游戏核心（状态机 + 固定时间步主循环 + 规则判定）
 *
 * 状态流转：
 *   welcome ──开始──▶ playing ──暂停──▶ paused ──继续──▶ playing
 *                        │ 撞墙/咬到自己/通关
 *                        ▼
 *                      over ──再玩一次──▶ playing
 *
 * Game 是唯一事实源（Single Source of Truth）：
 * UI、渲染、音效、输入都通过回调/只读快照与它交互，模块间不直接耦合。
 */
(function (NS) {
  'use strict';

  var C = NS.CONFIG;

  /** 游戏状态枚举 */
  var STATE = Object.freeze({
    WELCOME: 'welcome',
    PLAYING: 'playing',
    PAUSED: 'paused',
    OVER: 'over'
  });

  /**
   * @param {Object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {HTMLElement} opts.canvasWrap
   * @param {InputManager} opts.input
   * @param {Object} [opts.callbacks] UI 回调：onState / onHud / onGameOver / onLevelUp
   */
  function Game(opts) {
    this.canvas = opts.canvas;
    this.canvasWrap = opts.canvasWrap;
    this.input = opts.input;
    this.callbacks = opts.callbacks || {};

    this.grid = C.GRID_SIZE;
    this.snake = new NS.Snake(this.grid, C.INITIAL_SNAKE_LENGTH);
    this.food = new NS.Food(this.grid);
    this.particles = new NS.Particles();
    this.renderer = new NS.Renderer(this.canvas, this.canvasWrap, this.grid);
    this.audio = NS.audio;

    /* ---- 运行时状态 ---- */
    this.state = STATE.WELCOME;
    this.score = 0;
    this.best = this._loadBest();
    this.foodsEaten = 0;
    this.level = 1;
    this.interval = C.BASE_INTERVAL; // 当前每格移动耗时（毫秒）

    this._accumulator = 0; // 固定步长累加器
    this._lastTime = 0;
    this._rafId = 0;

    this._bindInput();
    this._resetWorld();
    this._emitHud();
    this._emitState();

    // 启动渲染循环（欢迎界面下也渲染，作为动态背景）
    this._rafId = window.requestAnimationFrame(this._loop.bind(this));
  }

  Game.prototype = {
    constructor: Game,

    /* ================= 公开控制 API（供按钮/键盘调用） ================= */

    /** 从欢迎界面开始新游戏 */
    start: function () {
      if (this.state !== STATE.WELCOME) return;
      this._resetWorld();
      this._setState(STATE.PLAYING);
      this.audio.start();
    },

    /** 任意状态下立即重新开始 */
    restart: function () {
      this._resetWorld();
      this._setState(STATE.PLAYING);
      this.audio.start();
    },

    pause: function () {
      if (this.state !== STATE.PLAYING) return;
      this._setState(STATE.PAUSED);
      this.audio.pause();
    },

    resume: function () {
      if (this.state !== STATE.PAUSED) return;
      this._setState(STATE.PLAYING);
      this.audio.pause();
    },

    togglePause: function () {
      if (this.state === STATE.PLAYING) this.pause();
      else if (this.state === STATE.PAUSED) this.resume();
    },

    /** 主按钮 / Enter 的语义化动作：随状态变化 */
    primaryAction: function () {
      switch (this.state) {
        case STATE.WELCOME: this.start(); break;
        case STATE.PLAYING: this.pause(); break;
        case STATE.PAUSED: this.resume(); break;
        case STATE.OVER: this.restart(); break;
      }
    },

    /** 外部（键盘/虚拟方向键）请求转向，仅进行中生效 */
    setDirection: function (dir) {
      if (this.state === STATE.PLAYING) this.snake.setDirection(dir);
    },

    /* ================= 内部实现 ================= */

    _bindInput: function () {
      this.input.on('direction', (function (dir) {
        this.setDirection(dir);
      }).bind(this));
      this.input.on('toggle-pause', (function () {
        // 空格在欢迎/结束界面语义等同“开始”
        if (this.state === STATE.WELCOME || this.state === STATE.OVER) this.primaryAction();
        else this.togglePause();
      }).bind(this));
      this.input.on('primary', (function () {
        this.primaryAction();
      }).bind(this));
    },

    _loadBest: function () {
      var v = Number(NS.storage.get(C.BEST_KEY, 0));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
    },

    /** 重置一局的全部世界数据（不改变最高分） */
    _resetWorld: function () {
      this.snake.reset();
      var ok = this.food.spawn(this.snake.occupies.bind(this.snake));
      if (!ok) {
        // 理论上初始棋盘不可能满，兜底处理
        console.error('[Game] 初始食物生成失败');
      }
      this.particles.clear();
      this.score = 0;
      this.foodsEaten = 0;
      this.level = 1;
      this.interval = C.BASE_INTERVAL;
      this._accumulator = 0;
      this.renderer.setShake(0);
      this._emitHud();
    },

    /**
     * 推进一个逻辑步（蛇走一格）并执行全部规则判定
     */
    _tick: function () {
      var head = this.snake.move();

      // 1) 边界碰撞
      if (head.x < 0 || head.y < 0 || head.x >= this.grid || head.y >= this.grid) {
        this._endGame(false);
        return;
      }

      // 2) 自身碰撞（移动完成后判定：尾巴已正常移除，钻进原尾格不算撞）
      if (this.snake.collidesSelf()) {
        this._endGame(false);
        return;
      }

      // 3) 吃到食物
      if (this.food.position &&
          head.x === this.food.position.x && head.y === this.food.position.y) {
        this._onEat();
      }
    },

    /** 吃食物后的结算：生长、计分、粒子、音效、升级、生成下一个食物 */
    _onEat: function () {
      this.snake.grow(1);

      var oldLevel = this.level;
      this.score += C.SCORE_PER_FOOD;
      this.foodsEaten += 1;
      this.level = Math.floor(this.foodsEaten / C.FOODS_PER_LEVEL) + 1;
      // 难度递增：等级越高间隔越小，并设有下限保证可玩性
      this.interval = Math.max(
        C.MIN_INTERVAL,
        C.BASE_INTERVAL - (this.level - 1) * C.SPEED_STEP
      );

      // 视觉与听觉反馈
      var cell = this.renderer.cell;
      var cx = (this.food.position.x + 0.5) * cell;
      var cy = (this.food.position.y + 0.5) * cell;
      this.particles.burst(cx, cy, { colors: NS.particleColors.FOOD });
      this.audio.eat();
      if (this.level > oldLevel) {
        this.audio.levelUp();
        if (this.callbacks.onLevelUp) this.callbacks.onLevelUp(this.level);
      }

      // 生成下一个食物；棋盘已被填满则视为通关
      var spawned = this.food.spawn(this.snake.occupies.bind(this.snake));
      this._emitHud();
      if (!spawned) this._endGame(true);
    },

    /**
     * 结束本局
     * @param {boolean} isWin 是否为通关（棋盘填满）
     */
    _endGame: function (isWin) {
      this._setState(STATE.OVER);
      this.audio.gameOver();

      // 死亡时在蛇头位置迸发粒子 + 震屏（通关不惩罚）
      if (!isWin) {
        var head = this.snake.body[0];
        var cell = this.renderer.cell;
        this.particles.burst(
          (head.x + 0.5) * cell,
          (head.y + 0.5) * cell,
          { count: 22, colors: NS.particleColors.DEATH, power: 1.4 }
        );
        this.renderer.setShake(9);
      }

      var isRecord = this.score > this.best && this.score > 0;
      if (isRecord) {
        this.best = this.score;
        NS.storage.set(C.BEST_KEY, this.best);
        this._emitHud();
      }

      if (this.callbacks.onGameOver) {
        this.callbacks.onGameOver({
          score: this.score,
          best: this.best,
          level: this.level,
          length: this.snake.body.length,
          isWin: isWin,
          isRecord: isRecord
        });
      }
    },

    _setState: function (s) {
      this.state = s;
      this._emitState();
    },

    _emitState: function () {
      if (this.callbacks.onState) this.callbacks.onState(this.state);
    },

    _emitHud: function () {
      if (this.callbacks.onHud) {
        this.callbacks.onHud({
          score: this.score,
          best: this.best,
          level: this.level,
          length: this.snake.body.length,
          interval: this.interval
        });
      }
    },

    /**
     * requestAnimationFrame 主循环：
     * 渲染始终每帧执行；逻辑按固定时间步（this.interval）推进，
     * 渲染时用累加器余数对蛇的位置做插值，从而同时保证逻辑稳定与画面平滑。
     */
    _loop: function (t) {
      this._rafId = window.requestAnimationFrame(this._loop.bind(this));

      if (!this._lastTime) this._lastTime = t;
      var dt = t - this._lastTime;
      this._lastTime = t;
      // 切到后台标签页后 dt 可能巨大，钳制以免“追帧风暴”
      if (dt > 100) dt = 100;
      if (dt < 0) dt = 0;

      if (this.state === STATE.PLAYING) {
        this._accumulator += dt;
        if (this._accumulator > this.interval * 5) {
          this._accumulator = this.interval; // 兜底：最多补一个步长
        }
        while (this._accumulator >= this.interval) {
          this._tick();
          this._accumulator -= this.interval;
          if (this.state !== STATE.PLAYING) {
            this._accumulator = 0;
            break;
          }
        }
      }

      // 粒子在任意状态下都继续运动（死亡碎屑在结算界面也可见）
      this.particles.update(dt);

      var alpha = this.state === STATE.PLAYING
        ? Math.min(1, this._accumulator / this.interval)
        : 1;
      this.renderer.render(this, alpha, dt);
    }
  };

  NS.Game = Game;
  NS.GameState = STATE;
})(window.SnakeGame);
