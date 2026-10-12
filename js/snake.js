/**
 * snake.js —— 蛇实体
 * 职责：维护身体坐标、移动、转向、生长、自身碰撞检测。
 * 关键点：
 *  - body[0] 永远是蛇头；
 *  - 使用方向输入队列（最多缓存 2 个），解决快速连按两键导致的“180° 反向自杀”；
 *  - 每次移动前快照 prevBody，供渲染层做插值平滑动画。
 */
(function (NS) {
  'use strict';

  function clonePoint(p) {
    return { x: p.x, y: p.y };
  }

  /**
   * @param {number} grid 棋盘边长（格数）
   * @param {number} initialLength 初始节数
   */
  function Snake(grid, initialLength) {
    this.gridSize = grid;
    this.initialLength = initialLength;
    this.reset();
  }

  Snake.prototype = {
    constructor: Snake,

    /** 恢复到棋盘中央、向右移动的初始状态 */
    reset: function () {
      var mid = Math.floor(this.gridSize / 2);
      this.body = [];
      // 蛇头在右，尾巴在左，初始朝右
      for (var i = 0; i < this.initialLength; i++) {
        this.body.push({ x: mid - i, y: mid });
      }
      this.prevBody = this.body.map(clonePoint);
      this.direction = clonePoint(NS.CONFIG.DIRECTIONS.RIGHT);
      this._queue = [];      // 待生效的方向队列
      this._growPending = 0; // 已吃到、待后续移动时兑现的生长节数（兜底）
      this.lastPopped = null; // 本步刚移除的尾节（吃到食物时立即接回）
    },

    /**
     * 请求转向。非法输入（反向 / 同向 / 队列已满）会被忽略。
     * @param {{x:number,y:number}} dir 单位方向向量
     */
    setDirection: function (dir) {
      if (!dir) return;
      // 以“队列中最后一个方向”（若为空则以当前方向）为基准做合法性判断
      var base = this._queue.length > 0 ? this._queue[this._queue.length - 1] : this.direction;
      var isReverse = dir.x === -base.x && dir.y === -base.y;
      var isSame = dir.x === base.x && dir.y === base.y;
      if (isReverse || isSame) return;
      if (this._queue.length < 2) this._queue.push(clonePoint(dir));
    },

    /**
     * 推进一格
     * @returns {{x:number,y:number}} 移动后的新蛇头坐标
     */
    move: function () {
      // 先保存移动前快照（插值渲染用）
      this.prevBody = this.body.map(clonePoint);

      if (this._queue.length > 0) {
        this.direction = this._queue.shift();
      }

      var head = this.body[0];
      var newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };
      this.body.unshift(newHead);

      if (this._growPending > 0) {
        // 兜底生长：保留尾巴（身体变长一节）
        this._growPending--;
        this.lastPopped = null;
      } else {
        // 普通移动：去掉尾巴，并暂存该尾节；
        // 若本步随后判定吃到食物，grow() 会把它立即接回，实现“当拍即变长”
        this.lastPopped = this.body.pop();
      }
      return newHead;
    },

    /**
     * 通知蛇生长 n 节
     * 优先把本步刚移除的尾节立即接回（吃食与长度增加在同一逻辑拍生效），
     * 没有可接回的尾节时才顺延到后续移动。
     */
    grow: function (n) {
      n = n || 1;
      if (this.lastPopped) {
        this.body.push(this.lastPopped);
        this.lastPopped = null;
        n--;
      }
      if (n > 0) this._growPending += n;
    },

    /** 自身碰撞：蛇头是否与身体其余部分重叠 */
    collidesSelf: function () {
      var head = this.body[0];
      for (var i = 1; i < this.body.length; i++) {
        if (this.body[i].x === head.x && this.body[i].y === head.y) return true;
      }
      return false;
    },

    /** 指定格子是否被蛇身占据（供食物生成时避让） */
    occupies: function (x, y) {
      for (var i = 0; i < this.body.length; i++) {
        if (this.body[i].x === x && this.body[i].y === y) return true;
      }
      return false;
    }
  };

  NS.Snake = Snake;
})(window.SnakeGame);
