/**
 * config.js —— 全局游戏配置
 * 所有可调参数集中在此，便于平衡难度与后续扩展（换皮、道具、多模式等）。
 */
(function (NS) {
  'use strict';

  NS.CONFIG = Object.freeze({
    /** 棋盘每边的格子数量（棋盘为正方形） */
    GRID_SIZE: 20,

    /** 蛇的初始长度（节数） */
    INITIAL_SNAKE_LENGTH: 3,

    /** 每吃到一个食物增加的分数 */
    SCORE_PER_FOOD: 10,

    /** 每吃多少个食物提升一个等级 */
    FOODS_PER_LEVEL: 5,

    /** 初始移动间隔（毫秒/格），数值越小蛇越快 */
    BASE_INTERVAL: 160,

    /** 速度上限对应的最小间隔，防止快到无法操作 */
    MIN_INTERVAL: 70,

    /** 每提升一级减少的间隔毫秒数 */
    SPEED_STEP: 9,

    /** localStorage 键名 */
    BEST_KEY: 'snake_game.best_score.v1',
    SOUND_KEY: 'snake_game.sound_enabled.v1',

    /** 单位方向向量，统一引用避免散落的魔法数字 */
    DIRECTIONS: Object.freeze({
      UP: Object.freeze({ x: 0, y: -1 }),
      DOWN: Object.freeze({ x: 0, y: 1 }),
      LEFT: Object.freeze({ x: -1, y: 0 }),
      RIGHT: Object.freeze({ x: 1, y: 0 })
    })
  });
})(window.SnakeGame = window.SnakeGame || {});
