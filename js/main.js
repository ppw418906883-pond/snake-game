/**
 * main.js —— 应用入口
 * 负责组装各模块：创建输入、游戏、UI 实例并完成依赖注入。
 */
(function (NS) {
  'use strict';

  function bootstrap() {
    var canvas = document.getElementById('gameCanvas');
    var canvasWrap = document.getElementById('canvasWrap');
    if (!canvas || !canvasWrap) {
      console.error('[main] 缺少必要的画布元素，游戏无法启动');
      return;
    }

    // callbacks 在 UI 创建后补绑，因此这里先传入共享对象
    var callbacks = {};
    var input = new NS.InputManager(window, canvas);
    var game = new NS.Game({
      canvas: canvas,
      canvasWrap: canvasWrap,
      input: input,
      callbacks: callbacks
    });
    var ui = new NS.UIController(game);

    // 暴露调试句柄（也便于后续扩展功能时在控制台交互）
    window.__snakeGame = game;
    window.__snakeUI = ui;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window.SnakeGame);
