/**
 * food.js —— 食物实体
 * 职责：在所有空闲格子中均匀随机生成食物，永不与蛇身重叠。
 */
(function (NS) {
  'use strict';

  /**
   * @param {number} grid 棋盘边长（格数）
   */
  function Food(grid) {
    this.gridSize = grid;
    this.position = null; // {x, y} 格子坐标
    this.bornAt = 0;      // 生成时间戳，用于出现时的缩放动画
  }

  Food.prototype = {
    constructor: Food,

    /**
     * 随机生成一个新食物
     * @param {(x:number,y:number)=>boolean} isOccupied 判断格子是否被占据
     * @returns {boolean} 是否生成成功（棋盘满时返回 false，表示通关）
     */
    spawn: function (isOccupied) {
      var freeCells = [];
      for (var y = 0; y < this.gridSize; y++) {
        for (var x = 0; x < this.gridSize; x++) {
          if (!isOccupied(x, y)) freeCells.push({ x: x, y: y });
        }
      }
      if (freeCells.length === 0) {
        this.position = null;
        return false;
      }
      var pick = freeCells[Math.floor(Math.random() * freeCells.length)];
      this.position = { x: pick.x, y: pick.y };
      this.bornAt = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      return true;
    }
  };

  NS.Food = Food;
})(window.SnakeGame);
