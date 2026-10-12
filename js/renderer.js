/**
 * renderer.js —— Canvas 渲染器
 * 负责一切图形绘制，不包含游戏规则逻辑：
 *  - 高 DPI 屏幕适配 + ResizeObserver 自适应尺寸；
 *  - 棋盘背景（圆角 + 双色格纹）；
 *  - 食物：径向渐变“小苹果”、出生回弹与呼吸脉动；
 *  - 蛇：头尾渐变色、圆角节段、朝向眼睛；基于 prevBody 与当前 body 线性插值，实现平滑移动；
 *  - 粒子与死亡震屏；所有内容裁剪在棋盘圆角内。
 */
(function (NS) {
  'use strict';

  /* ---------------- 小型绘图工具函数 ---------------- */

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  /** 圆角矩形路径（兼容不支持 ctx.roundRect 的环境） */
  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** #rrggbb -> [r,g,b] */
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** 在两个十六进制颜色之间线性插值，返回 rgb() 字符串 */
  function mixColor(hexA, hexB, t) {
    var a = hexToRgb(hexA);
    var b = hexToRgb(hexB);
    var r = Math.round(a[0] + (b[0] - a[0]) * t);
    var g = Math.round(a[1] + (b[1] - a[1]) * t);
    var bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /** 出生回弹缓动 */
  function easeOutBack(t) {
    var c1 = 1.70158;
    var c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  var HEAD_COLOR = '#4ade80';
  var TAIL_COLOR = '#0d9488';
  var DEAD_HEAD_COLOR = '#ef4444';

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} wrap 画布容器（决定显示尺寸）
   * @param {number} grid 棋盘边长（格数）
   */
  function Renderer(canvas, wrap, grid) {
    this.canvas = canvas;
    this.wrap = wrap;
    this.grid = grid;

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('当前浏览器不支持 Canvas 2D 上下文');
    }
    this.ctx = ctx;

    this.viewSize = 0; // CSS 像素边长
    this.cell = 0;     // 每格 CSS 像素
    this._dpr = 1;
    this._shake = 0;   // 震屏幅度

    this._onResize = this.resize.bind(this);
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(this._onResize);
      this._ro.observe(this.wrap);
    } else {
      window.addEventListener('resize', this._onResize);
    }
  }

  Renderer.prototype = {
    constructor: Renderer,

    /** 根据容器实际宽度同步画布像素尺寸（适配 DPR，保证清晰不模糊） */
    resize: function () {
      var size = this.wrap.clientWidth;
      if (!size || size <= 0) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5); // 限制 DPR 兼顾性能

      this.viewSize = size;
      this.cell = size / this.grid;
      this._dpr = dpr;
      this.canvas.width = Math.round(size * dpr);
      this.canvas.height = Math.round(size * dpr);
    },

    setShake: function (magnitude) {
      this._shake = magnitude || 0;
    },

    /**
     * 渲染一帧
     * @param {Object} game Game 实例（读取 snake/food/particles/state）
     * @param {number} alpha 当前逻辑步的插值系数 0~1
     * @param {number} dt 距上一帧毫秒数（用于震屏衰减）
     */
    render: function (game, alpha, dt) {
      if (!this.viewSize) this.resize();
      var ctx = this.ctx;
      var size = this.viewSize;
      if (!size) return;

      ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      ctx.save();
      // 震屏偏移（随时间衰减）
      this._shake = Math.max(0, this._shake - dt * 0.028);
      if (this._shake > 0.2) {
        ctx.translate(
          (Math.random() * 2 - 1) * this._shake,
          (Math.random() * 2 - 1) * this._shake
        );
      }

      // 整张棋盘裁剪到圆角区域内，避免出界蛇头画到边框外
      roundRectPath(ctx, 0, 0, size, size, 16);
      ctx.clip();

      this._drawBoard(ctx, size);
      this._drawFood(ctx, game.food);
      this._drawSnake(ctx, game.snake, alpha, game.state);
      game.particles.draw(ctx);

      ctx.restore();
    },

    /* ---------------- 棋盘 ---------------- */

    _drawBoard: function (ctx, size) {
      // 底色
      ctx.fillStyle = '#0c1424';
      ctx.fillRect(0, 0, size, size);

      // 双色格纹
      var cell = this.cell;
      ctx.fillStyle = 'rgba(255,255,255,0.022)';
      for (var y = 0; y < this.grid; y++) {
        for (var x = 0; x < this.grid; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillRect(x * cell, y * cell, cell, cell);
          }
        }
      }

      // 内描边，强化棋盘边界
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 2;
      roundRectPath(ctx, 1, 1, size - 2, size - 2, 15);
      ctx.stroke();
    },

    /* ---------------- 食物 ---------------- */

    _drawFood: function (ctx, food) {
      if (!food.position) return;
      var cell = this.cell;
      var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      // 出生回弹（前 220ms）+ 持续呼吸脉动
      var age = now - food.bornAt;
      var pop = age < 220 ? easeOutBack(clamp(age / 220, 0, 1)) : 1;
      var pulse = 1 + Math.sin(now / 220) * 0.07;
      var radius = cell * 0.3 * pop * pulse;

      var cx = (food.position.x + 0.5) * cell;
      var cy = (food.position.y + 0.5) * cell;

      // 外发光
      ctx.save();
      ctx.shadowColor = 'rgba(239,68,68,0.75)';
      ctx.shadowBlur = cell * 0.45;

      var grad = ctx.createRadialGradient(
        cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
        cx, cy, radius
      );
      grad.addColorStop(0, '#fca5a5');
      grad.addColorStop(0.55, '#ef4444');
      grad.addColorStop(1, '#b91c1c');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(cx - radius * 0.32, cy - radius * 0.36, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // 果柄与小叶子
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1.5, cell * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius * 0.85);
      ctx.lineTo(cx + cell * 0.04, cy - radius * 1.25);
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(
        cx + cell * 0.13, cy - radius * 1.28,
        cell * 0.1, cell * 0.055, -0.5, 0, Math.PI * 2
      );
      ctx.fill();
    },

    /* ---------------- 蛇 ---------------- */

    _drawSnake: function (ctx, snake, alpha, state) {
      var body = snake.body;
      var prev = snake.prevBody && snake.prevBody.length ? snake.prevBody : body;
      var n = body.length;
      var cell = this.cell;
      var inset = cell * 0.08;
      var segment = cell - inset * 2;
      var isDead = state === 'over';

      // 插值位置：生长出新尾巴节时，没有对应 prev，则沿用旧尾位置
      var posAt = function (i) {
        var cur = body[i];
        var p = prev[i] || prev[prev.length - 1] || cur;
        return {
          x: p.x + (cur.x - p.x) * alpha,
          y: p.y + (cur.y - p.y) * alpha
        };
      };

      // 从尾向头绘制，保证头在最上层
      for (var i = n - 1; i >= 0; i--) {
        var p = posAt(i);
        var t = n > 1 ? i / (n - 1) : 0;
        var color = mixColor(HEAD_COLOR, TAIL_COLOR, t);
        if (isDead && i === 0) color = DEAD_HEAD_COLOR;

        ctx.fillStyle = color;
        roundRectPath(
          ctx,
          p.x * cell + inset,
          p.y * cell + inset,
          segment, segment,
          cell * 0.3
        );
        ctx.fill();

        // 蛇头略深一号的描边 + 眼睛
        if (i === 0) {
          this._drawHeadFace(ctx, p, snake.direction, cell, isDead);
        }
      }
    },

    /** 绘制蛇头的眼睛（朝向随移动方向变化） */
    _drawHeadFace: function (ctx, cellPos, dir, cell, isDead) {
      var cx = (cellPos.x + 0.5) * cell;
      var cy = (cellPos.y + 0.5) * cell;

      // 前向与侧向偏移
      var fwd = cell * 0.16;
      var side = cell * 0.19;
      var fx = dir.x * fwd;
      var fy = dir.y * fwd;
      // 垂直于朝向的向量
      var px = -dir.y * side;
      var py = dir.x * side;

      var eyeR = cell * 0.1;
      var pupilR = cell * 0.05;

      var drawEye = function (ex, ey) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
        ctx.fill();

        if (isDead) {
          // X 形眼睛
          ctx.strokeStyle = '#1f2937';
          ctx.lineWidth = Math.max(1.2, cell * 0.035);
          var d = pupilR * 0.9;
          ctx.beginPath();
          ctx.moveTo(ex - d, ey - d); ctx.lineTo(ex + d, ey + d);
          ctx.moveTo(ex + d, ey - d); ctx.lineTo(ex - d, ey + d);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#10241a';
          ctx.beginPath();
          ctx.arc(ex + dir.x * pupilR * 0.6, ey + dir.y * pupilR * 0.6, pupilR, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawEye(cx + fx + px, cy + fy + py);
      drawEye(cx + fx - px, cy + fy - py);
    }
  };

  NS.Renderer = Renderer;
})(window.SnakeGame);
