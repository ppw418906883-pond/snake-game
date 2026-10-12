/**
 * input.js —— 输入管理器
 * 统一收口三类输入，对游戏层只暴露语义化事件：
 *   'direction'    —— 方向（键盘方向键 / WASD / 触屏滑动 / 虚拟方向键）
 *   'toggle-pause' —— 暂停切换（空格 / P）
 *   'primary'      —— 开始或重新开始（Enter）
 *
 * 虚拟方向按钮的事件由 UI 层直接调用 emitDirection 转发。
 */
(function (NS) {
  'use strict';

  var D = NS.CONFIG.DIRECTIONS;

  /** 键名 -> 方向名 */
  var KEY_TO_DIR = {
    ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT',
    w: 'UP', s: 'DOWN', a: 'LEFT', d: 'RIGHT',
    W: 'UP', S: 'DOWN', A: 'LEFT', D: 'RIGHT'
  };

  /** 触屏滑动识别阈值（像素） */
  var SWIPE_THRESHOLD = 20;

  /**
   * @param {Window} [win] 监听键盘的目标
   * @param {HTMLElement} [swipeEl] 监听触屏滑动的元素（通常是 canvas）
   */
  function InputManager(win, swipeEl) {
    this.win = win || window;
    this.swipeEl = swipeEl || null;
    this._handlers = { direction: [], 'toggle-pause': [], primary: [] };
    this._touchStart = null;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);

    this.win.addEventListener('keydown', this._onKeyDown, { passive: false });
    if (this.swipeEl) {
      this.swipeEl.addEventListener('pointerdown', this._onPointerDown, { passive: true });
      this.swipeEl.addEventListener('pointerup', this._onPointerUp, { passive: true });
      this.swipeEl.addEventListener('pointercancel', this._clearTouch.bind(this), { passive: true });
    }
  }

  InputManager.prototype = {
    constructor: InputManager,

    /**
     * 订阅事件
     * @param {'direction'|'toggle-pause'|'primary'} type
     * @param {Function} fn
     */
    on: function (type, fn) {
      if (this._handlers[type]) this._handlers[type].push(fn);
      return this;
    },

    emit: function (type, payload) {
      var list = this._handlers[type];
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try {
          list[i](payload);
        } catch (err) {
          // 单个监听者异常不应影响其他监听者
          console.error('[InputManager] handler error:', err);
        }
      }
    },

    /** 供虚拟方向键调用 */
    emitDirection: function (dirName) {
      if (D[dirName]) this.emit('direction', D[dirName]);
    },

    _onKeyDown: function (e) {
      // 忽略长按触发的自动重复事件，避免空格/P 被快速偶数次切换
      if (e.repeat) return;

      var dirName = KEY_TO_DIR[e.key];
      if (dirName) {
        // 阻止方向键滚动页面
        e.preventDefault();
        this.emit('direction', D[dirName]);
        return;
      }
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.emit('toggle-pause');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.emit('primary');
      } else if (e.key === 'p' || e.key === 'P') {
        this.emit('toggle-pause');
      }
    },

    _onPointerDown: function (e) {
      // 仅响应主要触摸类型（手指 / 鼠标左键）
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this._touchStart = { x: e.clientX, y: e.clientY };
    },

    _onPointerUp: function (e) {
      var start = this._touchStart;
      this._touchStart = null;
      if (!start) return;

      var dx = e.clientX - start.x;
      var dy = e.clientY - start.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

      // 取位移更大的轴向作为滑动方向
      if (Math.abs(dx) > Math.abs(dy)) {
        this.emit('direction', dx > 0 ? D.RIGHT : D.LEFT);
      } else {
        this.emit('direction', dy > 0 ? D.DOWN : D.UP);
      }
    },

    _clearTouch: function () {
      this._touchStart = null;
    },

    /** 解绑全部事件（便于扩展/测试时销毁） */
    destroy: function () {
      this.win.removeEventListener('keydown', this._onKeyDown);
      if (this.swipeEl) {
        this.swipeEl.removeEventListener('pointerdown', this._onPointerDown);
        this.swipeEl.removeEventListener('pointerup', this._onPointerUp);
      }
    }
  };

  NS.InputManager = InputManager;
})(window.SnakeGame);
