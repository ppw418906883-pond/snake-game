/**
 * audio.js —— 基于 Web Audio API 的音效管理器
 * 所有音效均由振荡器 + 音量包络实时合成，不依赖任何外部音频文件：
 * 体积小、无加载延迟、可自由调节音高与时长。
 */
(function (NS) {
  'use strict';

  var C = NS.CONFIG;

  function SoundManager() {
    /** AudioContext 延迟到首次用户交互时创建（浏览器自动播放策略要求） */
    this._ctx = null;
    this._master = null;
    this.enabled = NS.storage.get(C.SOUND_KEY, true) !== false;
  }

  SoundManager.prototype = {
    constructor: SoundManager,

    /** 懒加载并恢复 AudioContext，返回是否可用 */
    _ensureContext: function () {
      if (!this.enabled) return null;
      try {
        if (!this._ctx) {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          this._ctx = new AC();
          this._master = this._ctx.createGain();
          this._master.gain.value = 0.22; // 主音量，避免合成音刺耳
          this._master.connect(this._ctx.destination);
        }
        // 部分浏览器中 context 可能处于 suspended 状态
        if (this._ctx.state === 'suspended') {
          this._ctx.resume();
        }
        return this._ctx;
      } catch (err) {
        return null;
      }
    },

    /**
     * 播放一个带频率滑变与淡入淡出包络的单音
     * @param {Object} o 音色参数
     * @param {number} o.freq 起始频率 Hz
     * @param {number} [o.freqEnd] 结束频率 Hz（不填则不滑变）
     * @param {number} [o.dur=0.15] 时长（秒）
     * @param {number} [o.delay=0] 相对当前的延迟（秒）
     * @param {string} [o.type='sine'] 波形 sine/square/triangle/sawtooth
     * @param {number} [o.vol=1] 相对主音量的力度 0~1
     */
    _tone: function (o) {
      var ctx = this._ensureContext();
      if (!ctx || !this._master) return;

      var start = ctx.currentTime + (o.delay || 0);
      var dur = o.dur != null ? o.dur : 0.15;

      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, start);
      if (o.freqEnd && o.freqEnd !== o.freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqEnd), start + dur);
      }

      // 简单 ADSR 包络：快速起音、指数衰减，避免爆音
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(o.vol || 1, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(this._master);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    },

    /** 吃到食物：短促上扬的双音 */
    eat: function () {
      this._tone({ freq: 520, freqEnd: 760, dur: 0.1, type: 'triangle', vol: 0.9 });
      this._tone({ freq: 880, dur: 0.07, type: 'sine', vol: 0.5, delay: 0.06 });
    },

    /** 等级提升：明亮的三连琶音 */
    levelUp: function () {
      this._tone({ freq: 660, dur: 0.09, type: 'square', vol: 0.5 });
      this._tone({ freq: 880, dur: 0.09, type: 'square', vol: 0.5, delay: 0.09 });
      this._tone({ freq: 1175, dur: 0.16, type: 'square', vol: 0.55, delay: 0.18 });
    },

    /** 游戏开始：上行三音 */
    start: function () {
      this._tone({ freq: 392, dur: 0.09, type: 'triangle', vol: 0.7 });
      this._tone({ freq: 523, dur: 0.09, type: 'triangle', vol: 0.7, delay: 0.08 });
      this._tone({ freq: 659, dur: 0.14, type: 'triangle', vol: 0.8, delay: 0.16 });
    },

    /** 暂停 / 继续：轻柔单音 */
    pause: function () {
      this._tone({ freq: 440, freqEnd: 360, dur: 0.12, type: 'sine', vol: 0.6 });
    },

    /** 游戏结束：下行音阶 */
    gameOver: function () {
      this._tone({ freq: 440, dur: 0.16, type: 'sawtooth', vol: 0.55 });
      this._tone({ freq: 330, dur: 0.16, type: 'sawtooth', vol: 0.55, delay: 0.15 });
      this._tone({ freq: 220, dur: 0.32, type: 'sawtooth', vol: 0.6, delay: 0.3 });
    },

    /** 切换音效开关并持久化，返回最新状态 */
    toggle: function () {
      this.enabled = !this.enabled;
      NS.storage.set(C.SOUND_KEY, this.enabled);
      if (this.enabled) {
        this._ensureContext();
        this.start();
      }
      return this.enabled;
    }
  };

  NS.SoundManager = SoundManager;
  NS.audio = new SoundManager();
})(window.SnakeGame);
