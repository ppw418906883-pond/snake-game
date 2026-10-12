/**
 * ui.js —— UI 控制器
 * 负责 DOM 查询缓存、按钮事件绑定、HUD 数据刷新、
 * 遮罩层（欢迎 / 暂停 / 结束）切换以及音效按钮状态。
 * 它只调用 Game 暴露的公开 API，不直接修改游戏数据。
 */
(function (NS) {
  'use strict';

  /** 各状态下主按钮文案 */
  var PRIMARY_LABEL = {
    welcome: '开始游戏',
    playing: '暂停',
    paused: '继续',
    over: '再玩一次'
  };

  function UIController(game) {
    this.game = game;
    this.el = this._cacheElements();
    this._lastScore = 0;

    this._bindEvents();

    // 将自身渲染函数注册为 Game 的回调，打通数据流
    game.callbacks.onState = this.onState.bind(this);
    game.callbacks.onHud = this.onHud.bind(this);
    game.callbacks.onGameOver = this.onGameOver.bind(this);
    game.callbacks.onLevelUp = this.onLevelUp.bind(this);

    // 首次同步界面
    this.onHud({
      score: game.score,
      best: game.best,
      level: game.level,
      length: game.snake.body.length,
      interval: game.interval
    });
    this.onState(game.state);
    this._syncSoundIcon();
  }

  UIController.prototype = {
    constructor: UIController,

    _cacheElements: function () {
      var $ = function (id) {
        var node = document.getElementById(id);
        if (!node) console.warn('[UI] 找不到元素 #' + id);
        return node;
      };
      return {
        // HUD
        score: $('scoreVal'),
        best: $('bestVal'),
        level: $('levelVal'),
        length: $('lengthVal'),
        // 按钮
        primaryBtn: $('primaryBtn'),
        restartBtn: $('restartBtn'),
        soundBtn: $('soundToggle'),
        // 遮罩层
        overlays: {
          welcome: $('welcomeOverlay'),
          paused: $('pauseOverlay'),
          over: $('overOverlay')
        },
        // 结束界面元素
        overEmoji: $('overEmoji'),
        overTitle: $('overTitle'),
        overScore: $('overScore'),
        overBest: $('overBest'),
        overLength: $('overLength'),
        overLevel: $('overLevel'),
        newRecord: $('newRecordBadge'),
        // 遮罩内按钮
        welcomeStartBtn: $('welcomeStartBtn'),
        pauseResumeBtn: $('pauseResumeBtn'),
        overRestartBtn: $('overRestartBtn'),
        // 虚拟方向键
        dpadButtons: document.querySelectorAll('.dpad-btn')
      };
    },

    _bindEvents: function () {
      var self = this;
      var g = this.game;

      /** 统一处理：执行动作后让按钮失焦，避免空格/回车再次触发按钮 */
      var action = function (fn) {
        return function (e) {
          if (e) e.preventDefault();
          fn.call(g);
          if (this && this.blur) this.blur();
        };
      };

      this.el.primaryBtn.addEventListener('click', action(g.primaryAction));
      this.el.restartBtn.addEventListener('click', action(g.restart));
      this.el.welcomeStartBtn.addEventListener('click', action(g.start));
      this.el.pauseResumeBtn.addEventListener('click', action(g.resume));
      this.el.overRestartBtn.addEventListener('click', action(g.restart));

      this.el.soundBtn.addEventListener('click', function () {
        g.audio.toggle();
        self._syncSoundIcon();
        this.blur();
      });

      // 虚拟方向键：用 pointerdown 获得最低延迟；preventDefault 防止虚拟键盘/焦点干扰
      for (var i = 0; i < this.el.dpadButtons.length; i++) {
        (function (btn) {
          var handler = function (e) {
            e.preventDefault();
            g.input.emitDirection(btn.getAttribute('data-dir'));
          };
          btn.addEventListener('pointerdown', handler);
        })(this.el.dpadButtons[i]);
      }
    },

    /** 刷新 HUD 数字；分数变化时重播弹跳动画 */
    onHud: function (hud) {
      this.el.score.textContent = hud.score;
      this.el.best.textContent = hud.best;
      this.el.level.textContent = hud.level;
      this.el.length.textContent = hud.length;

      if (hud.score !== this._lastScore) {
        this._lastScore = hud.score;
        this._replayBump(this.el.score);
      }
    },

    _replayBump: function (node) {
      node.classList.remove('bump');
      // 强制重排以重启动画
      void node.offsetWidth;
      node.classList.add('bump');
    },

    /** 状态变化：切换遮罩、按钮文案与可用性 */
    onState: function (state) {
      var overlays = this.el.overlays;
      overlays.welcome.classList.toggle('active', state === 'welcome');
      overlays.paused.classList.toggle('active', state === 'paused');
      overlays.over.classList.toggle('active', state === 'over');

      this.el.primaryBtn.textContent = PRIMARY_LABEL[state] || '开始游戏';
      this.el.restartBtn.disabled = (state === 'welcome');
    },

    /** 游戏结束：填充结算数据 */
    onGameOver: function (result) {
      this.el.overScore.textContent = result.score;
      this.el.overBest.textContent = result.best;
      this.el.overLength.textContent = result.length;
      this.el.overLevel.textContent = result.level;
      this.el.newRecord.classList.toggle('hidden', !result.isRecord);

      if (result.isWin) {
        this.el.overEmoji.textContent = '🏆';
        this.el.overTitle.textContent = '恭喜通关！';
      } else {
        this.el.overEmoji.textContent = '💀';
        this.el.overTitle.textContent = '游戏结束';
      }
    },

    /** 升级时等级数字弹跳提示 */
    onLevelUp: function () {
      this._replayBump(this.el.level);
    },

    _syncSoundIcon: function () {
      var on = this.game.audio.enabled;
      this.el.soundBtn.textContent = on ? '🔊' : '🔇';
      this.el.soundBtn.setAttribute('aria-pressed', String(on));
    }
  };

  NS.UIController = UIController;
})(window.SnakeGame);
