/**
 * particles.js —— 轻量 Canvas 粒子系统
 * 用于“吃到食物”和“游戏结束”时的碎屑迸发效果，增强打击感。
 * 坐标统一使用画布 CSS 像素，速度单位为 像素/毫秒，由调用方按帧 dt 驱动。
 */
(function (NS) {
  'use strict';

  /** 吃食物时的粒子配色（暖色系，呼应红色食物） */
  var FOOD_COLORS = ['#f87171', '#fca5a5', '#fbbf24', '#fde68a'];
  /** 死亡时的粒子配色 */
  var DEATH_COLORS = ['#f87171', '#ef4444', '#b91c1c', '#fca5a5'];

  function ParticleSystem() {
    this.items = [];
  }

  ParticleSystem.prototype = {
    constructor: ParticleSystem,

    clear: function () {
      this.items.length = 0;
    },

    /**
     * 在指定像素坐标迸发一簇粒子
     * @param {number} cx 中心 x（像素）
     * @param {number} cy 中心 y（像素）
     * @param {Object} [opts]
     * @param {number} [opts.count=14] 粒子数量
     * @param {string[]} [opts.colors] 候选颜色
     * @param {number} [opts.power=1] 速度倍率
     */
    burst: function (cx, cy, opts) {
      opts = opts || {};
      var count = opts.count != null ? opts.count : 14;
      var colors = opts.colors || FOOD_COLORS;
      var power = opts.power != null ? opts.power : 1;

      for (var i = 0; i < count; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = (0.05 + Math.random() * 0.18) * power; // 像素/毫秒
        var life = 380 + Math.random() * 320;
        this.items.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.04, // 略微向上，形成抛洒感
          size: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: life,
          maxLife: life
        });
      }
      // 安全上限，避免极端情况下粒子无限堆积
      if (this.items.length > 400) {
        this.items.splice(0, this.items.length - 400);
      }
    },

    /**
     * 推进粒子动画
     * @param {number} dt 距上一帧的毫秒数
     */
    update: function (dt) {
      var list = this.items;
      for (var i = list.length - 1; i >= 0; i--) {
        var p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // 指数阻尼 + 微弱重力
        var damping = Math.exp(-2.6 * dt / 1000);
        p.vx *= damping;
        p.vy = p.vy * damping + 0.00022 * dt;
      }
    },

    /**
     * 绘制全部粒子
     * @param {CanvasRenderingContext2D} ctx
     */
    draw: function (ctx) {
      var list = this.items;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  };

  NS.Particles = ParticleSystem;
  NS.particleColors = { FOOD: FOOD_COLORS, DEATH: DEATH_COLORS };
})(window.SnakeGame);
