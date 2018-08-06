'use strict';

var _VK = require('./providers/VK');

var _VK2 = _interopRequireDefault(_VK);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const vk = new _VK2.default(process.env.VK_TOKEN, process.env.VK_GROUP_ID);

vk.addEventListener('message', msg => {
  console.log(msg);
});