/**
 * storage.js —— 安全的本地存储封装
 * 对 localStorage 的读写做异常兜底（隐私模式 / 配额满 / 被禁用时不影响游戏）。
 */
(function (NS) {
  'use strict';

  NS.storage = {
    /**
     * 读取并 JSON 反序列化一个值
     * @param {string} key 存储键
     * @param {*} fallback 读取失败时的默认值
     * @returns {*}
     */
    get(key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
      } catch (err) {
        // 隐私模式或数据损坏时静默回退
        return fallback;
      }
    },

    /**
     * JSON 序列化后写入
     * @param {string} key 存储键
     * @param {*} value 可序列化的值
     * @returns {boolean} 是否写入成功
     */
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    }
  };
})(window.SnakeGame);
